"use client"

import { useMemo } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"

import { Money } from "@/components/finance"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/format"
import type { InvoiceDTO } from "@/lib/api/types"

interface InvoiceListTableProps {
  invoices: InvoiceDTO[]
  hasExternalFilter?: boolean
  onOpenInvoice: (invoiceId: string) => void
}

const statusStyles: Record<InvoiceDTO["status"], string> = {
  paid: "border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 text-[color:var(--accent)]",
  open: "border-[color:var(--ink-3)]/30 bg-[color:var(--surface-2)] text-[color:var(--ink-2)]",
  overdue:
    "border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 text-[color:var(--danger)]",
}

const confidenceStyles: Record<InvoiceDTO["confidenceTier"], string> = {
  high: "border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 text-[color:var(--accent)]",
  medium:
    "border-[color:var(--warn)]/30 bg-[color:var(--warn)]/10 text-[color:var(--warn)]",
  low: "border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 text-[color:var(--danger)]",
}

/**
 * Invoice list table — built on `<DataTable>` so it inherits the sticky
 * first column, j/k keyboard nav, and "/" filter focus by default.
 *
 * - `<Money>` is used for every amount.
 * - Status / confidence chips use oklch tokens.
 * - Risk score renders a token-driven bar (accent / warn / danger).
 */
export function InvoiceListTable({
  invoices,
  hasExternalFilter = false,
  onOpenInvoice,
}: InvoiceListTableProps) {
  const columns = useMemo<ColumnDef<InvoiceDTO>[]>(
    () => [
      {
        accessorKey: "invoiceId",
        header: "Invoice",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-[color:var(--ink-2)]">
            {row.original.invoiceId.replace("inv_", "INV-")}
          </span>
        ),
      },
      {
        accessorKey: "customerName",
        header: "Customer",
        cell: ({ row }) => (
          <Link
            href={`/invoices/customers/${row.original.customerId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium text-foreground hover:underline"
          >
            {row.original.customerName}
          </Link>
        ),
      },
      {
        accessorKey: "amount",
        header: () => <span className="block text-right">Amount</span>,
        cell: ({ row }) => (
          <span className="block text-right">
            <Money value={row.original.amount} currency={row.original.currency} />
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn("text-xs capitalize", statusStyles[row.original.status])}
          >
            {row.original.status}
            {row.original.daysOverdue > 0
              ? ` (${row.original.daysOverdue}d)`
              : null}
          </Badge>
        ),
      },
      {
        accessorKey: "dueDate",
        header: "Due",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.dueDate)}
          </span>
        ),
      },
      {
        accessorKey: "riskScore",
        header: "Risk",
        cell: ({ row }) => {
          const v = row.original.riskScore
          const color =
            v > 70
              ? "var(--danger)"
              : v > 40
                ? "var(--warn)"
                : "var(--accent)"
          return (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[color:var(--surface-2)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${v}%`, background: color }}
                />
              </div>
              <span className="tabular-nums text-xs text-muted-foreground">
                {v}
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: "confidenceTier",
        header: "Confidence",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn(
              "text-xs capitalize",
              confidenceStyles[row.original.confidenceTier],
            )}
          >
            {row.original.confidenceTier}
          </Badge>
        ),
      },
      {
        accessorKey: "expectedPayDateBase",
        header: "Expected (base)",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.expectedPayDateBase
              ? formatDate(row.original.expectedPayDateBase)
              : "—"}
          </span>
        ),
      },
    ],
    [],
  )

  return (
    <DataTable<InvoiceDTO>
      id="invoice-list"
      columns={columns}
      data={invoices}
      onRowOpen={(row) => onOpenInvoice(row.invoiceId)}
      filterPlaceholder="Filter by customer, ID, status…"
      emptyNoData={
        hasExternalFilter ? (
          <span>
            No invoices match the active filters. Clear filters to see
            everything.
          </span>
        ) : (
          <span>
            No invoices yet —{" "}
            <Link
              href="/invoices/imports"
              className="text-[color:var(--accent)] underline"
            >
              import a CSV
            </Link>{" "}
            to get started.
          </span>
        )
      }
    />
  )
}
