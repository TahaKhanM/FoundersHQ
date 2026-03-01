"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"

interface PromptSuggestion {
  id: string
  text: string
}

interface PromptSuggestionGridProps {
  suggestions: PromptSuggestion[]
  onClick: (id: string) => void
  className?: string
  maxVisibleItems?: number
}

export function PromptSuggestionGrid({
  suggestions,
  onClick,
  className,
  maxVisibleItems,
}: PromptSuggestionGridProps) {
  const visibleSuggestions = maxVisibleItems
    ? suggestions.slice(0, maxVisibleItems)
    : suggestions

  if (visibleSuggestions.length === 0) {
    return null
  }

  return (
    <div
      className={cn("w-full", className)}
      role="list"
      aria-label="Suggested prompts"
    >
      <div className="flex flex-wrap gap-2">
        {visibleSuggestions.map((suggestion) => (
          <Button
            key={suggestion.id}
            variant="outline"
            size="sm"
            onClick={() => onClick(suggestion.id)}
            className={cn(
              "h-auto py-2 px-3 text-left font-normal",
              "whitespace-normal break-words",
              "max-w-full sm:max-w-[calc(50%-4px)] lg:max-w-[calc(33.333%-6px)]",
              "hover:bg-accent hover:border-accent-foreground/20",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            role="listitem"
          >
            <span className="line-clamp-2 text-sm">{suggestion.text}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}

// Alternative card-style variant
export function PromptSuggestionCards({
  suggestions,
  onClick,
  className,
}: PromptSuggestionGridProps) {
  if (suggestions.length === 0) {
    return null
  }

  return (
    <div
      className={cn("w-full", className)}
      role="list"
      aria-label="Suggested prompts"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            onClick={() => onClick(suggestion.id)}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border bg-card text-left",
              "transition-colors hover:bg-accent hover:border-accent-foreground/20",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            role="listitem"
          >
            <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <span className="text-sm line-clamp-3">{suggestion.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
