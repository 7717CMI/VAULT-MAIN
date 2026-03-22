'use server';

import { prisma } from '../db';
import { WhitePaperContent, WhitePaperResult, ImpactAnalysisChartData, ImpactFactor } from '../types';
import { normalizeTopic } from '../utils/topic-extractor';
import {
  getBenchmarkForTopic,
  getBroaderCategoryForTopic,
  getTierDescription,
  validateMarketSizeConsistency,
  type MarketBenchmark,
} from '../data/market-benchmarks';
import { getOrCreateUser } from '../auth0-helpers';
import { deductCredits, checkCredits } from '../credits/credit-service';
import { CREDIT_COSTS } from '../credits/credit-costs';
import { isCompanyUnlocked } from '../credits/company-unlock';
import * as templates from '../utils/whitepaper-templates';
import { SEGMENT_DEFINITIONS } from '../constants/segment-definitions';
import { getUsdToInrRate } from '../services/exchange-rate';

// Cache duration: 7 days in milliseconds
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Market context built from research or benchmarks
 * Used to constrain AI-generated market data to realistic values
 */
interface MarketContext {
  hasVerifiedData: boolean;
  dataTier: 'specific' | 'broader' | 'benchmark';
  broaderCategory?: string; // e.g., "Probiotics" when topic was "Bacillus Clausi"
  // India market data
  verifiedMarketSize2026?: string;
  verifiedMarketSize2033?: string;
  verifiedCagr?: string;
  // Global market data (NEW)
  verifiedGlobalMarketSize2026?: string;
  verifiedGlobalMarketSize2033?: string;
  verifiedGlobalCagr?: string;
  benchmark: MarketBenchmark;
  dataSources: string[];
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Extracted market data from generated content
 */
interface ExtractedMarketData {
  // India market data
  marketSize2026: number | null;
  marketSize2033: number | null;
  cagr: number | null;
  // Global market data (NEW)
  globalMarketSize2026: number | null;
  globalMarketSize2033: number | null;
  globalCagr: number | null;
}

/**
 * Market reference found in a section
 */
interface MarketReference {
  section: string;
  type: 'global_2026' | 'global_2033' | 'global_cagr' | 'india_2026' | 'india_2033' | 'india_cagr';
  value: number;
  rawText: string;
}

/**
 * Cross-section consistency validation result
 */
interface ConsistencyValidationResult {
  isValid: boolean;
  mismatches: Array<{
    type: string;
    values: Array<{ section: string; value: number }>;
    deviation: number;
  }>;
}

/**
 * Maximum retries for regeneration on data inconsistency
 */
const MAX_CONSISTENCY_RETRIES = 2;

/**
 * Tolerance percentage for cross-section value comparison
 */
const CONSISTENCY_TOLERANCE_PERCENT = 10;

/**
 * Current data version — increment when data pipeline changes require cache invalidation
 */
const CURRENT_DATA_VERSION = 2;

/**
 * Clear all stale cached whitepapers that were generated before the verified data pipeline
 * Called on component mount to ensure old hardcoded-benchmark-based content is removed
 */
export async function clearStaleWhitepaperCache(): Promise<number> {
  try {
    const allWhitepapers = await prisma.whitePaper.findMany({
      select: { id: true, topic: true, content: true },
    });

    let deletedCount = 0;
    for (const wp of allWhitepapers) {
      const content = wp.content as Record<string, unknown>;
      if (!content?._dataVersion || (content._dataVersion as number) < CURRENT_DATA_VERSION) {
        await prisma.whitePaper.delete({ where: { id: wp.id } });
        deletedCount++;
        console.log(`[WhitePaper Cache] Deleted stale entry: "${wp.topic}" (v${content?._dataVersion || 0})`);
      }
    }

    if (deletedCount > 0) {
      console.log(`[WhitePaper Cache] Cleared ${deletedCount} stale cache entries (pre-v${CURRENT_DATA_VERSION})`);
    }
    return deletedCount;
  } catch (error) {
    console.error('[WhitePaper Cache] Error clearing stale cache:', error);
    return 0;
  }
}

/**
 * Get cached white paper from database
 */
export async function getCachedWhitePaperAction(
  topic: string
): Promise<WhitePaperResult | null> {
  try {
    const normalizedTopic = normalizeTopic(topic);
    console.log(`[WhitePaper Cache] Looking up cache for key: "${normalizedTopic}"`);

    const cached = await prisma.whitePaper.findUnique({
      where: { topic: normalizedTopic },
    });

    if (!cached) {
      console.log(`[WhitePaper Cache] No cache entry found for key: "${normalizedTopic}"`);
      return null;
    }

    console.log(`[WhitePaper Cache] Found cache entry:`);
    console.log(`[WhitePaper Cache] - ID: ${cached.id}`);
    console.log(`[WhitePaper Cache] - Created: ${cached.createdAt}`);
    console.log(`[WhitePaper Cache] - Expires: ${cached.expiresAt}`);
    console.log(`[WhitePaper Cache] - isLive: ${cached.isLive}`);

    // Check if cache is expired
    if (cached.expiresAt < new Date()) {
      // Cache expired, delete it
      console.log(`[WhitePaper Cache] Cache EXPIRED - deleting entry`);
      await prisma.whitePaper.delete({
        where: { id: cached.id },
      });
      return null;
    }

    // Validate content isn't an empty placeholder (created by unlock flow)
    const content = cached.content as unknown as WhitePaperContent;
    const hasContent = content?.executiveSummary || content?.overview || content?.marketSize || content?.growthFactors;
    if (!hasContent) {
      console.log(`[WhitePaper Cache] Cache entry has EMPTY content - treating as miss`);
      return null;
    }

    // Invalidate old cached whitepapers that used hardcoded benchmarks (pre-verified-data pipeline)
    if (!content._dataVersion || content._dataVersion < CURRENT_DATA_VERSION) {
      console.log(`[WhitePaper Cache] Cache entry has stale data version (${content._dataVersion || 0} < ${CURRENT_DATA_VERSION}) - treating as miss`);
      await prisma.whitePaper.delete({ where: { id: cached.id } });
      return null;
    }

    console.log(`[WhitePaper Cache] Cache is VALID (v${content._dataVersion}) - returning cached content`);

    return {
      content,
      isLive: cached.isLive,
      generatedAt: cached.createdAt,
    };
  } catch (error) {
    console.error('[WhitePaper] Error fetching cached white paper:', error);
    return null;
  }
}

/**
 * Store white paper in database cache
 */
export async function storeWhitePaperAction(
  topic: string,
  content: WhitePaperContent,
  searchQuery?: string,
  isLive: boolean = true
): Promise<void> {
  try {
    const normalizedTopic = normalizeTopic(topic);
    const expiresAt = new Date(Date.now() + CACHE_DURATION_MS);

    await prisma.whitePaper.upsert({
      where: { topic: normalizedTopic },
      update: {
        content: content as object,
        searchQuery,
        isLive,
        expiresAt,
        updatedAt: new Date(),
      },
      create: {
        topic: normalizedTopic,
        searchQuery,
        content: content as object,
        isLive,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('[WhitePaper] Error storing white paper:', error);
  }
}

/**
 * Clean up AI-generated text
 */
function cleanupText(text: string): string {
  let cleaned = text;
  // Remove reference brackets like [1], [2], etc.
  cleaned = cleaned.replace(/\[\d+\]/g, '');
  // Remove markdown headers
  cleaned = cleaned.replace(/^#{1,6}\s*/gm, '');
  // Remove bold/italic markdown
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1');
  cleaned = cleaned.replace(/__(.*?)__/g, '$1');
  // Remove source attributions
  cleaned = cleaned.replace(/\s*\((?:per|according to|via|from|source:?|as per|based on)\s+[^)]+\)/gi, '');
  // Normalize whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  return cleaned.trim();
}

/**
 * Parse bullet points from text
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseBulletPoints(text: string): string[] {
  const lines = text.split('\n');
  const bullets: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and section headers
    if (!trimmed || trimmed.match(/^(overview|market|growth|challenge|opportunit|trend|regulation|go[\s-]?to[\s-]?market|gtm|key\s)/i)) {
      continue;
    }

    let content = trimmed;

    // Remove bullet markers only (not content)
    // Handle: •, -, *, ►, ▸, →
    if (content.match(/^[•\-\*►▸→]\s*/)) {
      content = content.replace(/^[•\-\*►▸→]\s*/, '');
    }
    // Handle: 1. 2. 3) a) b.
    else if (content.match(/^\d+[.):\-]\s*/)) {
      content = content.replace(/^\d+[.):\-]\s*/, '');
    }
    // Handle: a) b) a. b.
    else if (content.match(/^[a-z][.)]\s*/i)) {
      content = content.replace(/^[a-z][.)]\s*/i, '');
    }

    content = content.trim();

    // Only add if content is meaningful
    if (content.length > 15 && !content.match(/^(overview|market|growth|challenge|opportunit|trend|regulation|go[\s-]?to[\s-]?market|gtm|strateg)/i)) {
      bullets.push(cleanupText(content));
    }
  }

  return bullets;
}

/**
 * Extract a section from text between two headers
 */
function extractSection(text: string, sectionPattern: RegExp, endPatterns: RegExp[]): string {
  const match = text.match(sectionPattern);
  if (!match) return '';

  const startIndex = match.index! + match[0].length;
  let endIndex = text.length;

  // Find the earliest next section header
  for (const pattern of endPatterns) {
    const endMatch = text.slice(startIndex).match(pattern);
    if (endMatch && endMatch.index !== undefined) {
      const possibleEnd = startIndex + endMatch.index;
      if (possibleEnd < endIndex) {
        endIndex = possibleEnd;
      }
    }
  }

  return text.slice(startIndex, endIndex).trim();
}

// COVERAGE_DEFINITIONS replaced by shared SEGMENT_DEFINITIONS imported from ../constants/segment-definitions

/**
 * Detects if a coverage string entry looks like a brand list (AI error)
 * and replaces it with a real definition.
 *
 * A value is treated as a brand list when it is very short (< 25 chars)
 * or looks like a comma-separated list of proper-noun brand names.
 * Legitimate definitions (sentences with >8 words) are left untouched.
 */
function sanitizeCoverageDefinitions(coverage: string, topic: string): string {
  return coverage
    .split(';')
    .map((entry) => {
      const dashIdx = entry.indexOf(' - ');
      if (dashIdx === -1) return entry;
      const name = entry.slice(0, dashIdx).trim();
      const value = entry.slice(dashIdx + 3).trim();

      const words = value.split(/[\s,]+/).filter(Boolean);

      // If the value already looks like a proper definition sentence, keep it.
      // A proper definition has >8 words and isn't just a list of short names.
      if (words.length > 8) return entry;

      // Detect brand-list pattern:
      // - Very short value (likely "Brand1, Brand2, Brand3")
      // - OR: contains a comma with short average word length (brand names)
      const avgWordLen = words.reduce((s, w) => s + w.length, 0) / (words.length || 1);
      const hasComma = value.includes(',');
      const looksLikeBrandList = (hasComma && avgWordLen < 9) || value.length < 25;

      if (looksLikeBrandList) {
        const key = name.toLowerCase().trim();
        const definition = SEGMENT_DEFINITIONS[key] || `${name} is a segment of the ${topic} market addressing specific nutritional needs and wellness outcomes for its target consumer population.`;
        return `${name} - ${definition}`;
      }
      return entry;
    })
    .join(';');
}

/**
 * Parse AI response into structured white paper content
 * Updated for new 7-section format with Executive Summary, dual-lens analysis, and JSON chart data
 */
