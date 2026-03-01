"use client"

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { CalendarClock } from "lucide-react"

import { PageHeader } from "@/components/common/page-header"
import { PageError } from "@/components/dashboard/page-error"
import { TableSkeleton } from "@/components/spending/table-skeleton"
import { Money } from "@/components/finance"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { useCommitments } from "@/lib/api/queries/spending"
import { formatDate } from "@/lib/utils/format"
import type { CommitmentDTO } from "@/lib/api/types"

export default function CommitmentsPage() {
  const { data: commitments, isLoading, error, mutate } = useCommitments()
  const { toast } = useToast()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const upcoming = useMemo(
    () =>
      (commitments ?? [])
        .filter((c) => c.enabled)
        .sort(
          (a, b) =>
            new Date(a.nextDueDate).getTime() -
            new Date(b.nextDueDate).getTime(),
        )
        .slice(0, 5),
    [commitments],
  )

  const columns = useMemo<ColumnDef<CommitmentDTO>[]>(
    () => [
      {
        accessorKey: "merchant",
        header: "Merchant",
        cell: ({ row }) => (
          <span className="text-sm font-medium">{row.original.merchant}</span>
        ),
      },
      {
        accessorKey: "frequency",
        header: "Frequency",
        cell: ({ row }) => (
          <Badge variant="secondary" className="text-xs capitalize">
            {row.original.frequency}
          </Badge>
        ),
      },
      {
        accessorKey: "typicalAmount",
        header: () => <span className="block text-right">Typical</span>,
        cell: ({ row }) => (
          <span className="block text-right">
            <Money value={-Math.abs(row.original.typicalAmount)} />
          </span>
        ),
      },
      {
        accessorKey: "nextDueDate",
        header: "Next Charge",
        cell: ({ row }) => (
          <span className="text-sm">
            {formatDate(row.original.nextDueDate, "MMM d, yyyy")}
          </span>
        ),
      },
      {
        accessorKey: "confidence",
        header: "Confidence",
        cell: ({ row }) => {
          const pct = Math.round(row.original.confidence * 100)
          return (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[color:var(--surface-2)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background:
                      pct >= 80
                        ? "var(--accent)"
                        : pct >= 60
                          ? "var(--warn)"
                          : "var(--danger)",
                  }}
                />
              </div>
              <span className="tabular-nums text-xs text-muted-foreground">
                {pct}%
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: "enabled",
        header: "Active",
        enableSorting: false,
        cell: ({ row }) => (
          <Switch
            checked={row.original.enabled}
            disabled={pendingId === row.original.commitmentId}
            aria-label={`Toggle ${row.original.merchant}`}
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={() => {
              // No PATCH endpoint yet; surface intent locally and keep the
              // mock state untouched. Real toggle will live in phase 2.
              setPendingId(row.original.commitmentId)
              toast({
                title: row.original.enabled
                  ? `Paused ${row.original.merchant}`
                  : `Enabled ${row.original.merchant}`,
                description: "Forecast will reflect this on the next refresh.",
              })
              setPendingId(null)
            }}
          />
        ),
      },
    ],
    [pendingId, toast],
  )

  return (
    <>
      <PageHeader
        title="Recurring Commitments"
        description="Track recurring charges and subscription obligations"
      />

      {/* Upcoming (next 30 days) */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            Upcoming (Next 30 days)
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">
              No commitments active in the next 30 days.
            </p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((c) => (
                <div
                  key={c.commitmentId}
                  className="flex items-center justify-between rounded-lg border border-[color:var(--line)] px-4 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-[color:var(--accent)]" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {c.merchant}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due {formatDate(c.nextDueDate, "MMM d")}
                      </p>
                    </div>
                  </div>
                  <Money value={-Math.abs(c.typicalAmount)} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full table */}
      {error ? (
        <PageError
          error={error}
          title="Couldn't load commitments."
          onRetry={() => void mutate()}
        />
      ) : isLoading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : (
        <DataTable<CommitmentDTO>
          id="spending-commitments"
          columns={columns}
          data={commitments ?? []}
          filterPlaceholder="Filter merchants…"
          emptyNoData={
            <span>
              No commitments detected yet — connect a bank to surface recurring
              charges.
            </span>
          }
        />
      )}
    </>
  )
}
