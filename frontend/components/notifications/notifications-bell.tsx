"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Bell } from "lucide-react"

interface NotificationsBellProps {
  unreadCount: number
  onClick: () => void
  className?: string
}

export function NotificationsBell({
  unreadCount,
  onClick,
  className,
}: NotificationsBellProps) {
  const hasUnread = unreadCount > 0
  const displayCount = unreadCount > 99 ? "99+" : unreadCount.toString()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={`Notifications${hasUnread ? `, ${unreadCount} unread` : ""}`}
      className={cn("relative", className)}
    >
      <Bell className="h-5 w-5" />
      {hasUnread && (
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 flex items-center justify-center",
            "min-w-[18px] h-[18px] px-1 rounded-full",
            "bg-destructive text-destructive-foreground",
            "text-[10px] font-bold"
          )}
          aria-hidden="true"
        >
          {displayCount}
        </span>
      )}
    </Button>
  )
}