function parseWhitePaperResponse(text: string, topic: string): WhitePaperContent {
  const result: WhitePaperContent = {
    topic,
    // NEW FORMAT FIELDS
    productDefinition: '',
    executiveSummary: '',
    executiveSummaryChartData: undefined,
    growthFactors: '',
    opportunities: '',
    segmentAnalysisProduct: '',
    segmentAnalysisApplication: '',
    regionalAnalysis: '',
    competitionAnalysis: '',
    sources: '',
    // LEGACY FIELDS (for backward compatibility)
    summary: '',
    keyInsights: [],
    overview: '',
    marketSize: '',
    challenges: [],
    futureTrends: [],
    regulations: [],
    goToMarketStrategies: [],
  };

  // New section header patterns (8 sections in new order)
  const sectionHeaders = {
    productDefinition: /(?:^|\n)\s*(?:---\s*)?PRODUCT DEFINITION\s*(?:---)?/i,
    executiveSummary: /(?:^|\n)\s*(?:---\s*)?EXECUTIVE SUMMARY\s*(?:---)?/i,
    growthFactors: /(?:^|\n)\s*(?:---\s*)?GROWTH FACTORS\s*(?:---)?/i,
    opportunities: /(?:^|\n)\s*(?:---\s*)?OPPORTUNITIES?\s*(?:---)?/i,
    impactAnalysis: /(?:^|\n)\s*(?:---\s*)?IMPACT ANALYSIS DATA\s*(?:---)?/i,
    segmentAnalysis: /(?:^|\n)\s*(?:---\s*)?SEGMENT ANALYSIS\s*(?:---)?/i,
    regionalAnalysis: /(?:^|\n)\s*(?:---\s*)?REGIONAL ANALYSIS\s*(?:---)?/i,
    competitionAnalysis: /(?:^|\n)\s*(?:---\s*)?COMPETITION ANALYSIS\s*(?:---)?/i,
    sources: /(?:^|\n)\s*(?:---\s*)?SOURCES\s*(?:---)?/i,
  };

  // All section patterns for finding end boundaries
  const allPatterns = Object.values(sectionHeaders);

  // Extract PRODUCT DEFINITION
  const productDefText = extractSection(text, sectionHeaders.productDefinition, allPatterns);
  if (productDefText) {
    result.productDefinition = cleanupText(productDefText);
  }

  // Extract EXECUTIVE SUMMARY (includes JSON chart data)
  const execSummaryText = extractSection(text, sectionHeaders.executiveSummary, allPatterns);
  if (execSummaryText) {
    // Extract JSON chart data block from Executive Summary
    const jsonMatch = execSummaryText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        result.executiveSummaryChartData = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.warn('[WhitePaper] Failed to parse Executive Summary chart JSON:', e);
      }
    }
    // Remove JSON block from text content and clean up
    const cleanedExecSummary = cleanupText(execSummaryText.replace(/```json[\s\S]*?```/g, ''));
    result.executiveSummary = cleanedExecSummary;
    result.summary = cleanedExecSummary; // Legacy mapping
    // Extract market size text from executive summary for legacy marketSize field
    result.marketSize = cleanedExecSummary;
  }

  // Extract GROWTH FACTORS → maps to growthFactors (as string, not array)
  const growthText = extractSection(text, sectionHeaders.growthFactors, allPatterns);
  if (growthText) {
    result.growthFactors = cleanupText(growthText);
  }

  // Extract OPPORTUNITIES → maps to opportunities (as string, not array)
  const opportunitiesText = extractSection(text, sectionHeaders.opportunities, allPatterns);
  if (opportunitiesText) {
    result.opportunities = cleanupText(opportunitiesText);
  }

  // Extract SEGMENT ANALYSIS → parse into Product Type + Application Type sub-sections
  const segmentText = extractSection(text, sectionHeaders.segmentAnalysis, allPatterns);
  if (segmentText) {
    // Try to split into Product Type and Application Type sub-sections
    const productTypeMatch = segmentText.match(/(?:Sub-section 1|Segmentation by Product Type|Product Type Analysis|\*\*Sub-section 1)[\s\S]*?(?=(?:Sub-section 2|Segmentation by Application Type|Application Type Analysis|\*\*Sub-section 2)|$)/i);
    const applicationTypeMatch = segmentText.match(/(?:Sub-section 2|Segmentation by Application Type|Application Type Analysis|\*\*Sub-section 2)[\s\S]*$/i);

    if (productTypeMatch) {
      result.segmentAnalysisProduct = cleanupText(productTypeMatch[0]);
    }
    if (applicationTypeMatch) {
      result.segmentAnalysisApplication = cleanupText(applicationTypeMatch[0]);
    }

    // If we couldn't split, use entire segment text for product type
    if (!result.segmentAnalysisProduct && !result.segmentAnalysisApplication) {
      result.segmentAnalysisProduct = cleanupText(segmentText);
    }

    // Extract and strip PRODUCT_FORM_COVERAGE line from product analysis
    if (result.segmentAnalysisProduct) {
      const coverageMatch = result.segmentAnalysisProduct.match(/PRODUCT_FORM_COVERAGE:\s*(.+)/i);
      if (coverageMatch) {
        result.productFormCoverage = sanitizeCoverageDefinitions(coverageMatch[1].trim(), topic);
        result.segmentAnalysisProduct = result.segmentAnalysisProduct.replace(/\n?PRODUCT_FORM_COVERAGE:\s*.+/i, '').trim();
      }
    }

    // Extract and strip APPLICATION_TYPE_COVERAGE line from application analysis
    if (result.segmentAnalysisApplication) {
      const appCoverageMatch = result.segmentAnalysisApplication.match(/APPLICATION_TYPE_COVERAGE:\s*(.+)/i);
      if (appCoverageMatch) {
        result.applicationTypeCoverage = sanitizeCoverageDefinitions(appCoverageMatch[1].trim(), topic);
        result.segmentAnalysisApplication = result.segmentAnalysisApplication.replace(/\n?APPLICATION_TYPE_COVERAGE:\s*.+/i, '').trim();
      }
    }

    // Legacy mapping
    result.overview = result.segmentAnalysisProduct || cleanupText(segmentText);
  }

  // Extract REGIONAL ANALYSIS → maps to regionalAnalysis
  const regionalText = extractSection(text, sectionHeaders.regionalAnalysis, allPatterns);
  if (regionalText) {
    result.regionalAnalysis = cleanupText(regionalText);
    result.futureTrends = [result.regionalAnalysis]; // Legacy mapping
  }

  // Extract COMPETITION ANALYSIS → maps to competitionAnalysis
  const competitionText = extractSection(text, sectionHeaders.competitionAnalysis, allPatterns);
  if (competitionText) {
    result.competitionAnalysis = cleanupText(competitionText);
    result.goToMarketStrategies = [result.competitionAnalysis]; // Legacy mapping
  }

  // Extract SOURCES → maps to sources (preserve bullet formatting)
  const sourcesText = extractSection(text, sectionHeaders.sources, allPatterns);
  if (sourcesText) {
    result.sources = sourcesText.trim(); // Keep sources formatting intact
    result.regulations = [result.sources]; // Legacy mapping
  }

  return result;
}

/**
 * Validate AI-generated impact analysis data
 * Returns validated ImpactAnalysisChartData or null if invalid
 */
function validateImpactAnalysisData(data: unknown): ImpactAnalysisChartData | null {
  if (!data || typeof data !== 'object') return null;

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.drivers) || !Array.isArray(obj.restraints) || !Array.isArray(obj.opportunities)) {
    return null;
  }

  if (obj.drivers.length < 2 || obj.restraints.length < 2 || obj.opportunities.length < 2) {
    return null;
  }

  const validateFactor = (factor: unknown, expectedCategory: string): ImpactFactor | null => {
    if (!factor || typeof factor !== 'object') return null;
    const f = factor as Record<string, unknown>;

    if (typeof f.name !== 'string' || !f.name) return null;
    if (typeof f.fullName !== 'string' || !f.fullName) return null;
    if (typeof f.impact !== 'number' || f.impact < 0 || f.impact > 100) return null;

    // Normalize level based on actual impact score
    let level: 'High' | 'Medium' | 'Low';
    if (f.impact >= 75) level = 'High';
    else if (f.impact >= 50) level = 'Medium';
    else level = 'Low';

    return {
      name: f.name.slice(0, 40),
      fullName: f.fullName.slice(0, 80),
      impact: Math.round(f.impact),
      level,
      category: expectedCategory as ImpactFactor['category'],
    };
  };

  const drivers = obj.drivers.map(d => validateFactor(d, 'driver')).filter(Boolean) as ImpactFactor[];
  const restraints = obj.restraints.map(r => validateFactor(r, 'restraint')).filter(Boolean) as ImpactFactor[];
  const opportunities = obj.opportunities.map(o => validateFactor(o, 'opportunity')).filter(Boolean) as ImpactFactor[];

  if (drivers.length < 2 || restraints.length < 2 || opportunities.length < 2) {
    return null;
  }

  // Sort each category by impact descending
  drivers.sort((a, b) => b.impact - a.impact);
  restraints.sort((a, b) => b.impact - a.impact);
  opportunities.sort((a, b) => b.impact - a.impact);

  return { drivers, restraints, opportunities };
}

/**
 * Extract numeric market data from generated content for validation
 * Handles both global (USD) and Indian (INR) market data
 */
function extractMarketData(marketSizeSection: string): ExtractedMarketData {
  const result: ExtractedMarketData = {
    // India market data
    marketSize2026: null,
    marketSize2033: null,
    cagr: null,
    // Global market data
    globalMarketSize2026: null,
    globalMarketSize2033: null,
    globalCagr: null,
  };

  // Extract Indian 2026 market size (₹X Crores in 2026 or INR X Crores in 2026)
  const indiaSize2026Match = marketSizeSection.match(/(?:₹|INR)\s*([\d,]+(?:\.\d+)?)\s*(?:Crores?|Cr).*?(?:in\s*)?2026/i);
  if (indiaSize2026Match) {
    result.marketSize2026 = parseFloat(indiaSize2026Match[1].replace(/,/g, ''));
  }

  // Extract Indian 2033 market size
  const indiaSize2033Match = marketSizeSection.match(/(?:₹|INR)\s*([\d,]+(?:\.\d+)?)\s*(?:Crores?|Cr).*?(?:by\s*)?2033/i);
  if (indiaSize2033Match) {
    result.marketSize2033 = parseFloat(indiaSize2033Match[1].replace(/,/g, ''));
  }

  // Extract Indian CAGR (look for "Indian CAGR" or just "CAGR" after Indian context)
  const indiaCagrMatch = marketSizeSection.match(/(?:Indian|India)\s*(?:market\s*)?CAGR[^0-9]*([\d.]+)\s*%/i)
    || marketSizeSection.match(/CAGR[^0-9]*([\d.]+)\s*%/i);
  if (indiaCagrMatch) {
    result.cagr = parseFloat(indiaCagrMatch[1]);
  }

  // Extract Global 2026 market size ($X Billion or USD X Billion in 2026)
  const globalSize2026Match = marketSizeSection.match(/(?:\$|USD)\s*([\d,]+(?:\.\d+)?)\s*(?:Billion|B).*?(?:in\s*)?2026/i);
  if (globalSize2026Match) {
    result.globalMarketSize2026 = parseFloat(globalSize2026Match[1].replace(/,/g, ''));
  }

  // Extract Global 2033 market size
  const globalSize2033Match = marketSizeSection.match(/(?:\$|USD)\s*([\d,]+(?:\.\d+)?)\s*(?:Billion|B).*?(?:by\s*)?2033/i);
  if (globalSize2033Match) {
    result.globalMarketSize2033 = parseFloat(globalSize2033Match[1].replace(/,/g, ''));
  }

  // Extract Global CAGR
  const globalCagrMatch = marketSizeSection.match(/(?:Global|global)\s*(?:market\s*)?CAGR[^0-9]*([\d.]+)\s*%/i);
  if (globalCagrMatch) {
    result.globalCagr = parseFloat(globalCagrMatch[1]);
  }

  return result;
}

/**
 * Extract ALL market references from ALL sections of the whitepaper
 * Used for cross-section consistency validation
 */
function extractAllMarketReferences(content: WhitePaperContent): MarketReference[] {
  const references: MarketReference[] = [];

  // Sections to scan for market data
  const sectionsToScan: Array<{ key: string; value: string | undefined }> = [
    { key: 'executiveSummary', value: content.executiveSummary },
    { key: 'growthFactors', value: typeof content.growthFactors === 'string' ? content.growthFactors : content.growthFactors?.[0] },
    { key: 'opportunities', value: typeof content.opportunities === 'string' ? content.opportunities : content.opportunities?.[0] },
    { key: 'segmentAnalysisProduct', value: content.segmentAnalysisProduct },
    { key: 'segmentAnalysisApplication', value: content.segmentAnalysisApplication },
    { key: 'regionalAnalysis', value: content.regionalAnalysis },
    { key: 'competitionAnalysis', value: content.competitionAnalysis },
  ];

  // Patterns to extract market values
  const patterns = {
    // Global market values (USD)
    global_2026: /\$\s*([\d,.]+)\s*(?:billion|B).*?(?:in\s*)?2026/gi,
    global_2033: /\$\s*([\d,.]+)\s*(?:billion|B).*?(?:by\s*)?2033/gi,
    global_cagr: /(?:global|worldwide)\s*(?:market\s*)?CAGR[^0-9]*([\d.]+)\s*%/gi,
    // India market values (INR Crores)
    india_2026: /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)\s*(?:Crores?|Cr).*?(?:in\s*)?2026/gi,
    india_2033: /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)\s*(?:Crores?|Cr).*?(?:by\s*)?2033/gi,
    india_cagr: /(?:Indian?|India's)\s*(?:market\s*)?(?:CAGR|growth)[^0-9]*([\d.]+)\s*%/gi,
  };

  for (const section of sectionsToScan) {
    if (!section.value) continue;

    const text = section.value;

    // Extract each type of market reference
    for (const [type, pattern] of Object.entries(patterns)) {
      // Reset regex lastIndex
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const value = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(value) && value > 0) {
          references.push({
            section: section.key,
            type: type as MarketReference['type'],
            value,
            rawText: match[0],
          });
        }
      }
    }
  }

  return references;
}

/**
 * Validate that market data is consistent across all sections
 * Returns validation result with any mismatches found
 */
