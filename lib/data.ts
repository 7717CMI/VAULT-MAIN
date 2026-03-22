// ============================================================
// INSIGHT VAULT - Site Configuration & Category Data
// ============================================================

export const siteConfig = {
  name: "Insight Vault",
  tagline: "Market Research Intelligence Platform",
  description:
    "Access comprehensive market research reports, trending industry insights, and AI-powered analysis across multiple sectors.",
  url: "https://insightvault.coherentmarketinsights.com",
  ogImage: "/images/og-image.jpg",
  email: "subscription@coherentmarketinsights.com",
  phone: "(555) 234-5678",
  socials: {
    instagram: "#",
    facebook: "#",
    twitter: "#",
  },
}

export interface ReportCategory {
  catId: number
  catName: string
  icon: string
}

// Categories matching the real database catid values
export const categories: ReportCategory[] = [
  { catId: 1, catName: "Automotive & Transportation", icon: "Car" },
  { catId: 2, catName: "Aerospace & Defence", icon: "Shield" },
  { catId: 3, catName: "Agriculture", icon: "Wheat" },
  { catId: 4, catName: "Healthcare", icon: "Stethoscope" },
  { catId: 5, catName: "Building & Construction", icon: "Building2" },
  { catId: 6, catName: "Pharmaceutical", icon: "Pill" },
  { catId: 7, catName: "Semiconductor", icon: "Cpu" },
  { catId: 8, catName: "ICT", icon: "Monitor" },
  { catId: 9, catName: "Mining", icon: "Pickaxe" },
  { catId: 10, catName: "Oil & Gas", icon: "Fuel" },
  { catId: 11, catName: "Power Generation", icon: "Zap" },
  { catId: 12, catName: "Medical Devices", icon: "HeartPulse" },
  { catId: 13, catName: "Textile", icon: "Shirt" },
  { catId: 14, catName: "Chemical & Materials", icon: "FlaskConical" },
  { catId: 15, catName: "Consumer Goods", icon: "ShoppingBag" },
  { catId: 16, catName: "Food & Beverages", icon: "UtensilsCrossed" },
  { catId: 17, catName: "Packaging", icon: "Package" },
  { catId: 18, catName: "Body Care", icon: "Sparkles" },
  { catId: 19, catName: "Energy & Mining", icon: "Flame" },
  { catId: 20, catName: "Chemical", icon: "FlaskRound" },
  { catId: 21, catName: "Electronics", icon: "CircuitBoard" },
  { catId: 22, catName: "Biotechnology", icon: "Dna" },
  { catId: 23, catName: "Veterinary", icon: "PawPrint" },
  { catId: 24, catName: "Environmental", icon: "Leaf" },
  { catId: 25, catName: "Others", icon: "LayoutGrid" },
  { catId: 26, catName: "Nutraceutical", icon: "Apple" },
]

export function getCategoryById(id: number) {
  return categories.find((c) => c.catId === id) || null
}

export function getCategoryName(id: number) {
  return getCategoryById(id)?.catName || "Unknown"
}
