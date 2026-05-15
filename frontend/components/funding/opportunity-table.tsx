"use client"

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Bookmark, BookmarkCheck, ExternalLink } from "lucide-react"

import { Money } from "@/components/finance"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/utils/format"
import type { FundingOpportunityDTO } from "@/lib/api/types"

interface OpportunityTableProps {
  opportunities: FundingOpportunityDTO[]
}

/**
 * Opportunity table — composes `<DataTable>` and surfaces an inline
 * "Save" toggle per row. Saved state is local to this surface until a
 * persistence endpoint lands in phase 3 (parking-lot tracked).
 */
export function OpportunityTable({ opportunities }: OpportunityTableProps) {
  const { toast } = useToast()
  const [saved, setSaved] = useState<Set<string>>(new Set())

  const toggle = (id: string, name: string) => {
    setSaved((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        toast({ title: `Removed ${name}`, description: "Unsaved from shortlist." })
      } else {
        next.add(id)
        toast({ title: `Saved ${name}`, description: "Added to your shortlist." })
      }
      return next
    })
  }

  const columns = useMemo<ColumnDef<FundingOpportunityDTO>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Opportunity",
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium text-foreground">
              {row.original.name}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.provider} · {row.original.type.replace(/_/g, " ")}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "geography",
        header: "Geo",
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {row.original.geography}
          </Badge>
        ),
      },
      {
        id: "range",
        header: () => <span className="block text-right">Range</span>,
        accessorFn: (r) => r.amountMin,
        cell: ({ row }) => (
          <span className="block text-right text-sm tabular-nums">
            <Money value={row.original.amountMin} />
            {" – "}
            <Money value={row.original.amountMax} />
          </span>
        ),
      },
      {
        accessorKey: "deadline",
        header: "Deadline",
        cell: ({ row }) =>
          row.original.deadline ? (
            <span className="text-sm">{formatDate(row.original.deadline)}</span>
          ) : (
            <span className="text-[11px] text-muted-foreground">No deadline</span>
          ),
      },
      {
        accessorKey: "tags",
        header: "Tags",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.tags.slice(0, 3).map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px]">
                {t}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        accessorKey: "parseConfidence",
        header: "Conf",
        cell: ({ row }) => {
          const pct = Math.round(row.original.parseConfidence * 100)
          const color =
            pct >= 80
              ? "var(--accent)"
              : pct >= 60
                ? "var(--warn)"
                : "var(--danger)"
          return (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[color:var(--surface-2)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {pct}%
              </span>
            </div>
          )
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const isSaved = saved.has(row.original.opportunityId)
          return (
            <div
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant={isSaved ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => toggle(row.original.opportunityId, row.original.name)}
                aria-pressed={isSaved}
              >
                {isSaved ? (
                  <BookmarkCheck className="mr-1 h-3 w-3" />
                ) : (
                  <Bookmark className="mr-1 h-3 w-3" />
                )}
                {isSaved ? "Saved" : "Save"}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                Details <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </div>
          )
        },
      },
    ],
    [saved],
  )

  return (
    <DataTable<FundingOpportunityDTO>
      id="funding-opportunities"
      columns={columns}
      data={opportunities}
      filterPlaceholder="Filter providers, tags, geos…"
      emptyNoData={
        <span>
          No matching funding opportunities yet — phase 2 connects scraping
          and external feeds.
        </span>
      }
    />
  )
}