function validateCrossSectionConsistency(references: MarketReference[]): ConsistencyValidationResult {
  const mismatches: ConsistencyValidationResult['mismatches'] = [];

  // Group references by type
  const grouped = references.reduce((acc, ref) => {
    if (!acc[ref.type]) acc[ref.type] = [];
    acc[ref.type].push({ section: ref.section, value: ref.value });
    return acc;
  }, {} as Record<string, Array<{ section: string; value: number }>>);

  // Check each type for consistency
  for (const [type, values] of Object.entries(grouped)) {
    if (values.length <= 1) continue; // Need at least 2 values to compare

    // Find min and max values
    const numericValues = values.map(v => v.value);
    const minValue = Math.min(...numericValues);
    const maxValue = Math.max(...numericValues);

    // Calculate deviation percentage
    const deviation = minValue > 0 ? ((maxValue - minValue) / minValue) * 100 : 0;

    // If deviation exceeds tolerance, record mismatch
    if (deviation > CONSISTENCY_TOLERANCE_PERCENT) {
      mismatches.push({
        type,
        values,
        deviation: Math.round(deviation * 10) / 10,
      });
    }
  }

  return {
    isValid: mismatches.length === 0,
    mismatches,
  };
}

/**
 * Normalize market references across sections to match Executive Summary values
 * Used as fallback when regeneration doesn't fix inconsistencies
 */
function normalizeToExecutiveSummary(content: WhitePaperContent): WhitePaperContent {
  // Extract canonical values from Executive Summary
  const execSummary = content.executiveSummary || '';
  const canonicalData = extractMarketData(execSummary);

  // If no canonical values found, return content as-is
  if (!canonicalData.marketSize2026 && !canonicalData.globalMarketSize2026) {
    console.log('[WhitePaper] No canonical values found in Executive Summary for normalization');
    return content;
  }

  console.log('[WhitePaper] Normalizing content to Executive Summary values:');
  console.log(`  - India 2026: ₹${canonicalData.marketSize2026} Cr`);
  console.log(`  - India 2033: ₹${canonicalData.marketSize2033} Cr`);
  console.log(`  - India CAGR: ${canonicalData.cagr}%`);
  console.log(`  - Global 2026: $${canonicalData.globalMarketSize2026}B`);
  console.log(`  - Global 2033: $${canonicalData.globalMarketSize2033}B`);
  console.log(`  - Global CAGR: ${canonicalData.globalCagr}%`);

  // Helper to normalize text by replacing similar but different values
  const normalizeSection = (text: string | undefined): string => {
    if (!text) return '';
    let normalized = text;

    // Normalize India market values (allow ±15% variance to match)
    if (canonicalData.marketSize2026) {
      const target = canonicalData.marketSize2026;
      // Match INR values that are within 15% of canonical
      normalized = normalized.replace(
        /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)\s*(?:Crores?|Cr)(.*?)(?:in\s*)?2026/gi,
        (match, valueStr) => {
          const value = parseFloat(valueStr.replace(/,/g, ''));
          const deviation = Math.abs(value - target) / target;
          if (deviation > 0.05 && deviation < 0.20) {
            // Replace with canonical value
            return `₹${target.toLocaleString('en-IN')} Crores in 2026`;
          }
          return match;
        }
      );
    }

    if (canonicalData.marketSize2033) {
      const target = canonicalData.marketSize2033;
      normalized = normalized.replace(
        /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)\s*(?:Crores?|Cr)(.*?)(?:by\s*)?2033/gi,
        (match, valueStr) => {
          const value = parseFloat(valueStr.replace(/,/g, ''));
          const deviation = Math.abs(value - target) / target;
          if (deviation > 0.05 && deviation < 0.20) {
            return `₹${target.toLocaleString('en-IN')} Crores by 2033`;
          }
          return match;
        }
      );
    }

    // Normalize Global market values
    if (canonicalData.globalMarketSize2026) {
      const target = canonicalData.globalMarketSize2026;
      normalized = normalized.replace(
        /\$\s*([\d,.]+)\s*(?:billion|B)(.*?)(?:in\s*)?2026/gi,
        (match, valueStr) => {
          const value = parseFloat(valueStr.replace(/,/g, ''));
          const deviation = Math.abs(value - target) / target;
          if (deviation > 0.05 && deviation < 0.20) {
            return `$${target} Billion in 2026`;
          }
          return match;
        }
      );
    }

    if (canonicalData.globalMarketSize2033) {
      const target = canonicalData.globalMarketSize2033;
      normalized = normalized.replace(
        /\$\s*([\d,.]+)\s*(?:billion|B)(.*?)(?:by\s*)?2033/gi,
        (match, valueStr) => {
          const value = parseFloat(valueStr.replace(/,/g, ''));
          const deviation = Math.abs(value - target) / target;
          if (deviation > 0.05 && deviation < 0.20) {
            return `$${target} Billion by 2033`;
          }
          return match;
        }
      );
    }

    return normalized;
  };

  // Create normalized content
  const normalizedContent: WhitePaperContent = {
    ...content,
    // Don't normalize Executive Summary - it's the source of truth
    growthFactors: normalizeSection(typeof content.growthFactors === 'string' ? content.growthFactors : content.growthFactors?.[0]),
    opportunities: normalizeSection(typeof content.opportunities === 'string' ? content.opportunities : content.opportunities?.[0]),
    segmentAnalysisProduct: normalizeSection(content.segmentAnalysisProduct),
    segmentAnalysisApplication: normalizeSection(content.segmentAnalysisApplication),
    regionalAnalysis: normalizeSection(content.regionalAnalysis),
    competitionAnalysis: normalizeSection(content.competitionAnalysis),
  };

  return normalizedContent;
}

/**
 * Validate extracted market data against benchmarks
 */
