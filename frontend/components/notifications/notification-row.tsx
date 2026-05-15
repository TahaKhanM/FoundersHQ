"use client"

import { Archive, Check, Clock, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  archiveNotification,
  markNotificationRead,
  SNOOZE_OPTIONS,
  snoozeNotification,
  type NotificationDTO,
  type SnoozeDuration,
} from "@/lib/api/queries/notifications"
import { cn } from "@/lib/utils"

interface NotificationRowProps {
  notification: NotificationDTO
  onChanged: (n: NotificationDTO) => void
}

const SEVERITY_BADGE: Record<string, "destructive" | "secondary" | "outline"> = {
  critical: "destructive",
  warning: "secondary",
  info: "outline",
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return ""
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function NotificationRow({ notification, onChanged }: NotificationRowProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Optimistic local state: hide once the user acts so the row dims out
  // immediately while the network round-trip completes.
  const [optimistic, setOptimistic] = useState<NotificationDTO>(notification)

  async function withBusy(action: () => Promise<NotificationDTO>, optimisticPatch: Partial<NotificationDTO>) {
    setBusy(true)
    setError(null)
    const previous = optimistic
    const next = { ...previous, ...optimisticPatch }
    setOptimistic(next)
    onChanged(next)
    try {
      const fresh = await action()
      setOptimistic(fresh)
      onChanged(fresh)
    } catch (err) {
      // Roll the local state back and surface a short error string.
      setOptimistic(previous)
      onChanged(previous)
      setError(err instanceof Error ? err.message : "Action failed")
    } finally {
      setBusy(false)
    }
  }

  const isRead = optimistic.readAt !== null
  const isArchived = optimistic.archivedAt !== null
  const isSnoozed =
    optimistic.snoozedUntil !== null &&
    new Date(optimistic.snoozedUntil).getTime() > Date.now()

  return (
    <div
      className={cn(
        "group flex items-start gap-3 border-b border-border px-4 py-3 transition-colors",
        isRead ? "bg-background" : "bg-muted/20",
        busy && "opacity-60",
      )}
      data-testid={`notification-row-${notification.id}`}
    >
      <div className="flex w-1 shrink-0 flex-col self-stretch">
        {!isRead && (
          <span
            className="mt-1.5 inline-block h-2 w-2 rounded-full bg-primary"
            aria-label="Unread"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={cn(
              "truncate text-sm",
              isRead ? "font-medium text-muted-foreground" : "font-semibold text-foreground",
            )}
          >
            {optimistic.title}
          </p>
          <Badge
            variant={SEVERITY_BADGE[optimistic.severity] ?? "outline"}
            className="capitalize"
          >
            {optimistic.severity}
          </Badge>
          {isSnoozed && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              Snoozed
            </Badge>
          )}
          {isArchived && (
            <Badge variant="outline" className="gap-1">
              <Archive className="h-3 w-3" />
              Archived
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{optimistic.message}</p>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{formatTimeAgo(optimistic.createdAt)}</span>
          <span className="capitalize">{optimistic.type}</span>
          {optimistic.deepLink && (
            <Link
              href={optimistic.deepLink}
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Go to source
            </Link>
          )}
        </div>
        {error && (
          <p className="mt-2 text-xs text-destructive">{error}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {!isRead && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              withBusy(
                () => markNotificationRead(notification.id),
                { readAt: new Date().toISOString() },
              )
            }
            aria-label="Mark as read"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" disabled={busy || isSnoozed} aria-label="Snooze">
              <Clock className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Snooze for</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SNOOZE_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onSelect={() =>
                  void withBusy(
                    () => snoozeNotification(notification.id, opt.value as SnoozeDuration),
                    {
                      snoozedUntil: new Date(
                        Date.now() + estimateSnoozeMs(opt.value as SnoozeDuration),
                      ).toISOString(),
                    },
                  )
                }
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {!isArchived && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              withBusy(
                () => archiveNotification(notification.id),
                { archivedAt: new Date().toISOString() },
              )
            }
            aria-label="Archive"
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

function estimateSnoozeMs(duration: SnoozeDuration): number {
  // Mirror the server-side mapping for the optimistic UI; the server's
  // response (which we adopt afterwards) is the source of truth.
  if (duration === "1h") return 60 * 60 * 1000
  if (duration === "4h") return 4 * 60 * 60 * 1000
  if (duration === "24h") return 24 * 60 * 60 * 1000
  // monday — pick an approximation; gets overwritten by the server's response.
  return 3 * 24 * 60 * 60 * 1000
}
