"use client"

import { useState, useEffect } from "react"
import { Bell, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAlerts } from "@/lib/api/hooks"
import { GlobalCommandPalette } from "@/components/common/global-command-palette"

export function TopBar() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { data: alerts } = useAlerts()
  const criticalCount = alerts?.filter((a) => a.severity === "critical").length ?? 0

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return (
    <>
      <header className="flex h-14 items-center gap-4 border-b border-border bg-card px-6">
        <button
          type="button"
          className="relative flex flex-1 max-w-md items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/80"
          onClick={() => setPaletteOpen(true)}
        >
          <Search className="h-4 w-4 shrink-0" />
          <span>Search transactions, invoices...</span>
          <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>

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

      <GlobalCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  )
}