function validateGeneratedMarketData(
  extracted: ExtractedMarketData,
  benchmark: MarketBenchmark
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check if 2026 size is within benchmark range (with 50% tolerance for flexibility)
  if (extracted.marketSize2026) {
    const minAllowed = benchmark.sizeRange2026.min * 0.5;
    const maxAllowed = benchmark.sizeRange2026.max * 2;
    if (extracted.marketSize2026 < minAllowed || extracted.marketSize2026 > maxAllowed) {
      issues.push(
        `2026 market size (${extracted.marketSize2026} Cr) outside expected range ` +
        `(${benchmark.sizeRange2026.min}-${benchmark.sizeRange2026.max} Cr for ${benchmark.tier} segment)`
      );
    }
  }

  // Check CAGR within bounds (with some tolerance)
  if (extracted.cagr) {
    const minAllowed = benchmark.cagrRange.min - 3;
    const maxAllowed = benchmark.cagrRange.max + 5;
    if (extracted.cagr < minAllowed || extracted.cagr > maxAllowed) {
      issues.push(
        `CAGR (${extracted.cagr}%) outside expected range ` +
        `(${benchmark.cagrRange.min}-${benchmark.cagrRange.max}% for ${benchmark.tier} segment)`
      );
    }
    // Hard cap at 40% - no segment should have higher CAGR
    if (extracted.cagr > 40) {
      issues.push(`CAGR (${extracted.cagr}%) exceeds maximum realistic value of 40%`);
    }
  }

  // Check mathematical consistency (India)
  if (extracted.marketSize2026 && extracted.marketSize2033 && extracted.cagr) {
    const validation = validateMarketSizeConsistency(
      extracted.marketSize2026,
      extracted.marketSize2033,
      extracted.cagr
    );
    if (!validation.isValid) {
      issues.push(
        `2033 size (${extracted.marketSize2033} Cr) doesn't match CAGR calculation. ` +
        `Expected: ~${validation.expectedSize2033} Cr (${validation.deviation}% deviation)`
      );
    }
  }

  // Validate global 2026 market size against benchmark range
  if (extracted.globalMarketSize2026) {
    const minAllowed = benchmark.globalSizeRange2026.min * 0.5;
    const maxAllowed = benchmark.globalSizeRange2026.max * 2;
    if (extracted.globalMarketSize2026 < minAllowed || extracted.globalMarketSize2026 > maxAllowed) {
      issues.push(
        `Global 2026 size ($${extracted.globalMarketSize2026}B) outside expected range ` +
        `($${benchmark.globalSizeRange2026.min}-$${benchmark.globalSizeRange2026.max}B for ${benchmark.tier} segment)`
      );
    }
  }

  // Validate global CAGR
  if (extracted.globalCagr) {
    const minAllowed = benchmark.globalCagrRange.min - 3;
    const maxAllowed = benchmark.globalCagrRange.max + 5;
    if (extracted.globalCagr < minAllowed || extracted.globalCagr > maxAllowed) {
      issues.push(
        `Global CAGR (${extracted.globalCagr}%) outside expected range ` +
        `(${benchmark.globalCagrRange.min}-${benchmark.globalCagrRange.max}% for ${benchmark.tier} segment)`
      );
    }
    if (extracted.globalCagr > 40) {
      issues.push(`Global CAGR (${extracted.globalCagr}%) exceeds maximum realistic value of 40%`);
    }
  }

  // Validate global mathematical consistency
  if (extracted.globalMarketSize2026 && extracted.globalMarketSize2033 && extracted.globalCagr) {
    const validation = validateMarketSizeConsistency(
      extracted.globalMarketSize2026,
      extracted.globalMarketSize2033,
      extracted.globalCagr
    );
    if (!validation.isValid) {
      issues.push(
        `Global 2033 size ($${extracted.globalMarketSize2033}B) doesn't match CAGR calculation. ` +
        `Expected: ~$${validation.expectedSize2033}B (${validation.deviation}% deviation)`
      );
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Build the constrained prompt with market context
 * Updated with global-to-India lens, dual-lens analysis, and Executive Summary chart
 */
function buildConstrainedPrompt(topic: string, context: MarketContext, currentExchangeRate: number): string {
  const { benchmark } = context;
  const tierDesc = getTierDescription(benchmark.tier);

  // Build market size constraints section based on data tier
  let marketConstraints: string;

  if (context.dataTier === 'specific') {
    // Tier 1: Exact verified figures from Perplexity for this specific topic
    marketConstraints = `### VERIFIED MARKET DATA (use these exact values):
**Global Market:**
- 2026 Global Market Size: ${context.verifiedGlobalMarketSize2026}
- 2033 Global Market Size: ${context.verifiedGlobalMarketSize2033}
- Global CAGR: ${context.verifiedGlobalCagr}

**Indian Market:**
- 2026 Indian Market Size: ${context.verifiedMarketSize2026}
- 2033 Indian Market Size: ${context.verifiedMarketSize2033}
- Indian CAGR: ${context.verifiedCagr}
- Data Sources: ${context.dataSources.join(', ')}`;

  } else if (context.dataTier === 'broader') {
    // Tier 2: Broader category data from Perplexity
    marketConstraints = `### BROADER MARKET DATA (from the "${context.broaderCategory}" market):
IMPORTANT: This data is for the broader "${context.broaderCategory}" market, not specifically for "${topic}".
Frame the market context as: "The ${context.broaderCategory} market, within which ${topic} is a key segment..."
Do NOT claim these figures are specifically for ${topic} alone.

**Global ${context.broaderCategory} Market:**
- 2026 Global Market Size: ${context.verifiedGlobalMarketSize2026}
- 2033 Global Market Size: ${context.verifiedGlobalMarketSize2033}
- Global CAGR: ${context.verifiedGlobalCagr}

**Indian ${context.broaderCategory} Market:**
- 2026 Indian Market Size: ${context.verifiedMarketSize2026}
- 2033 Indian Market Size: ${context.verifiedMarketSize2033}
- Indian CAGR: ${context.verifiedCagr}
- Data Sources: ${context.dataSources.join(', ')}
- Note: Discuss ${topic} qualitatively within this broader market context. Focus on ${topic}'s role, applications, and growth potential as a sub-segment.`;

  } else {
    // Tier 3: Curated benchmark ranges
    marketConstraints = `### INDUSTRY BENCHMARK DATA (estimated ranges for the "${context.broaderCategory}" segment):
IMPORTANT: Specific market research data for "${topic}" is limited. These are curated industry benchmark ranges.
Frame as: "The ${context.broaderCategory} segment is estimated at..." and note that ${topic} represents a growing sub-segment.
Present figures as ranges where provided, not single exact values.

**Global ${context.broaderCategory} Market (estimated ranges):**
- 2026 Global Market Size: ${context.verifiedGlobalMarketSize2026}
- 2033 Global Market Size: ${context.verifiedGlobalMarketSize2033}
- Global CAGR: ${context.verifiedGlobalCagr}

**Indian ${context.broaderCategory} Market (estimated ranges):**
- 2026 Indian Market Size: ${context.verifiedMarketSize2026}
- 2033 Indian Market Size: ${context.verifiedMarketSize2033}
- Indian CAGR: ${context.verifiedCagr}
- Source: Industry Benchmark Estimates
- Note: Describe ${topic} qualitatively as a sub-segment. Do not fabricate specific sub-segment market sizes.`;
  }

  // Strict data consistency rules to prevent contradictory values across sections
  const dataConsistencyRules = `
### CRITICAL: CROSS-SECTION DATA CONSISTENCY RULES

You MUST establish canonical market values in the Executive Summary and use ONLY these EXACT values throughout the ENTIRE document. This is mandatory to prevent contradictory data.

**BINDING RULES:**
1. In your Executive Summary, you will define these 6 canonical values:
   - GLOBAL_MARKET_2026: The exact USD Billion value for global market in 2026
   - GLOBAL_MARKET_2033: The exact USD Billion value for global market in 2033
   - GLOBAL_CAGR: The exact CAGR percentage for global market
   - INDIA_MARKET_2026: The exact INR Crores value for Indian market in 2026
   - INDIA_MARKET_2033: The exact INR Crores value for Indian market in 2033
   - INDIA_CAGR: The exact CAGR percentage for Indian market

2. In ALL subsequent sections (Growth Factors, Opportunities, Segment Analysis, Regional Analysis, Competition Analysis):
   - Do NOT mention any market size figures (the prompt explicitly forbids this in other sections)
   - If you MUST reference market data, use the EXACT values from Executive Summary
   - Do NOT round differently (if ₹2,000 Cr in Exec Summary, don't write "~₹2,000 Cr" or "₹2,100 Cr" elsewhere)
   - Do NOT use approximations like "nearly $2B" if the exact value is "$1.8B"
   - Do NOT estimate percentages of the market unless you calculate from the EXACT base value

3. Mathematical consistency across the document:
   - 2033 value = 2026 value × (1 + CAGR/100)^7
   - India's percentage of global market must be consistent if mentioned multiple times
   - Any regional/segment percentage breakdowns must add up correctly

**WHY THIS MATTERS:** Contradictory market figures across sections destroys credibility. A C-suite reader will immediately notice if Executive Summary says "$1.5B" but Opportunities says "~$2B market".
`;

  return `You are a senior market research analyst at a top-tier consulting/market research firm (like McKinsey, BCG, or Coherent Market Insights). Generate a comprehensive white paper report about "${topic}" in the nutraceutical industry with a global-to-India lens.

## MARKET DATA PARAMETERS

${marketConstraints}
${dataConsistencyRules}

### REGIONAL DATA FOR THIS SEGMENT (INDIA):
- Dominating State/Region: ${benchmark.dominatingRegion}
- Fastest Growing State/Region: ${benchmark.fastestGrowingRegion}

### KEY INDIAN PLAYERS FOR THIS SEGMENT:
${benchmark.keyPlayers.join(', ')}

### SEGMENTATION:
- Primary Segmentation by Product Type (segment1): ${benchmark.segmentationType}
- Product Sub-segments (segment2): ${benchmark.dominantSegment} and related sub-segments
- Dominant Product Segment (segment3): ${benchmark.dominantSegment}
- Primary Segmentation by Application Type (segment4): ${benchmark.applicationSegmentation || 'application'}
- Application Sub-segments (segment5): ${benchmark.dominantApplicationSegment || 'Dietary Supplements'} and related application sub-segments
- Dominant Application Segment (segment6): ${benchmark.dominantApplicationSegment || 'Dietary Supplements'}

---

## WHITE PAPER SECTIONS (use these EXACT headers in this EXACT order)

---
PRODUCT DEFINITION

Write a concise product definition for "${topic}" in 2-4 sentences (50-80 words). Cover:
1. What the product is — its composition, source, and key characteristics
2. Where it is used — whether as a raw material (ingredient in other products), as a finished consumer product, or both
3. Key application contexts (e.g., food & beverage, pharmaceutical, personal care, sports nutrition)

**Critical Rules:**
- Do NOT include any market size figures, CAGR, or growth rate percentages
- Do NOT reference companies or brands
- Be factual and definitional — this is a product encyclopedia entry, not marketing copy
- Keep it to 2-4 sentences maximum (50-80 words)
- Do NOT add a separate heading line — start directly with the definition
- Start with: "${topic} is..."

---
EXECUTIVE SUMMARY

You are a senior market research analyst writing the executive summary for a white paper on the ${topic} Market. This is the opening section and must be sharp, data-dense, and concise. Write the executive summary in approximately 50–100 words total, structured into three tightly written sub-sections. Every word must earn its place — no filler, no generic commentary.

**Sub-section 1: Market Sizing (2–3 sentences)**

Provide the global and Indian market size in a compact format:
"The global ${topic} Market is valued at $[GLOBAL VALUE] Billion in 2026, projected to reach $[GLOBAL 2033 VALUE] Billion by 2033 at a CAGR of [GLOBAL CAGR]%. The Indian market stands at ₹[INDIAN VALUE] Crores in 2026, expected to grow to ₹[INDIAN 2033 VALUE] Crores by 2033 at [INDIAN CAGR]% CAGR."

VALIDATION CHECK: Ensure 2033 value = 2026 value × (1 + CAGR/100)^7 for BOTH global and Indian figures independently.

**Sub-section 2: Future Outlook (1–2 sentences)**

One sentence on global trajectory (personalized nutrition, regulatory harmonization, pharma-nutra convergence) and one sentence on India-specific outlook (Ayurveda-nutra convergence, e-pharmacy growth, D2C proliferation, CDMO positioning).

**Sub-section 3: Global vs. Indian Trend Comparison (1–2 sentences)**

A crisp comparative insight: where India leads (Ayurvedic heritage, cost-effective manufacturing), where it lags (clinical validation, export certifications), and the key convergence point.

**GRAPH DATA OUTPUT (for Recharts bar chart):**
After the written executive summary, output the following JSON block that will be used to render a side-by-side bar chart comparing global and Indian market sizes. Use the EXACT format below:

\`\`\`json
{
  "chartData": [
    {
      "year": "2026",
      "global": [GLOBAL 2026 VALUE IN BILLIONS USD],
      "india": [INDIAN 2026 VALUE IN BILLIONS USD]
    },
    {
      "year": "2033",
      "global": [GLOBAL 2033 VALUE IN BILLIONS USD],
      "india": [INDIAN 2033 VALUE IN BILLIONS USD]
    }
  ],
  "metadata": {
    "globalCagr": "[GLOBAL CAGR]%",
    "indiaCagr": "[INDIAN CAGR]%",
    "globalCurrency": "USD Billion",
    "indiaCurrency": "USD Billion",
    "conversionNote": "Indian values converted at approximate exchange rate for chart comparison"
  }
}
\`\`\`

NOTE: Convert the Indian market value from ₹ Crores to USD Billion for the chart comparison using the current exchange rate (₹${currentExchangeRate} = $1). This conversion is ONLY for the chart; the written content must use ₹ Crores for Indian values.

---
GROWTH FACTORS

You are a senior market research analyst writing the Growth Factors section of a white paper on the Indian ${topic} Market. This section is a critical component of the report — it must explain the specific, tangible forces driving market growth within India's nutraceutical ecosystem. Write approximately 150 words as a single cohesive, flowing paragraph.

**Structure:**
- Write in long-form paragraph style — NO bullet points, NO numbered lists, NO sub-headings within this section
- Do NOT add a separate heading — the section title "GROWTH FACTORS" serves as the heading
- Write like an experienced analyst delivering insights to a C-suite audience — authoritative, specific, and grounded in India's market reality

**Mandatory India-Specific Growth Factors to Cover (weave these naturally into the narrative):**

1. Government Initiatives & Policy Tailwinds:
   - Ayushman Bharat's impact on healthcare accessibility and preventive health awareness
   - Production Linked Incentive (PLI) schemes for pharmaceuticals and their spillover into nutraceuticals
   - Make in India initiative encouraging domestic manufacturing capacity expansion
   - National AYUSH Mission promoting traditional medicine-based supplementation

2. Epidemiological & Demographic Drivers:
   - Rising lifestyle diseases: diabetes (India as world's diabetes capital with 100M+ patients), cardiovascular conditions, obesity, PCOS among women
   - Growing geriatric population requiring nutritional supplementation
   - Young, health-conscious demographic (median age ~28) driving fitness and sports nutrition demand

3. Economic & Consumption Drivers:
   - Expanding middle class with increasing purchasing power
   - Growing health awareness penetrating rural India through digital health platforms and government campaigns
   - Shift from treatment-based to prevention-based healthcare spending

4. Distribution & Access Drivers:
   - Explosive growth of e-commerce platforms: Amazon India, Flipkart
   - E-pharmacy penetration: 1mg, PharmEasy, Netmeds enabling direct consumer access
   - Organized retail expansion: Reliance Retail, DMart, Apollo Pharmacy, MedPlus creating shelf space for nutraceuticals
   - D2C brands leveraging social media and influencer marketing to build direct consumer relationships

5. Regulatory Enablers:
   - FSSAI's evolving regulatory framework providing clearer guidelines for nutraceutical claims
   - Favorable regulatory environment compared to pharmaceuticals (lower barriers to entry)
   - Growing acceptance of AYUSH certifications alongside allopathic recommendations

**Critical Rules:**
- Do NOT include any market size figures, CAGR, or growth rate percentages anywhere in this section
- Do NOT reference or cite any market research firm reports
- Do NOT add an introduction or conclusion — dive directly into the growth factors
- Do NOT use any bullet points or lists — this must be a flowing analytical narrative
- Do NOT add a separate heading line — start directly with the content

Start with: "The Indian ${topic} market is witnessing robust expansion driven by..."

---
OPPORTUNITIES

You are a senior market research analyst writing the Opportunities section of a white paper on the Indian ${topic} Market. This section must identify and articulate the most impactful, actionable business opportunities that stakeholders can capitalize on within India's nutraceutical ecosystem. Write approximately 200 words.

**Structure:**
- Write as a flowing analytical narrative in long-form paragraph style — NO bullet points, NO numbered lists
- Do NOT add a separate heading — the section title "OPPORTUNITIES" serves as the heading
- Frame opportunities as actionable strategic insights for manufacturers, investors, and distributors — not generic industry commentary

**Mandatory India-Specific Opportunities to Cover (weave these naturally into the narrative):**

1. Untapped Market Penetration:
   - Rural market potential: Research and cite current India rural population statistics, highlighting increasing digital health awareness but minimal nutraceutical penetration
   - Tier-2 and tier-3 city expansion: Rising aspirational consumption and growing organized retail footprint
   - Regional language digital platforms enabling health education and product discovery in vernacular languages

2. Export & Global Positioning:
   - Export opportunities to SAARC countries (Nepal, Bangladesh, Sri Lanka), Middle East (UAE, Saudi Arabia), and Africa leveraging India's cost-competitive manufacturing
   - Contract Development and Manufacturing Organization (CDMO) opportunity: India as the "pharmacy of the world" extending into nutraceuticals
   - Leveraging India's Traditional Knowledge Digital Library (TKDL) for unique Ayurvedic formulations with global IP potential

3. Product Innovation & Niche Segments:
   - Ayurveda-based nutraceutical innovation combining ancient formulations with modern bioavailability technologies (nanoemulsions, liposomal delivery)
   - Women's health supplements: prenatal nutrition, menopause support, PCOS management — a largely underserved but rapidly growing segment
   - Sports and fitness nutrition driven by gym culture boom in metros and tier-1 cities
   - Geriatric nutrition for India's aging population (projected 140 million+ elderly by 2030)
   - Personalized nutrition powered by AI, genomics, and gut microbiome analysis — early-stage but high-potential

4. Strategic & Policy-Driven Opportunities:
   - Government's PLI scheme incentives reducing manufacturing costs
   - Free Trade Agreements (FTAs) opening new export corridors
   - Special Economic Zones (SEZs) and nutraceutical-specific industrial parks offering infrastructure benefits
   - Public-private partnerships for clinical validation of traditional formulations

5. Distribution & Technology-Enabled Opportunities:
   - Subscription-based nutrition models through D2C platforms
   - WhatsApp Commerce and social selling networks for direct consumer engagement
   - Integration with telemedicine platforms for practitioner-recommended supplementation
   - Cold chain logistics improvements enabling sensitive product distribution (probiotics, omega-3s)

**Critical Rules:**
- Do NOT include market size figures, CAGR, or growth rate percentages
- Do NOT add a conclusion — end the narrative on a forward-looking strategic note without a formal conclusion paragraph
- Do NOT reference or cite any market research firm reports
- Do NOT add a separate heading line — start directly with the content
- Write as an analyst providing strategic foresight, not as a textbook listing opportunities

Start with: "India's ${topic} market presents a constellation of high-potential opportunities that..."

---
IMPACT ANALYSIS DATA

Based on the Growth Factors and Opportunities you just wrote about, generate structured impact analysis data for the Indian ${topic} market.

**IMPORTANT:** This is a JSON-only output section. Do NOT write any prose. Output ONLY the JSON block below.

\`\`\`impact_json
{
  "drivers": [
    {
      "name": "<Short label, 2-4 words>",
      "fullName": "<Descriptive sentence, 8-15 words>",
      "impact": <number 60-98>,
      "level": "<High|Medium|Low>",
      "category": "driver"
    }
  ],
  "restraints": [
    {
      "name": "<Short label, 2-4 words>",
      "fullName": "<Descriptive sentence, 8-15 words>",
      "impact": <number 40-80>,
      "level": "<High|Medium|Low>",
      "category": "restraint"
    }
  ],
  "opportunities": [
    {
      "name": "<Short label, 2-4 words>",
      "fullName": "<Descriptive sentence, 8-15 words>",
      "impact": <number 60-95>,
      "level": "<High|Medium|Low>",
      "category": "opportunity"
    }
  ]
}
\`\`\`

RULES:
- Generate exactly 3-5 drivers, 3-4 restraints, and 3-4 opportunities
- All factors MUST be specific to the Indian ${topic} market (not generic)
- Impact scores must be integers: High = 75-98, Medium = 50-74, Low = 25-49
- The "level" field MUST be consistent with the impact score range
- Drivers should reflect the growth factors you described above
- Restraints should cover regulatory, cost, quality, and supply chain barriers specific to India
- Opportunities should reflect the strategic opportunities you described above
- The "name" field is a short chart label; "fullName" is shown on display
- This JSON block must be valid, parseable JSON

---
SEGMENT ANALYSIS

You are a senior market research analyst writing the Segment Analysis section of a white paper on the Indian ${topic} Market. This section must provide a dual-lens segmentation covering both product type and application type. Write approximately 350 words total, divided into two clearly defined sub-sections.

**Sub-section 1: Segmentation by Product Type (~175 words)**

Market Segmentation Context:
In terms of ${benchmark.segmentationType}, the Indian ${topic} Market is segmented into ${benchmark.dominantSegment} and related sub-segments. Among all product segments, ${benchmark.dominantSegment} contributes the highest share of the market.

Write a focused analytical narrative on why ${benchmark.dominantSegment} dominates the Indian market. Cover:
- Specific factors driving this product segment's growth within the Indian nutraceutical ecosystem
- FSSAI regulations and compliance requirements relevant to this product type
- AYUSH guidelines and how traditional medicine integration supports this segment
- Consumer behavior drivers: growing health consciousness, Ayurvedic trust factor, convenience preferences
- Tier-2 and tier-3 city adoption patterns for this product type
- How traditional Ayurvedic heritage is being integrated with modern nutraceutical delivery formats in this segment
- Key Indian brands leading this product segment and their differentiation strategies

IMPORTANT: At the very END of Sub-section 1, after the narrative paragraph, include a line in this EXACT format:
PRODUCT_FORM_COVERAGE: [Form1] - [complete sentence definition 25-40 words]; [Form2] - [complete sentence definition 25-40 words]; [Form3] - [complete sentence definition 25-40 words]

CORRECT EXAMPLE (follow this pattern exactly):
PRODUCT_FORM_COVERAGE: Whey Protein - Whey protein is a fast-digesting, dairy-derived complete protein containing all essential amino acids, widely used for post-workout muscle recovery and lean muscle synthesis.; Casein Protein - Casein protein is a slow-digesting, milk-derived protein that provides a sustained release of amino acids over several hours, making it ideal for overnight muscle repair.; Plant Protein - Plant protein is a vegan-friendly protein sourced from peas, soy, rice, or hemp that offers a dairy-free alternative for muscle building and balanced nutrition.

WRONG EXAMPLE (never do this — no brand names allowed):
PRODUCT_FORM_COVERAGE: Whey Protein - MuscleBlaze, Optimum Nutrition, HealthKart; Casein Protein - AS-IT-IS, GNC

Each entry must be a complete, grammatically correct sentence (25-40 words) that clearly explains WHAT the segment IS — covering its source, mechanism of action, or key functional benefit. NEVER list brand names, company names, or product names after the dash. Segments to cover: ${benchmark.segmentDistribution?.map((s: { name: string }) => s.name).join(', ') || 'all forms'}. Output as a single semicolon-separated line.

Start with: "In terms of ${benchmark.segmentationType}, ${benchmark.dominantSegment} contributes the highest share of the Indian ${topic} market owing to..."

**Sub-section 2: Segmentation by Application Type (~175 words)**

Application Segmentation Context:
In terms of application type, the Indian ${topic} Market is segmented into ${benchmark.dominantApplicationSegment || 'Dietary Supplements'} and related application sub-segments. Among all application segments, ${benchmark.dominantApplicationSegment || 'Dietary Supplements'} holds the largest share of the market.

Write a focused analytical narrative on why ${benchmark.dominantApplicationSegment || 'Dietary Supplements'} dominates the Indian market by application. Cover:
- Specific health conditions or wellness needs driving demand for this application in India
- Epidemiological context: prevalence of relevant health conditions in the Indian population (e.g., diabetes rates, vitamin deficiencies, lifestyle disease burden)
- Consumer demographics most aligned with this application (age groups, urban vs. rural, gender-specific needs)
- Practitioner influence: role of doctors, Ayurvedic practitioners, dietitians, and fitness trainers in driving this application segment
- Regulatory landscape: FSSAI approved health claims relevant to this application, AYUSH product categories
- Distribution channel preferences for this application type (pharmacy-led, e-commerce, D2C, practitioner-recommended)
- How D2C brands and e-pharmacy platforms are expanding access to this application segment
- Emerging sub-applications or use-cases gaining traction within this category

Start with: "In terms of application type, ${benchmark.dominantApplicationSegment || 'Dietary Supplements'} holds the largest share of the Indian ${topic} market driven by..."

IMPORTANT: At the very END of Sub-section 2, after the narrative paragraph, include a line in this EXACT format:
APPLICATION_TYPE_COVERAGE: [App1] - [complete sentence definition 25-40 words]; [App2] - [complete sentence definition 25-40 words]; [App3] - [complete sentence definition 25-40 words]

CORRECT EXAMPLE (follow this pattern exactly):
APPLICATION_TYPE_COVERAGE: Sports Nutrition - Sports nutrition encompasses supplements specifically formulated to enhance athletic performance, support endurance, accelerate post-exercise recovery, and optimize body composition in active individuals and professional athletes.; Weight Management - Weight management products are formulations designed to support healthy body composition by targeting caloric balance, metabolic rate, appetite regulation, and fat oxidation mechanisms.; Clinical Nutrition - Clinical nutrition refers to medical-grade formulations prescribed under healthcare supervision for the therapeutic management of specific health conditions and disease-related nutritional deficiencies.

WRONG EXAMPLE (never do this — no brand names allowed):
APPLICATION_TYPE_COVERAGE: Sports Nutrition - MuscleBlaze, AS-IT-IS, Bigmuscles Nutrition; Weight Management - Nakpro, Nutrabay

Each entry must be a complete, grammatically correct sentence (25-40 words) that explains WHAT the application type IS — covering the health need it addresses, the target population, or the therapeutic mechanism involved. NEVER list brand names, company names, or product names after the dash. Segments to cover: ${benchmark.applicationDistribution?.map((s: { name: string }) => s.name).join(', ') || 'all application types'}. Output as a single semicolon-separated line.

**Critical Rules for BOTH Sub-sections:**
- Do NOT include any market size figures, CAGR, or growth rate percentages
- Do NOT reference or cite data from market research firms
- Do NOT add a conclusion to either sub-section
- All content must be exclusively India-specific — reference Indian companies, Indian consumer behavior, Indian regulations, and Indian market dynamics only
- Write like an experienced human analyst — authoritative, specific, insightful, not generic

---
REGIONAL ANALYSIS

You are a senior market research analyst writing the Regional Analysis section of a white paper on the Indian ${topic} Market. This section must provide a comprehensive, dual-lens regional assessment covering BOTH consumer-side dynamics AND production-side/manufacturing dynamics for each region. Write approximately 800 words.

**Regional Context:**
- Dominating Region: ${benchmark.dominatingRegion}
- Fastest Growing Region: ${benchmark.fastestGrowingRegion}

Open with a brief 2–3 sentence overview paragraph explaining why ${benchmark.dominatingRegion} dominates and why ${benchmark.fastestGrowingRegion} is the fastest-growing region, setting the stage for the detailed regional breakdown below.

**For each of the five regions below, cover BOTH lenses:**

**Consumer-Side Insights** (demand, preferences, health trends, purchasing behavior):
- Consumer health awareness levels and preventive healthcare adoption
- Predominant health conditions driving nutraceutical demand in the region
- Consumer purchasing channels (pharmacy, e-commerce, D2C, organized retail, kirana)
- Regional dietary patterns and traditional medicine preferences influencing product acceptance
- Urban vs. rural demand dynamics within the region
- Income levels, aspirational consumption, and willingness to pay for premium nutraceuticals
- Influence of local practitioners (Ayurvedic vaidyas, doctors, fitness trainers) on consumer choices

**Production-Side Insights** (manufacturing, supply chain, infrastructure, capacity):
- Manufacturing hub locations and concentration of production facilities
- State-level industrial policies, tax incentives, and special economic zones supporting nutraceutical manufacturing
- Raw material sourcing advantages: proximity to herbal/botanical growing regions, spice belts, marine ingredient sources
- Quality infrastructure: GMP-certified facilities, FSSAI-approved labs, testing capabilities
- Export infrastructure: proximity to major ports (Mumbai, Chennai, Kandla, Nhava Sheva), airport cargo hubs
- Contract manufacturing capacity and CDMO capabilities
- Cold chain logistics and warehousing infrastructure
- Workforce availability: skilled pharmaceutical/nutraceutical workforce, research institutions, and training facilities

**Detailed Regional Breakdown:**

**1. North India (Delhi NCR, Punjab, Haryana, Himachal Pradesh, Uttarakhand)**
Consumer Side:
- Health-conscious urban consumers in Delhi NCR driving premium segment demand
- Strong Ayurvedic trust in Punjab, Haryana with traditional supplement consumption
- Growing fitness culture in metro and peri-urban areas

Production Side:
- Manufacturing Hubs: Baddi (Himachal Pradesh) — India's largest pharmaceutical and nutraceutical manufacturing cluster with 500+ units; Haridwar (Uttarakhand) — major hub for Ayurvedic and herbal products
- Key Players: Dabur (Ghaziabad), Patanjali (Haridwar), Mankind Pharma (New Delhi)
- State incentives: Himachal Pradesh and Uttarakhand offering tax holidays and subsidized land for pharmaceutical/nutraceutical units
- Raw material sourcing: Himalayan herbs, medicinal plants from Uttarakhand's biodiversity

**2. West India (Maharashtra, Gujarat, Rajasthan, Goa)**
Consumer Side:
- Mumbai as a trendsetting consumer market for health and wellness products
- Gujarat's strong vegetarian consumer base driving plant-based supplement demand
- High D2C brand adoption among affluent urban consumers

Production Side:
- Manufacturing Hubs: Mumbai-Pune corridor, Ahmedabad, Vapi (Gujarat) — major pharmaceutical and nutraceutical manufacturing belts
- Key Players: Sun Pharma, Cipla, Torrent Pharma, Glenmark
- Port access: Mumbai (JNPT/Nhava Sheva) and Kandla for export logistics
- Gujarat's vibrant API and excipient supplier ecosystem supporting nutraceutical formulation

**3. South India (Karnataka, Tamil Nadu, Telangana, Kerala, Andhra Pradesh)**
Consumer Side:
- Bengaluru and Hyderabad as health-tech hubs driving awareness and adoption
- Kerala's Ayurvedic heritage creating strong consumer base for traditional nutraceuticals
- Tamil Nadu's growing wellness tourism driving supplement awareness

Production Side:
- Manufacturing Hubs: Hyderabad — India's bulk drug and formulation capital with growing nutraceutical capabilities; Bengaluru — R&D and innovation hub; Chennai — manufacturing and export corridor
- Key Players: Himalaya Wellness (Bengaluru), Sami-Sabinsa (Bengaluru), Organic India, Natural Remedies
- R&D Institutions: CFTRI (Mysuru), CSIR labs, IITs providing research backbone
- Port access: Chennai and Visakhapatnam for Southeast Asian and Middle Eastern exports

**4. East India (West Bengal, Odisha, Bihar, Jharkhand, Northeast States)**
Consumer Side:
- Kolkata's growing health-conscious urban consumer base
- High prevalence of nutritional deficiencies creating demand for basic supplementation
- Increasing e-commerce penetration enabling access in underserved areas

Production Side:
- Key Players: Emami (Kolkata), regional Ayurvedic manufacturers
- Emerging manufacturing activity with lower operational costs
- Rich biodiversity in Northeast India for unique botanical ingredient sourcing (Assam tea, Meghalaya turmeric, Sikkim organic herbs)
- Growing investment in food processing infrastructure under state industrial policies

**5. Central India (Madhya Pradesh, Chhattisgarh, Uttar Pradesh)**
Consumer Side:
- Massive population base with low current nutraceutical penetration representing significant headroom for growth
- Rising awareness through government health schemes and digital health campaigns
- Price-sensitive consumers favoring affordable, value-for-money formulations

Production Side:
- Herbal raw material sourcing: Madhya Pradesh and Chhattisgarh as major producers of medicinal plants, soybean, and botanical ingredients
- Emerging contract manufacturing capacity with competitive land and labor costs
- Government incentives: food processing parks, MSME support schemes
- Uttar Pradesh's massive manufacturing base gradually diversifying into nutraceuticals

**Critical Rules:**
- Do NOT include any market size figures, CAGR, or growth rate percentages
- Every region MUST cover BOTH consumer-side AND production-side insights — this dual-lens approach is mandatory
- All content must be exclusively India-specific
- Write as an experienced analyst providing genuine regional intelligence, not generic filler text
- Mention specific company names, specific cities, specific policies, and specific infrastructure — be concrete and actionable

---
COMPETITION ANALYSIS

You are a senior market research analyst writing the Competition Analysis section of a white paper on the Indian ${topic} Market. This section must provide a comprehensive competitive landscape covering BOTH consumer-facing strategies AND production-side/manufacturing capabilities of market players. Write approximately 400 words in three cohesive, flowing paragraphs.

**PARAGRAPH 1 — Established Indian Players (~150 words)**

Cover major established players such as Dabur, Himalaya Wellness, Patanjali, Amway India, Herbalife India, Zandu (Emami), and Baidyanath. Analyze their competitive strategies through BOTH lenses:

Consumer-Side Strategies:
- Heavy R&D investment in product innovation blending traditional Ayurvedic formulations with modern nutraceutical science (e.g., standardized extracts, enhanced bioavailability formats)
- Strategic partnerships with major FMCG distributors, pharmacy chains (Apollo Pharmacy, MedPlus, Wellness Forever), and e-commerce platforms (Amazon India, Flipkart, 1mg) to solidify market presence
- Pan-India distribution expansion across tier-2 and tier-3 cities through organized retail (Reliance Retail, DMart, BigBasket) and traditional kirana networks
- Brand trust built through decades of consumer relationship and Ayurvedic heritage positioning

Production-Side Strategies:
- Large-scale manufacturing facilities with WHO-GMP, ISO 22000, FSSAI certifications
- Vertically integrated supply chains: own herb farms, extraction units, formulation labs, packaging facilities
- Investment in in-house R&D centers with clinical validation capabilities
- Backward integration into raw material sourcing to control quality and reduce costs
- Export-oriented manufacturing lines meeting US FDA, EU GMP, TGA (Australia) standards

**PARAGRAPH 2 — Mid-Level Indian Players & D2C Brands (~150 words)**

Cover emerging mid-level players including regional manufacturers and D2C brands like HealthKart, Kapiva, Wellbeing Nutrition, OZiva, Plix, Boldfit, and Fast&Up. Analyze through BOTH lenses:

Consumer-Side Strategies:
- Targeting health-conscious millennials and Gen-Z consumers through digital-first marketing, influencer partnerships, and social media campaigns
- Offering cost-effective yet premium-positioned products balancing quality with affordability
- Strong D2C e-commerce presence on own websites plus Amazon India, Flipkart, 1mg, Nykaa, and Purplle
- Content marketing and health education as customer acquisition tools
- Subscription models and personalized nutrition recommendations driving customer retention

Production-Side Strategies:
- Asset-light manufacturing model leveraging contract manufacturers in Baddi, Haridwar, Ahmedabad, and Hyderabad
- Focus on innovative delivery formats: gummies, effervescent tablets, plant-based proteins, ready-to-drink formats
- Quality certifications (FSSAI, ISO, GMP) to build credibility despite smaller scale
- Collaborative R&D with food technology institutes and universities
- Agile product development cycles responding quickly to trending health needs (immunity post-COVID, gut health, sleep)

**PARAGRAPH 3 — Small-Scale Players & Regional Brands (~100 words)**

Cover small-scale players including local Ayurvedic units, startup nutraceutical brands, regional formulators, and cottage-scale operations. Analyze through BOTH lenses:

Consumer-Side Strategies:
- Carving niche positions through specialized formulations: immunity boosters, traditional churnas, regional herbal supplements, single-herb concentrates
- Leveraging social commerce platforms (Instagram, WhatsApp Business, Meesho) for direct consumer engagement and hyperlocal marketing
- Building trust through local alliances with Ayurvedic practitioners, gym trainers, yoga instructors, wellness centers, and local pharmacies
- State-level brand building with vernacular language marketing and regional health influencers

Production-Side Strategies:
- Small-batch manufacturing with lower overhead and faster product iteration
- FSSAI licensing as primary quality benchmark; gradually upgrading to GMP standards
- Raw material sourcing from local farmers and cooperatives, often with organic certifications
- Toll manufacturing/loan licensing arrangements to enter market with minimal capex
- Participation in state government's MSME schemes, Startup India benefits, and food processing subsidies

**Critical Rules:**
- Do NOT include any market size figures, CAGR, or growth rate percentages
- Every paragraph MUST cover BOTH consumer-side AND production-side strategies — this dual-lens approach is mandatory
- All content must be exclusively India-specific — reference Indian companies, Indian platforms, Indian certifications, and Indian market dynamics
- Write in flowing paragraph style — NO bullet points, NO numbered lists in the final output
- The three paragraphs should flow cohesively as a single competitive landscape narrative, not as disconnected sections

---
SOURCES

Present all sources in a clean, organized bullet-point format under the following 5 categories. Each category must be on its own line as a bullet point with specific source names listed after it.

For the first 4 categories below, generate sources that are specifically relevant to the ${topic} market in India. Use real, verifiable Indian institutions, databases, publications, and industry bodies that are authoritative for this specific topic. Do NOT use generic placeholder sources — tailor every source to ${topic}.

• **Primary Research:** [Generate primary research sources specific to ${topic} — e.g., in-depth interviews with relevant manufacturers, regulators, practitioners, distributors, buyers, and consumers specific to this segment in India]
• **Databases:** [Generate relevant Indian government databases, statistical portals, and regulatory databases that would be authoritative for ${topic} data in India]
• **Magazines & Trade Publications:** [Generate relevant Indian trade publications, industry magazines, and professional journals that cover ${topic} in India]
• **Associations & Industry Bodies:** [Generate relevant Indian industry associations, trade bodies, and regulatory committees that are authoritative for ${topic} in India]
• **Proprietary Elements:** Coherent Market Insights Data Analytics Tool, primary research database of 5000+ industry stakeholder interviews, proprietary pricing and competitive benchmarking models

IMPORTANT FORMATTING RULES FOR SOURCES:
- Use bullet points (•) for each category — this is the ONLY section in the entire white paper that uses bullet points
- Do NOT include any market research firm reports (e.g., Grand View Research, Mordor Intelligence, Allied Market Research, Fortune Business Insights) in the databases or anywhere else
- Do NOT include journals as a separate category — academic references should be incorporated within the primary research context if needed
- Do NOT include newspapers as a separate category

After the sources section, add the following note in a separate line:

_Note: The above-mentioned list of sources represents a subset of a larger repository of hundreds of primary and secondary sources utilized to derive estimates, insights, analysis, and forecast represented in this India ${topic} Industry Insights._

This note must be rendered in italic formatting and positioned as the very last element of the entire white paper.

---

## FINAL INSTRUCTIONS

SECTION ORDER: The white paper MUST follow this exact section sequence:
1. Definition (concise 2-4 sentence product definition)
2. Executive Summary (with graph data JSON)
3. Growth Factors
4. Opportunities
5. Impact Analysis Data (JSON only)
6. Segment Analysis (Product Type + Application Type)
7. Regional Analysis (Consumer + Production dual lens)
8. Competition Analysis (Consumer + Production dual lens)
9. Sources (with italic note at bottom)

FORMATTING RULES:
- Use the EXACT section headers provided above in UPPERCASE
- Adhere strictly to the word limits specified for each section
- Ensure all market size math is mathematically correct (2033 = 2026 × (1 + CAGR/100)^7)
- ALL content must be India-specific except where global context is explicitly requested (Executive Summary only)
- Reference real Indian companies, real Indian regulations, real Indian cities, and real market dynamics — no generic filler
- The tone throughout must be authoritative, analytical, and suitable for C-suite/investor audience
- No bullet points or numbered lists in any section EXCEPT the Sources section
- No conclusions in any section unless explicitly instructed
- No market size or CAGR figures in any section except Executive Summary
- The JSON chart data blocks must be valid, parseable JSON (both Executive Summary \`\`\`json and Impact Analysis \`\`\`impact_json)`;
}

/**
 * Try searching Perplexity for market data on a given topic.
 * Returns partial MarketContext fields on success, or null if no usable data found.
 */
async function tryPerplexitySearch(searchTopic: string): Promise<{
  verifiedGlobalMarketSize2026?: string;
  verifiedGlobalMarketSize2033?: string;
  verifiedGlobalCagr?: string;
  verifiedMarketSize2026?: string;
  verifiedMarketSize2033?: string;
  verifiedCagr?: string;
  dataSources: string[];
  confidence: 'high' | 'medium' | 'low';
} | null> {
  try {
    const { searchMarketResearchData } = await import('../services/ai-provider');
    const result = await searchMarketResearchData(searchTopic);

    if (result && result.content) {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        console.log(`[WhitePaper] Market research raw data for "${searchTopic}":`, JSON.stringify(parsed, null, 2));

        const hasGlobalData = parsed.globalMarketSize2025 != null && parsed.globalCagr != null;
        const hasIndiaData = parsed.indiaMarketSize2025 != null && parsed.indiaCagr != null;

        if (hasGlobalData || hasIndiaData) {
          const confidence = parsed.confidence || 'medium';

          let verifiedGlobalMarketSize2026: string | undefined;
          let verifiedGlobalMarketSize2033: string | undefined;
          let verifiedGlobalCagr: string | undefined;
          let verifiedMarketSize2026: string | undefined;
          let verifiedMarketSize2033: string | undefined;
          let verifiedCagr: string | undefined;

          if (hasGlobalData) {
            const globalCagr = parsed.globalCagr;
            const global2025 = parsed.globalMarketSize2025;
            const global2026 = global2025 * (1 + globalCagr / 100);
            const global2033 = global2025 * Math.pow(1 + globalCagr / 100, 8);

            const formatGlobalSize = (millions: number): string => {
              if (millions >= 1000) {
                return `$${(millions / 1000).toFixed(1)} Billion`;
              }
              return `$${Math.round(millions)} Million`;
            };

            verifiedGlobalMarketSize2026 = formatGlobalSize(global2026);
            verifiedGlobalMarketSize2033 = formatGlobalSize(global2033);
            verifiedGlobalCagr = `${globalCagr}%`;

            console.log(`[WhitePaper] Verified global data: ${verifiedGlobalMarketSize2026} (2026) → ${verifiedGlobalMarketSize2033} (2033) at ${verifiedGlobalCagr} CAGR`);
          }

          if (hasIndiaData) {
            const indiaCagr = parsed.indiaCagr;
            const india2025 = parsed.indiaMarketSize2025;
            const india2026 = india2025 * (1 + indiaCagr / 100);
            const india2033 = india2025 * Math.pow(1 + indiaCagr / 100, 8);

            verifiedMarketSize2026 = `₹${Math.round(india2026).toLocaleString()} Crores`;
            verifiedMarketSize2033 = `₹${Math.round(india2033).toLocaleString()} Crores`;
            verifiedCagr = `${indiaCagr}%`;

            console.log(`[WhitePaper] Verified India data: ${verifiedMarketSize2026} (2026) → ${verifiedMarketSize2033} (2033) at ${verifiedCagr} CAGR`);
          }

          const dataSources = [
            ...(parsed.sources || []),
            ...result.citations.slice(0, 5),
          ].filter((s: string, i: number, arr: string[]) => arr.indexOf(s) === i);

          return {
            verifiedGlobalMarketSize2026,
            verifiedGlobalMarketSize2033,
            verifiedGlobalCagr,
            verifiedMarketSize2026,
            verifiedMarketSize2033,
            verifiedCagr,
            dataSources,
            confidence,
          };
        } else {
          console.warn(`[WhitePaper] Market research returned no usable data for: "${searchTopic}"`);
        }
      } else {
        console.warn('[WhitePaper] Market research response had no parseable JSON');
      }
    }
  } catch (error) {
    console.warn(`[WhitePaper] Market research search failed for "${searchTopic}":`, error instanceof Error ? error.message : error);
  }

  return null;
}

/**
 * Clean brand names from topic for market research search
 */
function cleanTopicForSearch(topic: string): string {
  const BRAND_PATTERNS = [
    /\bksm[\s-]?\d+\b/gi,
    /\bsabinsa\b/gi,
    /\bc3\s*complex\b/gi,
    /\bbioprene\b/gi,
    /\blactospot\b/gi,
    /\bshilajit\s*gold\b/gi,
    /\b(branded|patented|trademarked)\b/gi,
    /\b[A-Z]{2,4}[\s-]\d{1,4}\b/g,
  ];
  let cleaned = topic;
  for (const pattern of BRAND_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned.length < 3 ? topic : cleaned;
}

/**
 * Build market context from benchmarks (Phase 1 & 2 of generation)
 * Uses 3-tier fallback: Specific search → Broader category search → Curated benchmarks
 */
async function buildMarketContext(topic: string): Promise<MarketContext> {
  const benchmark = getBenchmarkForTopic(topic);

  console.log(`[WhitePaper] Using ${benchmark.tier} segment benchmark for topic: ${topic}`);
  console.log(`[WhitePaper] Benchmark range: ${benchmark.sizeRange2026.min}-${benchmark.sizeRange2026.max} Cr`);

  const searchTopic = cleanTopicForSearch(topic);
  console.log(`[WhitePaper] Search topic (cleaned): "${searchTopic}" (original: "${topic}")`);

  // ========== TIER 1: Search Perplexity for specific topic ==========
  console.log(`[WhitePaper] Tier 1: Searching for specific topic "${searchTopic}"...`);
  const tier1Result = await tryPerplexitySearch(searchTopic);
  if (tier1Result) {
    console.log(`[WhitePaper] Tier 1 SUCCESS — found specific data for "${searchTopic}"`);
    return {
      hasVerifiedData: true,
      dataTier: 'specific',
      ...tier1Result,
      benchmark,
    };
  }

  // ========== TIER 2: Search Perplexity for broader parent category ==========
  const broaderInfo = getBroaderCategoryForTopic(topic);
  if (broaderInfo) {
    console.log(`[WhitePaper] Tier 1 failed. Tier 2: Trying broader category "${broaderInfo.displayName}"...`);
    const tier2Result = await tryPerplexitySearch(broaderInfo.displayName);
    if (tier2Result) {
      console.log(`[WhitePaper] Tier 2 SUCCESS — found broader data for "${broaderInfo.displayName}"`);
      return {
        hasVerifiedData: true,
        dataTier: 'broader',
        broaderCategory: broaderInfo.displayName,
        ...tier2Result,
        confidence: tier2Result.confidence === 'high' ? 'medium' : tier2Result.confidence,
        benchmark,
      };
    }
    console.log(`[WhitePaper] Tier 2 also failed for "${broaderInfo.displayName}"`);
  } else {
    console.log(`[WhitePaper] Tier 1 failed. No broader category mapping found for "${topic}"`);
  }

  // ========== TIER 3: Use curated benchmark ranges ==========
  const broaderName = broaderInfo?.displayName || 'Nutraceutical Supplements';
  console.log(`[WhitePaper] Tier 3: Using curated benchmark data for "${broaderName}"`);

  const formatBenchmarkRange = (range: { min: number; max: number }, unit: 'usd' | 'inr'): string => {
    if (unit === 'usd') {
      return `$${range.min.toFixed(1)}-${range.max.toFixed(1)} Billion`;
    }
    return `₹${range.min.toLocaleString('en-IN')}-${range.max.toLocaleString('en-IN')} Crores`;
  };

  return {
    hasVerifiedData: true,
    dataTier: 'benchmark',
    broaderCategory: broaderName,
    verifiedGlobalMarketSize2026: formatBenchmarkRange(benchmark.globalSizeRange2026, 'usd'),
    verifiedGlobalMarketSize2033: formatBenchmarkRange(benchmark.globalSizeRange2033, 'usd'),
    verifiedGlobalCagr: `${benchmark.globalCagrRange.min}-${benchmark.globalCagrRange.max}%`,
    verifiedMarketSize2026: formatBenchmarkRange(benchmark.sizeRange2026, 'inr'),
    verifiedMarketSize2033: formatBenchmarkRange(benchmark.sizeRange2033, 'inr'),
    verifiedCagr: `${benchmark.cagrRange.min}-${benchmark.cagrRange.max}%`,
    benchmark,
    dataSources: ['Industry Benchmark Estimates'],
    confidence: 'low',
  };
}

/**
 * Generate white paper using AI with constrained prompts (Perplexity/OpenAI)
 * Includes retry logic for cross-section data consistency validation
 */
async function generateWhitePaper(topic: string): Promise<{ content: WhitePaperContent; isLive: boolean }> {
  console.log(`[WhitePaper] ========== GENERATION START ==========`);
  console.log(`[WhitePaper] Generating for topic: "${topic}"`);

  try {
    // Fetch current exchange rate for INR/USD conversion
    const currentExchangeRate = await getUsdToInrRate();

    // Import AI provider
    const { getIndustryInsights, isAnyAIConfigured } = await import('../services/ai-provider');

    const aiConfigured = isAnyAIConfigured();
    console.log(`[WhitePaper] AI provider configured: ${aiConfigured}`);

    if (!aiConfigured) {
      console.log('[WhitePaper] WARNING: No AI provider configured, using FALLBACK content');
      console.log('[WhitePaper] To enable AI generation, configure PERPLEXITY_API_KEY or OPENAI_API_KEY');
      return {
        content: await getFallbackContent(topic, currentExchangeRate),
        isLive: false,
      };
    }

    console.log('[WhitePaper] AI provider is configured, proceeding with live generation...');

    // Phase 1 & 2: Build market context with verified research data
    const marketContext = await buildMarketContext(topic);

    console.log(`[WhitePaper] Data tier: ${marketContext.dataTier}, confidence: ${marketContext.confidence}`);
    if (marketContext.broaderCategory) {
      console.log(`[WhitePaper] Using broader category: "${marketContext.broaderCategory}" for topic: "${topic}"`);
    }

    // Retry loop for data consistency
    let attempt = 0;
    let lastContent: WhitePaperContent | null = null;
    let lastConsistencyResult: ConsistencyValidationResult | null = null;
    let lastImpactAnalysis: ImpactAnalysisChartData | null = null;

    while (attempt < MAX_CONSISTENCY_RETRIES) {
      attempt++;
      console.log(`[WhitePaper] Generation attempt ${attempt}/${MAX_CONSISTENCY_RETRIES}`);

      // Phase 3: Generate content with constrained prompt
      console.log('[WhitePaper] Building constrained prompt...');
      const prompt = buildConstrainedPrompt(topic, marketContext, currentExchangeRate);
      console.log(`[WhitePaper] Prompt length: ${prompt.length} characters`);

      console.log('[WhitePaper] Calling AI provider for content generation...');
      const response = await getIndustryInsights(prompt);
      console.log(`[WhitePaper] AI response received, length: ${response.length} characters`);
      console.log(`[WhitePaper] AI response preview (first 500 chars): ${response.substring(0, 500)}...`);

      console.log('[WhitePaper] Parsing AI response...');
      const content = parseWhitePaperResponse(response, topic);
      console.log(`[WhitePaper] Parsed content - executiveSummary length: ${content.executiveSummary?.length || 0}`);
      console.log(`[WhitePaper] Parsed content - growthFactors length: ${typeof content.growthFactors === 'string' ? content.growthFactors.length : 0}`);

      // Extract impact analysis JSON from raw AI response
      const impactJsonMatch = response.match(/```impact_json\s*([\s\S]*?)\s*```/);
      if (impactJsonMatch) {
        try {
          const parsed = JSON.parse(impactJsonMatch[1]);
          const validated = validateImpactAnalysisData(parsed);
          if (validated) {
            lastImpactAnalysis = validated;
            console.log(`[WhitePaper] Impact analysis parsed: ${validated.drivers.length} drivers, ${validated.restraints.length} restraints, ${validated.opportunities.length} opportunities`);
          } else {
            console.warn('[WhitePaper] Impact analysis JSON failed validation, will use benchmark fallback');
          }
        } catch (e) {
          console.warn('[WhitePaper] Failed to parse impact_json block:', e);
        }
      } else {
        console.log('[WhitePaper] No impact_json block found in AI response, will use benchmark fallback');
      }

      // Validate content has meaningful data (check both new and legacy fields)
      const hasContent = (content.executiveSummary && content.executiveSummary.length > 50) ||
        content.overview.length > 50 ||
        content.marketSize.length > 20 ||
        (typeof content.growthFactors === 'string' ? content.growthFactors.length > 0 : content.growthFactors.length > 0);

      if (!hasContent) {
        console.log('[WhitePaper] WARNING: Parsed content too sparse, using FALLBACK');
        console.log(`[WhitePaper] executiveSummary: ${content.executiveSummary?.length || 0} chars`);
        console.log(`[WhitePaper] overview: ${content.overview?.length || 0} chars`);
        console.log(`[WhitePaper] marketSize: ${content.marketSize?.length || 0} chars`);
        return {
          content: await getFallbackContent(topic, currentExchangeRate),
          isLive: false,
        };
      }

      console.log('[WhitePaper] Content validation passed - checking cross-section data consistency...');

      // Phase 4: Cross-section consistency validation
      const marketReferences = extractAllMarketReferences(content);
      console.log(`[WhitePaper] Found ${marketReferences.length} market references across sections`);

      const consistencyResult = validateCrossSectionConsistency(marketReferences);
      lastContent = content;
      lastConsistencyResult = consistencyResult;

      if (consistencyResult.isValid) {
        console.log('[WhitePaper] Cross-section data consistency validated successfully');
        break; // Exit retry loop - content is consistent
      } else {
        console.warn(`[WhitePaper] Data inconsistencies detected (attempt ${attempt}/${MAX_CONSISTENCY_RETRIES}):`);
        consistencyResult.mismatches.forEach(mismatch => {
          console.warn(`  - ${mismatch.type}: ${mismatch.deviation}% deviation`);
          mismatch.values.forEach(v => console.warn(`    • ${v.section}: ${v.value}`));
        });

        if (attempt < MAX_CONSISTENCY_RETRIES) {
          console.log('[WhitePaper] Retrying with regeneration...');
        }
      }
    }

    // Use the last generated content (either consistent or best effort after retries)
    let finalContent = lastContent!;

    // If still inconsistent after retries, normalize to Executive Summary values
    if (lastConsistencyResult && !lastConsistencyResult.isValid) {
      console.warn('[WhitePaper] Max retries reached with inconsistencies - normalizing to Executive Summary values');
      finalContent = normalizeToExecutiveSummary(finalContent);

      // Re-validate after normalization
      const postNormReferences = extractAllMarketReferences(finalContent);
      const postNormResult = validateCrossSectionConsistency(postNormReferences);
      if (postNormResult.isValid) {
        console.log('[WhitePaper] Normalization successful - data is now consistent');
      } else {
        console.warn('[WhitePaper] Some inconsistencies remain after normalization (may be in non-standard formats)');
      }
    }

    // Phase 5: Extract market data from AI-generated text (Executive Summary or Market Size)
    const marketDataSource = finalContent.executiveSummary || finalContent.marketSize;
    const extractedData = extractMarketData(marketDataSource);

    // Add chart data - use AI-extracted values if available, fallback to benchmarks
    finalContent.chartData = {
      // India market data
      marketSize2026: extractedData.marketSize2026 ?? marketContext.benchmark.sizeRange2026.min,
      marketSize2033: extractedData.marketSize2033 ?? marketContext.benchmark.sizeRange2033.min,
      cagr: extractedData.cagr ?? marketContext.benchmark.cagrRange.min,
      // Global market data (NEW)
      globalMarketSize2026: extractedData.globalMarketSize2026 ?? marketContext.benchmark.globalSizeRange2026.min,
      globalMarketSize2033: extractedData.globalMarketSize2033 ?? marketContext.benchmark.globalSizeRange2033.min,
      globalCagr: extractedData.globalCagr ?? marketContext.benchmark.globalCagrRange.min,
      // Regional and segment data
      dominatingRegion: marketContext.benchmark.dominatingRegion,
      fastestGrowingRegion: marketContext.benchmark.fastestGrowingRegion,
      keyPlayers: marketContext.benchmark.keyPlayers,
      segmentationType: marketContext.benchmark.segmentationType,
      dominantSegment: marketContext.benchmark.dominantSegment,
      tier: marketContext.benchmark.tier,
      segmentDistribution: marketContext.benchmark.segmentDistribution,
      // Application segmentation (NEW)
      applicationSegmentation: marketContext.benchmark.applicationSegmentation,
      dominantApplicationSegment: marketContext.benchmark.dominantApplicationSegment,
      applicationDistribution: marketContext.benchmark.applicationDistribution,
      // Market drivers
      marketDrivers: marketContext.benchmark.marketDrivers,
      // Market restraints
      marketRestraints: marketContext.benchmark.marketRestraints,
      // Market opportunities
      marketOpportunities: marketContext.benchmark.marketOpportunities,
      // AI-generated impact analysis (takes priority over benchmark data in chart component)
      impactAnalysis: lastImpactAnalysis || undefined,
    };

    // Validate generated market data against benchmarks (for logging only)
    if (marketContext.dataTier === 'benchmark') {
      // Tier 3: Data IS the benchmark — skip all validation
      console.log('[WhitePaper] Using benchmark data (Tier 3) — skipping range validation');
    } else if (marketContext.dataTier === 'specific' || marketContext.dataTier === 'broader') {
      // Tier 1/2: Verified data — only validate math consistency
      console.log(`[WhitePaper] Using ${marketContext.dataTier} data — skipping benchmark range validation`);
      if (extractedData.marketSize2026 && extractedData.marketSize2033 && extractedData.cagr) {
        const consistency = validateMarketSizeConsistency(extractedData.marketSize2026, extractedData.marketSize2033, extractedData.cagr);
        if (!consistency.isValid) {
          console.warn(`[WhitePaper] India math inconsistency: expected ~${consistency.expectedSize2033} Cr, got ${extractedData.marketSize2033} Cr (${consistency.deviation}% deviation)`);
        }
      }
      if (extractedData.globalMarketSize2026 && extractedData.globalMarketSize2033 && extractedData.globalCagr) {
        const consistency = validateMarketSizeConsistency(extractedData.globalMarketSize2026, extractedData.globalMarketSize2033, extractedData.globalCagr);
        if (!consistency.isValid) {
          console.warn(`[WhitePaper] Global math inconsistency: expected ~$${consistency.expectedSize2033}B, got $${extractedData.globalMarketSize2033}B (${consistency.deviation}% deviation)`);
        }
      }
    } else {
      const validation = validateGeneratedMarketData(extractedData, marketContext.benchmark);
      if (!validation.isValid) {
        console.warn('[WhitePaper] Market data validation issues:');
        validation.issues.forEach(issue => console.warn(`  - ${issue}`));
      } else {
        console.log('[WhitePaper] Market data validation passed');
      }
    }

    // Stamp data version for cache invalidation
    finalContent._dataVersion = 2;

    console.log('[WhitePaper] ========== GENERATION SUCCESS ==========');
    console.log('[WhitePaper] Returning LIVE AI-generated content');
    return { content: finalContent, isLive: true };
  } catch (error) {
    console.error('[WhitePaper] ========== GENERATION ERROR ==========');
    console.error('[WhitePaper] Error generating white paper:', error);
    console.log('[WhitePaper] Falling back to static content due to error');
    return {
      content: await getFallbackContent(topic, currentExchangeRate),
      isLive: false,
    };
  }
}

/**
 * Get fallback content when AI is unavailable
 * Updated for new 7-section format with global + India data
 * Now uses template builders with benchmark data and shared constants
 */
async function getFallbackContent(topic: string, exchangeRate: number): Promise<WhitePaperContent> {
  // Get benchmark data for chart visualization and text content
  const benchmark = getBenchmarkForTopic(topic);

  // India market values
  const indiaSize2026 = benchmark.sizeRange2026.min.toLocaleString('en-IN');
  const indiaSize2033 = benchmark.sizeRange2033.min.toLocaleString('en-IN');
  const indiaCagr = benchmark.cagrRange.min;

  // Global market values
  const globalSize2026 = benchmark.globalSizeRange2026.min;
  const globalSize2033 = benchmark.globalSizeRange2033.min;
  const globalCagr = benchmark.globalCagrRange.min;

  // Convert INR Crores to USD Billions for chart comparison
  const indiaInUsdBillions2026 = benchmark.sizeRange2026.min / (exchangeRate * 100);
  const indiaInUsdBillions2033 = benchmark.sizeRange2033.min / (exchangeRate * 100);

  // Market data for template builders
  const marketData = {
    globalSize2026,
    globalSize2033,
    globalCagr,
    indiaSize2026,
    indiaSize2033,
    indiaCagr,
  };

  return {
    topic,

    // NEW FORMAT FIELDS - Using template builders for dynamic content
    productDefinition: templates.buildProductDefinition(topic, benchmark),
    executiveSummary: templates.buildExecutiveSummary(topic, benchmark, marketData),

    executiveSummaryChartData: {
      chartData: [
        { year: '2026', global: globalSize2026, india: parseFloat(indiaInUsdBillions2026.toFixed(2)) },
        { year: '2033', global: globalSize2033, india: parseFloat(indiaInUsdBillions2033.toFixed(2)) },
      ],
      metadata: {
        globalCagr: `${globalCagr}%`,
        indiaCagr: `${indiaCagr}%`,
        globalMarketSize2026: `USD ${globalSize2026} Billion`,
        indiaMarketSize2026: `₹${indiaSize2026} Crores`,
        globalMarketSize2033: `USD ${globalSize2033} Billion`,
        indiaMarketSize2033: `₹${indiaSize2033} Crores`,
        globalCurrency: 'USD Billion',
        indiaCurrency: 'USD Billion',
        conversionNote: `Indian values converted at ₹${Math.round(exchangeRate)} = $1 for chart comparison`,
      },
    },

    // Dynamic content from template builders
    growthFactors: templates.buildGrowthFactors(topic, benchmark),
    opportunities: templates.buildOpportunities(topic, benchmark),
    ...(() => {
      const segProduct = templates.buildSegmentAnalysisProduct(topic, benchmark);
      const coverageMatch = segProduct.match(/\n?PRODUCT_FORM_COVERAGE:\s*(.+)/i);
      return {
        segmentAnalysisProduct: coverageMatch ? segProduct.replace(/\n?PRODUCT_FORM_COVERAGE:\s*.+/i, '').trim() : segProduct,
        productFormCoverage: coverageMatch ? coverageMatch[1].trim() : undefined,
      };
    })(),
    ...(() => {
      const segApp = templates.buildSegmentAnalysisApplication(topic, benchmark);
      const appCoverageMatch = segApp.match(/\n?APPLICATION_TYPE_COVERAGE:\s*(.+)/i);
      return {
        segmentAnalysisApplication: appCoverageMatch ? segApp.replace(/\n?APPLICATION_TYPE_COVERAGE:\s*.+/i, '').trim() : segApp,
        applicationTypeCoverage: appCoverageMatch ? appCoverageMatch[1].trim() : undefined,
      };
    })(),
    regionalAnalysis: templates.buildRegionalAnalysis(topic, benchmark),
    competitionAnalysis: templates.buildCompetitionAnalysis(topic, benchmark),
    sources: templates.buildSources(topic),

    // LEGACY FIELDS (for backward compatibility)
    summary: `The global ${topic} Market is valued at $${globalSize2026} Billion in 2026, projected to reach $${globalSize2033} Billion by 2033. The Indian market stands at ₹${indiaSize2026} Crores in 2026, expected to grow to ₹${indiaSize2033} Crores by 2033.`,
    keyInsights: [],
    overview: `In terms of ${benchmark.segmentationType}, ${benchmark.dominantSegment} contributes the highest share of the Indian ${topic} market owing to rising consumer preference for convenient formats and growing health consciousness.`,
    marketSize: `The Indian ${topic} Market is estimated to be valued at ₹${indiaSize2026} Crores in 2026 and is expected to reach ₹${indiaSize2033} Crores by 2033, growing at a CAGR of ${indiaCagr}%.`,
    challenges: [],
    futureTrends: [],
    regulations: [],
    goToMarketStrategies: [],

    chartData: {
      // India market data
      marketSize2026: benchmark.sizeRange2026.min,
      marketSize2033: benchmark.sizeRange2033.min,
      cagr: benchmark.cagrRange.min,
      // Global market data
      globalMarketSize2026: globalSize2026,
      globalMarketSize2033: globalSize2033,
      globalCagr: globalCagr,
      // Regional and segment data
      dominatingRegion: benchmark.dominatingRegion,
      fastestGrowingRegion: benchmark.fastestGrowingRegion,
      keyPlayers: benchmark.keyPlayers,
      segmentationType: benchmark.segmentationType,
      dominantSegment: benchmark.dominantSegment,
      tier: benchmark.tier,
      segmentDistribution: benchmark.segmentDistribution,
      // Application segmentation
      applicationSegmentation: benchmark.applicationSegmentation,
      dominantApplicationSegment: benchmark.dominantApplicationSegment,
      applicationDistribution: benchmark.applicationDistribution,
      // Market drivers
      marketDrivers: benchmark.marketDrivers,
      // Market restraints
      marketRestraints: benchmark.marketRestraints,
      // Market opportunities
      marketOpportunities: benchmark.marketOpportunities,
    },
  };
}

/**
 * Main function to fetch white paper (checks cache first, then generates)
 */
export async function fetchWhitePaperAction(
  topic: string,
  searchQuery?: string,
  forceRefresh: boolean = false,
  companyId?: string
): Promise<WhitePaperResult & { creditsDeducted?: number }> {
  const normalizedTopic = normalizeTopic(topic);

  try {
    console.log(`[WhitePaper] ========== FETCH REQUEST ==========`);
    console.log(`[WhitePaper] Original topic: "${topic}"`);
    console.log(`[WhitePaper] Normalized topic (cache key): "${normalizedTopic}"`);
    console.log(`[WhitePaper] Search query: "${searchQuery}"`);
    console.log(`[WhitePaper] Company ID: "${companyId || 'none'}"`);
    console.log(`[WhitePaper] Force refresh: ${forceRefresh}`);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await getCachedWhitePaperAction(topic);
      if (cached) {
        console.log(`[WhitePaper] CACHE HIT - returning cached content`);
        console.log(`[WhitePaper] Cached at: ${cached.generatedAt}`);
        console.log(`[WhitePaper] Is live (AI generated): ${cached.isLive}`);
        return { ...cached, creditsDeducted: 0 }; // No credits for cached content
      }
      console.log(`[WhitePaper] CACHE MISS - no cached content found`);
    } else {
      console.log(`[WhitePaper] FORCE REFRESH - skipping cache check`);
    }

    console.log(`[WhitePaper] Generating new white paper for topic: ${normalizedTopic}`);

    // Check and deduct credits for new whitepaper generation
    // COMPANY_UNLOCK (60 credits) already covers whitepapers, so skip if company is unlocked
    let creditsDeducted = 0;
    const user = await getOrCreateUser();

    if (user) {
      let shouldSkipCredits = false;

      // Check if company is unlocked — unlock already paid for everything including whitepapers
      if (companyId) {
        const unlocked = await isCompanyUnlocked(user.id, companyId);
        if (unlocked) {
          shouldSkipCredits = true;
          console.log(`[WhitePaper] Company ${companyId} is unlocked, skipping credit charge`);
        }
      }

      if (!shouldSkipCredits) {
        // First, CHECK if user has enough credits
        const creditCheck = await checkCredits(user.id, 'WHITEPAPER_GENERATE', 1);

        if (!creditCheck.allowed) {
          console.log(`[WhitePaper] Insufficient credits for: ${normalizedTopic}. Required: ${creditCheck.requiredCredits}, Available: ${creditCheck.currentBalance}`);
          return {
            content: {
              topic: normalizedTopic,
              summary: '',
              keyInsights: [],
              overview: '',
              marketSize: '',
              growthFactors: [],
              challenges: [],
              opportunities: [],
              futureTrends: [],
              regulations: [],
              goToMarketStrategies: [],
            },
            isLive: false,
            generatedAt: new Date(),
            creditsDeducted: 0,
            error: `Insufficient credits. You need ${creditCheck.requiredCredits} credits but only have ${creditCheck.currentBalance}. Please upgrade your plan.`,
          };
        }

        // Credits are sufficient - proceed with deduction
        const deductResult = await deductCredits(user.id, 'WHITEPAPER_GENERATE', 1, undefined, `White paper: ${normalizedTopic.substring(0, 40)}`);

        if (!deductResult.success) {
          console.error('[WhitePaper] Credit deduction failed:', deductResult.error);
          return {
            content: {
              topic: normalizedTopic,
              summary: '',
              keyInsights: [],
              overview: '',
              marketSize: '',
              growthFactors: [],
              challenges: [],
              opportunities: [],
              futureTrends: [],
              regulations: [],
              goToMarketStrategies: [],
            },
            isLive: false,
            generatedAt: new Date(),
            creditsDeducted: 0,
            error: deductResult.error || 'Failed to deduct credits. Please try again.',
          };
        }

        creditsDeducted = deductResult.creditsDeducted ?? CREDIT_COSTS.WHITEPAPER_GENERATE;
        console.log(`[WhitePaper] Deducted ${creditsDeducted} credits for white paper generation`);
      } else {
        console.log('[WhitePaper] Skipping credit check (pre-paid via company unlock)');
      }
    }

    // Generate new white paper
    const { content, isLive } = await generateWhitePaper(topic);

    // Check if generation was blocked due to unverified market data
    const hasContent = content.executiveSummary || content.overview || content.marketSize ||
      (typeof content.growthFactors === 'string' ? content.growthFactors : content.growthFactors?.length > 0);
    if (!hasContent && !isLive) {
      console.warn(`[WhitePaper] Generation blocked — no verified market data for "${topic}"`);
      return {
        content,
        isLive: false,
        generatedAt: new Date(),
        creditsDeducted: 0,
        error: `Unable to generate white paper for "${topic}" at this time. Please try again later.`,
      };
    }

    console.log(`[WhitePaper] ========== STORING RESULT ==========`);
    console.log(`[WhitePaper] Content isLive (AI generated): ${isLive}`);
    console.log(`[WhitePaper] Storing in cache with key: "${normalizedTopic}"`);

    // Store in cache
    await storeWhitePaperAction(topic, content, searchQuery, isLive);

    console.log(`[WhitePaper] ========== FETCH COMPLETE ==========`);
    console.log(`[WhitePaper] Returning ${isLive ? 'LIVE AI' : 'FALLBACK'} content`);

    return {
      content,
      isLive,
      generatedAt: new Date(),
      creditsDeducted,
    };
  } catch (error) {
    console.error('[WhitePaper] Unhandled error in fetchWhitePaperAction:', error);
    return {
      content: {
        topic: normalizedTopic,
        summary: '',
        keyInsights: [],
        overview: '',
        marketSize: '',
        growthFactors: [],
        challenges: [],
        opportunities: [],
        futureTrends: [],
        regulations: [],
        goToMarketStrategies: [],
      },
      isLive: false,
      generatedAt: new Date(),
      creditsDeducted: 0,
      error: 'Failed to generate white paper. Please try again.',
    };
  }
}
