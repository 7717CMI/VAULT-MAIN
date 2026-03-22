"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { categories } from "@/lib/data"
interface SearchSuggestion {
  newsid: number
  keyword: string
}

export function SearchBar() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  async function handleSearch(value: string) {
    setSearchQuery(value)
    if (value.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      setShowAI(false)
      return
    }

    try {
      const catParam = selectedCategory !== "all" ? `&catId=${selectedCategory}` : ""
      const res = await fetch(`/api/reports/search?q=${encodeURIComponent(value)}${catParam}`)
      const data = await res.json()

      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions)
        setShowSuggestions(true)
        setShowAI(false)
      } else {
        setSuggestions([])
        setShowSuggestions(false)
        setShowAI(true)
      }
    } catch {
      setSuggestions([])
    }
  }

  async function handleAIInsights() {
    if (!searchQuery) return
    setAiLoading(true)
    const catParam = selectedCategory !== "all" ? `&catId=${selectedCategory}` : ""
    router.push(`/dashboard/search?q=${encodeURIComponent(searchQuery)}${catParam}`)
  }

  function handleSuggestionClick(newsid: number) {
    setShowSuggestions(false)
    setSearchQuery("")
    router.push(`/dashboard/reports/${newsid}`)
  }

  function clearSearch() {
    setSearchQuery("")
    setSuggestions([])
    setShowSuggestions(false)
    setShowAI(false)
  }

  return (
    <div className="border-t border-border/50">
      <div className="mx-auto max-w-7xl px-4 py-3 lg:px-8" ref={searchRef}>
        <div className="flex items-center gap-2">
          {/* Category Selector */}
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[160px] shrink-0">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.catId} value={String(cat.catId)}>
                  {cat.catName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-md border bg-popover shadow-lg">
                {suggestions.map((s) => (
                  <button
                    key={s.newsid}
                    onClick={() => handleSuggestionClick(s.newsid)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-secondary"
                  >
                    <Search className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{s.keyword}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* AI Insights Button */}
          {showAI && (
            <Button
              onClick={handleAIInsights}
              disabled={aiLoading}
              variant="outline"
              className="shrink-0 gap-2"
            >
              <Search className="size-4 text-accent" />
              <span className="hidden sm:inline">Search</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
