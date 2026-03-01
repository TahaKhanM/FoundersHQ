"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { formatRelative } from "@/lib/utils/format"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  CheckCheck,
  ExternalLink,
  Archive,
  FileText,
} from "lucide-react"
import type { NotificationUI, NotificationSeverity } from "./types"

interface NotificationsDrawerProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  notifications: NotificationUI[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onArchive: (id: string) => void
  onOpen: (notification: NotificationUI) => void
  onEvidenceClick?: (evidenceId: string) => void
  className?: string
}

const severityConfig: Record<NotificationSeverity, {
  icon: React.ElementType
  bg: string
  border: string
  text: string
  label: string
}> = {
  critical: {
    icon: AlertTriangle,
    bg: "bg-destructive/10",
    border: "border-l-destructive",
    text: "text-destructive",
    label: "Critical",
  },
  warn: {
    icon: AlertCircle,
    bg: "bg-warning/10",
    border: "border-l-warning",
    text: "text-warning-foreground",
    label: "Warning",
  },
  info: {
    icon: Info,
    bg: "bg-chart-1/10",
    border: "border-l-chart-1",
    text: "text-chart-1",
    label: "Info",
  },
}

const severityOrder: NotificationSeverity[] = ["critical", "warn", "info"]

export function NotificationsDrawer({
  isOpen,
  onOpenChange,
  notifications,
  onMarkRead,
  onMarkAllRead,
  onArchive,
  onOpen,
  onEvidenceClick,
  className,
}: NotificationsDrawerProps) {
  const unreadCount = notifications.filter((n) => !n.isRead).length

  // Group by severity
  const groupedNotifications = React.useMemo(() => {
    const groups: Record<NotificationSeverity, NotificationUI[]> = {
      critical: [],
      warn: [],
      info: [],
    }

    notifications.forEach((notification) => {
      groups[notification.severity].push(notification)
    })

    return groups
  }, [notifications])

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn("w-full sm:max-w-md p-0", className)}
      >
        <SheetHeader className="px-4 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>Notifications</SheetTitle>
              <SheetDescription>
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                  : "All caught up!"}
              </SheetDescription>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMarkAllRead}
                className="gap-1.5 text-xs"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)]">
          <div className="py-2">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Info className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              severityOrder.map((severity) => {
                const items = groupedNotifications[severity]
                if (items.length === 0) return null

                const config = severityConfig[severity]
                const SeverityIcon = config.icon

                return (
                  <div key={severity} className="mb-4">
                    <div className="px-4 py-2 flex items-center gap-2">
                      <SeverityIcon className={cn("h-4 w-4", config.text)} />
                      <h3 className="text-sm font-semibold">{config.label}</h3>
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {items.length}
                      </span>
                    </div>

                    <div className="space-y-1 px-2">
                      {items.map((notification) => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          config={config}
                          onMarkRead={onMarkRead}
                          onArchive={onArchive}
                          onOpen={onOpen}
                          onEvidenceClick={onEvidenceClick}
                        />
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

interface NotificationItemProps {
  notification: NotificationUI
  config: typeof severityConfig[NotificationSeverity]
  onMarkRead: (id: string) => void
  onArchive: (id: string) => void
  onOpen: (notification: NotificationUI) => void
  onEvidenceClick?: (evidenceId: string) => void
}

function NotificationItem({
  notification,
  config,
  onMarkRead,
  onArchive,
  onOpen,
  onEvidenceClick,
}: NotificationItemProps) {
  const SeverityIcon = config.icon

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onOpen(notification)
    }
  }

  return (
    <div
      role="listitem"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative p-3 rounded-lg border-l-4 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        config.border,
        notification.isRead
          ? "bg-background"
          : cn(config.bg, "hover:bg-accent/50")
      )}
    >
      {/* Unread indicator */}
      {!notification.isRead && (
        <span
          className="absolute top-3 right-3 h-2 w-2 rounded-full bg-primary"
          aria-label="Unread"
        />
      )}

      <div className="flex items-start gap-3">
        <SeverityIcon className={cn("h-5 w-5 mt-0.5 shrink-0", config.text)} />
        <div className="flex-1 min-w-0 space-y-1">
          <p className={cn(
            "font-medium text-sm",
            !notification.isRead && "text-foreground"
          )}>
            {notification.title}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {notification.message}
          </p>

          {/* Evidence chips */}
          {notification.evidenceIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {notification.evidenceIds.map((evidenceId) => (
                <Badge
                  key={evidenceId}
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-accent gap-1"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEvidenceClick?.(evidenceId)
                  }}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      e.stopPropagation()
                      onEvidenceClick?.(evidenceId)
                    }
                  }}
                >
                  <FileText className="h-3 w-3" />
                  {evidenceId}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              {formatRelative(notification.createdAtISO)}
            </span>

            <div className="flex items-center gap-1">
              {!notification.isRead && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation()
                    onMarkRead(notification.id)
                  }}
                  aria-label="Mark as read"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation()
                  onArchive(notification.id)
                }}
                aria-label="Archive"
              >
                <Archive className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpen(notification)
                }}
                aria-label="View details"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
