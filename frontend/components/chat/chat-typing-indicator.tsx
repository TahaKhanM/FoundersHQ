"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ChatTypingIndicatorProps {
  className?: string
}

export function ChatTypingIndicator({ className }: ChatTypingIndicatorProps) {
  return (
    <div
      className={cn("flex items-center gap-1 p-2", className)}
      role="status"
      aria-label="Assistant is typing"
    >
      <span className="sr-only">Assistant is typing</span>
      <span
        className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-[bounce_1.4s_ease-in-out_infinite]"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-[bounce_1.4s_ease-in-out_infinite]"
        style={{ animationDelay: "200ms" }}
      />
      <span
        className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-[bounce_1.4s_ease-in-out_infinite]"
        style={{ animationDelay: "400ms" }}
      />
    </div>
  )
}

// Alternative variant with text
export function ChatTypingIndicatorWithLabel({ 
  label = "Thinking...",
  className,
}: { 
  label?: string
  className?: string 
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted",
        className
      )}
      role="status"
      aria-label={label}
    >
      <div className="flex items-center gap-1">
        <span
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-[bounce_1.4s_ease-in-out_infinite]"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-[bounce_1.4s_ease-in-out_infinite]"
          style={{ animationDelay: "200ms" }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-[bounce_1.4s_ease-in-out_infinite]"
          style={{ animationDelay: "400ms" }}
        />
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}
