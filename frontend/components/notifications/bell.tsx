"use client"

import Link from "next/link"
import { Bell as BellIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  useActiveInsightCount,
  useInsightsMutate,
} from "@/lib/api/queries/insights"
import {
  useNotificationCount,
  useNotificationsList,
  useNotificationsMutate,
  type NotificationDTO,
} from "@/lib/api/queries/notifications"
import { useRealtimeChannel } from "@/lib/realtime/hooks"
import { cn } from "@/lib/utils"

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-destructive",
  warning: "bg-amber-500",
  info: "bg-sky-500",
}

function formatBadge(count: number): string {
  if (count > 99) return "99+"
  return String(count)
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

export function Bell() {
  const { data: notificationCount = 0 } = useNotificationCount()
  const { data: insightCount = 0 } = useActiveInsightCount()
  const { data: unread = [] } = useNotificationsList("unread", 5)
  const { refreshAll } = useNotificationsMutate()
  const { refreshAll: refreshInsights } = useInsightsMutate()

  const count = notificationCount + insightCount

  // Live update: notifications + insights both poke the badge.
  useRealtimeChannel("notification.created", () => {
    refreshAll()
  })
  useRealtimeChannel("notification.updated", () => {
    refreshAll()
  })
  useRealtimeChannel("insight.created", () => {
    refreshInsights()
  })

  const top5: NotificationDTO[] = unread.slice(0, 5)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications, ${count} unread`}
        >
          <BellIcon className="h-4 w-4 text-muted-foreground" />
          {count > 0 && (
            <Badge
              variant="destructive"
              className={cn(
                "absolute -right-1 -top-1 h-4 min-w-4 justify-center px-1 text-[10px] leading-none",
              )}
              data-testid="bell-badge"
            >
              {formatBadge(count)}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <p className="text-sm font-medium text-foreground">Notifications</p>
          <Link
            href="/inbox"
            className="text-xs font-medium text-primary hover:underline"
          >
            See all
          </Link>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {top5.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {top5.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <Link
                    href={n.deepLink ?? "/inbox"}
                    className="block hover:bg-muted/40 -mx-4 px-4 py-1 rounded-sm"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full",
                          SEVERITY_DOT[n.severity] ?? "bg-muted-foreground",
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {n.title}
                        </p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {n.message}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground/70">
                          {formatTimeAgo(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
