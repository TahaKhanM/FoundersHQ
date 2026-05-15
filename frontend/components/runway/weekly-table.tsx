"use client"

import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { AlertTriangle } from "lucide-react"

import { EvidenceChip, Money } from "@/components/finance"
import { DataTable } from "@/components/ui/data-table"
import { formatDate } from "@/lib/utils/format"
import type { WeeklyForecastRowDTO } from "@/lib/api/types"

interface WeeklyTableProps {
  weekly: WeeklyForecastRowDTO[]
  onOpenEvidence: (id: string) => void
}

export function WeeklyTable({ weekly, onOpenEvidence }: WeeklyTableProps) {
  const columns = useMemo<ColumnDef<WeeklyForecastRowDTO>[]>(
    () => [
      {
        accessorKey: "weekStart",
        header: "Week",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-[color:var(--ink-2)]">
            {formatDate(row.original.weekStart, "MMM d")}
          </span>
        ),
      },
      {
        accessorKey: "startingCash",
        header: () => <span className="block text-right">Starting Cash</span>,
        cell: ({ row }) => (
          <span className="block text-right">
            <Money value={row.original.startingCash} />
          </span>
        ),
      },
      {
        accessorKey: "inflows",
        header: () => <span className="block text-right">Inflows</span>,
        cell: ({ row }) => (
          <span className="block text-right">
            <Money value={row.original.inflows} signed />
          </span>
        ),
      },
      {
        accessorKey: "outflows",
        header: () => <span className="block text-right">Outflows</span>,
        cell: ({ row }) => (
          <span className="block text-right">
            <Money value={-Math.abs(row.original.outflows)} />
          </span>
        ),
      },
      {
        accessorKey: "endingCash",
        header: () => <span className="block text-right">Ending Cash</span>,
        cell: ({ row }) => (
          <span className="block text-right font-medium">
            <Money value={row.original.endingCash} />
          </span>
        ),
      },
      {
        id: "evidence",
        header: "Sources",
        enableSorting: false,
        cell: ({ row }) => {
          if (row.original.evidenceIds.length === 0)
            return <span className="text-[11px] text-muted-foreground">—</span>
          return (
            <EvidenceChip
              ids={row.original.evidenceIds}
              kind="transaction"
              onOpen={(id) => onOpenEvidence(id)}
            />
          )
        },
      },
      {
        accessorKey: "notes",
        header: "Notes",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.notes ? (
            <span className="inline-flex items-center gap-1 text-xs text-[color:var(--warn)]">
              <AlertTriangle className="h-3 w-3" />
              {row.original.notes}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">—</span>
          ),
      },
    ],
    [onOpenEvidence],
  )

  return (
    <DataTable<WeeklyForecastRowDTO>
      id="runway-weekly"
      columns={columns}
      data={weekly}
      filterPlaceholder="Filter week, notes…"
      emptyNoData={<span>No weekly rows yet.</span>}
    />
  )
}
