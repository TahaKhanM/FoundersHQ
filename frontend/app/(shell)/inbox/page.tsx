"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { InsightRow } from "@/components/notifications/insight-row"
import { NotificationRow } from "@/components/notifications/notification-row"
import { NotificationPreferences } from "@/components/notifications/preferences"
import {
  useInsights,
  useInsightsMutate,
} from "@/lib/api/queries/insights"
import {
  useNotificationsList,
  useNotificationsMutate,
  type NotificationDTO,
  type NotificationStatus,
} from "@/lib/api/queries/notifications"
import { useRealtimeChannel } from "@/lib/realtime/hooks"

type InboxTab = NotificationStatus | "insights"

const VALID_TABS: InboxTab[] = ["unread", "all", "archived", "insights"]

const TAB_LABELS: Record<InboxTab, string> = {
  unread: "Unread",
  all: "All",
  archived: "Archived",
  insights: "Insights",
}

const TAB_EMPTY: Record<InboxTab, { title: string; description: string }> = {
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
  insights: {
    title: "No active insights.",
    description:
      "Insights surface automatically when cash, invoices, or spending change in interesting ways.",
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
  const tab: InboxTab = (
    VALID_TABS.includes(rawTab as InboxTab) ? rawTab : "unread"
  ) as InboxTab
  const isInsights = tab === "insights"

  const list = useNotificationsList(
    isInsights ? "unread" : (tab as NotificationStatus),
    50,
  )
  const insights = useInsights("active", 50)
  const { refreshAll } = useNotificationsMutate()
  const { refreshAll: refreshInsights } = useInsightsMutate()

  // Live updates: notifications + insights both revalidate.
  useRealtimeChannel("notification.created", () => refreshAll())
  useRealtimeChannel("notification.updated", () => refreshAll())
  useRealtimeChannel("insight.created", () => refreshInsights())

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

        {VALID_TABS.map((t) => {
          const onInsightsTab = t === "insights"
          const loading = onInsightsTab ? insights.isLoading : list.isLoading
          const err = onInsightsTab ? insights.error : list.error
          const rows = onInsightsTab ? insights.data ?? [] : items
          const empty = !loading && !err && rows.length === 0
          return (
          <TabsContent key={t} value={t} className="space-y-4">
            <Card>
              <CardContent className="p-0">
                {loading && (
                  <div className="space-y-2 p-4">
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                )}
                {err && !loading && (
                  <div className="p-6 text-sm text-destructive">
                    Failed to load {onInsightsTab ? "insights" : "notifications"}.{" "}
                    <Button
                      variant="link"
                      className="px-1"
                      onClick={() => (onInsightsTab ? insights.mutate() : list.mutate())}
                    >
                      Retry
                    </Button>
                  </div>
                )}
                {empty && (
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
                {!loading && !err && rows.length > 0 && onInsightsTab && (
                  <div>
                    {(insights.data ?? []).map((insight) => (
                      <InsightRow
                        key={insight.id}
                        insight={insight}
                        onDismiss={() => refreshInsights()}
                      />
                    ))}
                  </div>
                )}
                {!loading && !err && rows.length > 0 && !onInsightsTab && (
                  <div>
                    {(rows as NotificationDTO[]).map((n) => (
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
          )
        })}
      </Tabs>

      <div className="mt-8 max-w-3xl">
        <NotificationPreferences />
      </div>
    </>
  )
}
