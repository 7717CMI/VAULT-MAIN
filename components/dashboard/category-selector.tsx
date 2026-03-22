"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { categories } from "@/lib/data"
import { LayoutGrid } from "lucide-react"

interface CategorySelectorProps {
  selectedCategory: number | null
  onSelect: (catId: number) => void
}

export function CategorySelectorModal({
  onSelect,
}: {
  onSelect: (catId: number) => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const hasSelected = sessionStorage.getItem("iv_category_selected")
    if (!hasSelected) {
      setOpen(true)
    }
  }, [])

  function handleSelect(catId: number) {
    sessionStorage.setItem("iv_category_selected", String(catId))
    setOpen(false)
    onSelect(catId)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Choose Your Industry</DialogTitle>
          <DialogDescription>
            Select an industry category to personalize your dashboard with relevant reports.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-3">
            {categories.map((cat) => (
              <button
                key={cat.catId}
                onClick={() => handleSelect(cat.catId)}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:border-accent hover:bg-secondary"
              >
                <LayoutGrid className="size-5 text-accent" />
                <span className="text-xs font-medium">{cat.catName}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

export function CategoryTabs({
  selectedCategory,
  onSelect,
}: CategorySelectorProps) {
  const [showAll, setShowAll] = useState(false)
  const visibleCategories = showAll ? categories : categories.slice(0, 8)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={selectedCategory === null ? "default" : "outline"}
        size="sm"
        onClick={() => onSelect(0)}
      >
        All
      </Button>
      {visibleCategories.map((cat) => (
        <Button
          key={cat.catId}
          variant={selectedCategory === cat.catId ? "default" : "outline"}
          size="sm"
          onClick={() => onSelect(cat.catId)}
        >
          {cat.catName}
        </Button>
      ))}
      {categories.length > 8 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll(!showAll)}
          className="text-accent"
        >
          {showAll ? "Show Less" : `+${categories.length - 8} More`}
        </Button>
      )}
    </div>
  )
}
