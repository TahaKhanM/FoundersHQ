"use client"

import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api/client"
import { cn } from "@/lib/utils"

interface PageErrorProps {
  /** The thrown error; ApiError exposes a request-id. */
  error: unknown
  /** Friendly headline. Defaults to "Couldn't load this view." */
  title?: string
  /** Optional retry callback (e.g. `mutate` from SWR). */
  onRetry?: () => void
  className?: string
}

/**
 * Inline error state for page-level failures.
 *
 * Shows the human-readable message plus the `X-Request-ID` value from the
 * response (when the failure is an `ApiError`). Phase 1.D requires every
 * page to surface this id so support can trace a failure end-to-end.
 */
export function PageError({ error, title, onRetry, className }: PageErrorProps) {
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred."
  const requestId =
    error instanceof ApiError && error.requestId ? error.requestId : null

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/5 p-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          aria-hidden
          className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--danger)]"
        />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {title ?? "Couldn't load this view."}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {message}
          </p>
          {requestId ? (
            <p className="pt-1 font-mono text-[11px] text-muted-foreground">
              request-id:{" "}
              <span className="text-[color:var(--ink-2)]">{requestId}</span>
            </p>
          ) : null}
        </div>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}
