"use client"

import { Bell, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAlerts } from "@/lib/api/hooks"

export function TopBar() {
  const { data: alerts } = useAlerts()
  const criticalCount = alerts?.filter((a) => a.severity === "critical").length ?? 0

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-card px-6">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search transactions, invoices..."
          className="pl-9 bg-muted/50 border-0"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {criticalCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-4 w-4 justify-center p-0 text-[10px]"
            >
              {criticalCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>

        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              FH
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-foreground leading-none">
              Demo User
            </p>
            <p className="text-xs text-muted-foreground">founder@example.com</p>
          </div>
        </div>
      </div>
    </header>
  )
}
