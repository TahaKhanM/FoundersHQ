"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { NotificationRow } from "@/components/notifications/notification-row"
import { NotificationPreferences } from "@/components/notifications/preferences"
import {
  useNotificationsList,
  useNotificationsMutate,
  type NotificationDTO,
  type NotificationStatus,
} from "@/lib/api/queries/notifications"
import { useRealtimeChannel } from "@/lib/realtime/hooks"

const VALID_TABS: NotificationStatus[] = ["unread", "all", "archived"]

const TAB_LABELS: Record<NotificationStatus, string> = {
  unread: "Unread",
  all: "All",
  archived: "Archived",
}

const TAB_EMPTY: Record<NotificationStatus, { title: string; description: string }> = {
  unread: {
    title: "Inbox zero.",
    description:
      "Nothing requires your attention right now. Connect a bank or import invoices to start receiving insights.",
  },
  all: {
    title: "No notifications yet.",
    description:
      "Once you connect data sources, deterministic insights about runway, spending, and invoices will appear here.",
  },
  archived: {
    title: "Nothing in the archive.",
    description: "Archived notifications will show up here so you can revisit them later.",
  },
}

export default function InboxPage() {
  // useSearchParams() requires a Suspense boundary for static prerender.
  return (
    <Suspense fallback={null}>
      <InboxPageInner />
    </Suspense>
  )
}

function InboxPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const rawTab = params.get("tab")
  const tab: NotificationStatus = (
    VALID_TABS.includes(rawTab as NotificationStatus) ? rawTab : "unread"
  ) as NotificationStatus

  const list = useNotificationsList(tab, 50)
  const { refreshAll } = useNotificationsMutate()

  // Live updates: any new or updated notification revalidates the active list.
  useRealtimeChannel("notification.created", () => refreshAll())
  useRealtimeChannel("notification.updated", () => refreshAll())

  const handleTabChange = useCallback(
    (next: string) => {
      const search = new URLSearchParams(params.toString())
      search.set("tab", next)
      router.replace(`/inbox?${search.toString()}`)
    },
    [params, router],
  )

  const handleRowChanged = useCallback(
    (n: NotificationDTO) => {
      // Optimistic update is local to the row; we also revalidate the
      // server cache so unread counts and other tabs stay in sync.
      void list.mutate(
        (current) => current?.map((row) => (row.id === n.id ? n : row)),
        { revalidate: false },
      )
      refreshAll()
    },
    [list, refreshAll],
  )

  const items = list.data ?? []

  return (
    <>
      <PageHeader
        title="Inbox"
        description="Every alert, every insight — deterministic, audited, and dismissible."
        actions={
          <Button variant="ghost" size="sm" onClick={() => void list.mutate()}>
            Refresh
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          {VALID_TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {TAB_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>

        {VALID_TABS.map((t) => (
          <TabsContent key={t} value={t} className="space-y-4">
            <Card>
              <CardContent className="p-0">
                {list.isLoading && (
                  <div className="space-y-2 p-4">
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                )}
                {list.error && !list.isLoading && (
                  <div className="p-6 text-sm text-destructive">
                    Failed to load notifications.{" "}
                    <Button variant="link" className="px-1" onClick={() => list.mutate()}>
                      Retry
                    </Button>
                  </div>
                )}
                {!list.isLoading && !list.error && items.length === 0 && (
                  <div className="p-6">
                    <EmptyState
                      title={TAB_EMPTY[t].title}
                      description={TAB_EMPTY[t].description}
                      actionLabel={
                        t === "unread" ? "Connect a bank" : undefined
                      }
                      onAction={
                        t === "unread"
                          ? () => router.push("/settings")
                          : undefined
                      }
                    />
                  </div>
                )}
                {!list.isLoading && !list.error && items.length > 0 && (
                  <div>
                    {items.map((n) => (
                      <NotificationRow
                        key={n.id}
                        notification={n}
                        onChanged={handleRowChanged}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <div className="mt-8 max-w-3xl">
        <NotificationPreferences />
      </div>
    </>
  )
}
