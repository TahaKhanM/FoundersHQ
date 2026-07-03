"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Download } from "lucide-react"
import { type ColumnDef } from "@tanstack/react-table"

import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { AuditFilters } from "@/components/settings/audit-filters"
import { useToast } from "@/hooks/use-toast"
import {
  downloadAuditCsv,
  useAuditLogs,
} from "@/lib/api/queries/audit"
import type { AuditLogDTO, AuditLogFilters as AuditLogFiltersType } from "@/lib/api/types"

const FILTER_PARAM_KEYS = ["action", "entity_type", "user_id", "from", "to"] as const

function readFiltersFromUrl(params: URLSearchParams): AuditLogFiltersType {
  return {
    action: params.get("action") ?? undefined,
    entityType: params.get("entity_type") ?? undefined,
    userId: params.get("user_id") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  }
}

function writeFiltersToUrl(filters: AuditLogFiltersType): string {
  const p = new URLSearchParams()
  if (filters.action) p.set("action", filters.action)
  if (filters.entityType) p.set("entity_type", filters.entityType)
  if (filters.userId) p.set("user_id", filters.userId)
  if (filters.from) p.set("from", filters.from)
  if (filters.to) p.set("to", filters.to)
  const qs = p.toString()
  return qs ? `?${qs}` : ""
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function compactJson(obj: Record<string, unknown>): string {
  try {
    return JSON.stringify(obj)
  } catch {
    return "{}"
  }
}

export default function AuditLogPage() {
  // useSearchParams() requires a Suspense boundary for static prerender.
  return (
    <Suspense fallback={null}>
      <AuditLogPageInner />
    </Suspense>
  )
}

function AuditLogPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Filters live in URL so they're shareable + survive reload.
  const filters = useMemo(
    () => readFiltersFromUrl(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )

  const [selected, setSelected] = useState<AuditLogDTO | null>(null)
  const [exporting, setExporting] = useState(false)

  const { data, error, isLoading } = useAuditLogs({ ...filters, limit: 50 })

  const setFilters = useCallback(
    (next: AuditLogFiltersType) => {
      // Strip cursor; URL has no cursor in this MVP (we render the first page only).
      const { cursor: _cursor, limit: _limit, ...rest } = next
      router.replace(`/settings/audit${writeFiltersToUrl(rest)}`)
    },
    [router],
  )

  const clearFilters = useCallback(() => {
    router.replace("/settings/audit")
  }, [router])

  // Guard against stale params after a hard navigation removing a filter.
  useEffect(() => {
    const current = readFiltersFromUrl(new URLSearchParams(searchParams.toString()))
    for (const k of FILTER_PARAM_KEYS) {
      void searchParams.get(k)
    }
    void current
  }, [searchParams])

  async function handleExport() {
    setExporting(true)
    try {
      await downloadAuditCsv(filters)
      toast({ title: "Export ready", description: "CSV downloaded." })
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const columns = useMemo<ColumnDef<AuditLogDTO>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Time",
        cell: ({ row }) => (
          <span className="tabular-nums text-xs text-muted-foreground">
            {formatTimestamp(row.original.createdAt)}
          </span>
        ),
        size: 180,
      },
      {
        accessorKey: "action",
        header: "Action",
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono text-[11px]">
            {row.original.action}
          </Badge>
        ),
      },
      {
        accessorKey: "entityType",
        header: "Entity",
        cell: ({ row }) => {
          const r = row.original
          return (
            <span className="text-xs">
              <span className="text-foreground">{r.entityType}</span>
              {r.entityId ? (
                <span className="ml-1.5 font-mono text-muted-foreground">
                  {r.entityId.length > 12 ? `${r.entityId.slice(0, 8)}…` : r.entityId}
                </span>
              ) : null}
            </span>
          )
        },
      },
      {
        accessorKey: "userId",
        header: "User",
        cell: ({ row }) =>
          row.original.userId ? (
            <span className="font-mono text-xs text-muted-foreground">
              {row.original.userId.slice(0, 8)}…
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">system</span>
          ),
      },
      {
        accessorKey: "requestId",
        header: "Request",
        cell: ({ row }) => {
          const rid = row.original.requestId
          if (!rid) return <span className="text-xs text-muted-foreground">—</span>
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                void navigator.clipboard.writeText(rid)
                toast({ title: "Request ID copied", description: rid })
              }}
              className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
              title="Copy request ID"
            >
              {rid.length > 10 ? `${rid.slice(0, 8)}…` : rid}
            </button>
          )
        },
      },
      {
        accessorKey: "details",
        header: "Details",
        cell: ({ row }) => {
          const compact = compactJson(row.original.details)
          const display = compact.length > 60 ? `${compact.slice(0, 60)}…` : compact
          return (
            <code className="font-mono text-[11px] text-muted-foreground">{display}</code>
          )
        },
      },
    ],
    [toast],
  )

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Every mutation in your organization, with filters."
        actions={
          <Button onClick={handleExport} disabled={exporting} size="sm" variant="outline">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        }
      />

      <div className="space-y-4">
        <AuditFilters value={filters} onChange={setFilters} onClear={clearFilters} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isLoading ? "Loading…" : `${data?.items.length ?? 0} events`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">
                Failed to load audit log. {error instanceof Error ? error.message : ""}
              </p>
            ) : (
              <DataTable
                columns={columns}
                data={data?.items ?? []}
                onRowOpen={(row) => setSelected(row)}
                hideToolbar
                emptyNoData={
                  <span>
                    No audit events in the current window. Try widening the date range.
                  </span>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-[480px] sm:max-w-[520px]">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono text-sm">{selected.action}</SheetTitle>
                <SheetDescription>
                  {formatTimestamp(selected.createdAt)} ·{" "}
                  <span className="font-mono">{selected.entityType}</span>
                  {selected.entityId ? (
                    <span className="ml-1 font-mono text-xs">{selected.entityId}</span>
                  ) : null}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-3 text-xs">
                <Field label="User ID" value={selected.userId ?? "system"} mono />
                <Field label="Request ID" value={selected.requestId ?? "—"} mono />
                <div>
                  <div className="mb-1 text-muted-foreground">Details</div>
                  <pre className="overflow-auto rounded-md bg-muted/50 p-3 font-mono text-[11px] leading-snug">
{JSON.stringify(selected.details, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
      <div className="text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-[11px] break-all" : ""}>{value}</div>
    </div>
  )
}
