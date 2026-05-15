"use client"

import { useCallback, useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"

import { Money } from "@/components/finance"
import { DataTable } from "@/components/ui/data-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/utils/format"
import type { CategoryDTO, TransactionDTO } from "@/lib/api/types"

interface TransactionsTableProps {
  transactions: TransactionDTO[]
  categories: CategoryDTO[]
  onOpenTransaction: (txnId: string) => void
  onChangeCategory: (
    args: { txnId: string; categoryId: string },
  ) => Promise<unknown> | unknown
  /** Whether *any* user filter (search, category) is active outside the
   * DataTable's built-in filter — used to differentiate "no data at all"
   * from "no matches" when the server-side query returns nothing. */
  hasExternalFilter?: boolean
}

/**
 * Transactions table built on the canonical `<DataTable>` primitive.
 *
 * - Date / Merchant / Category / Amount / ID columns.
 * - Amount uses `<Money>` (no `toLocaleString`).
 * - Inline category edit via shadcn `<Select>`; submit-on-change.
 * - Keyboard nav (j/k, /, Enter, Cmd-click) is provided by DataTable.
 */
export function TransactionsTable({
  transactions,
  categories,
  onOpenTransaction,
  onChangeCategory,
  hasExternalFilter = false,
}: TransactionsTableProps) {
  const { toast } = useToast()
  const [savingId, setSavingId] = useState<string | null>(null)

  const handleCategoryChange = useCallback(
    async (txnId: string, categoryId: string) => {
      setSavingId(txnId)
      try {
        await onChangeCategory({ txnId, categoryId })
        toast({ title: "Category updated" })
      } catch (e) {
        toast({
          title: "Couldn't update category",
          description: e instanceof Error ? e.message : "Unknown error.",
          variant: "destructive",
        })
      } finally {
        setSavingId(null)
      }
    },
    [onChangeCategory, toast],
  )

  const columns = useMemo<ColumnDef<TransactionDTO>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        cell: (info) => (
          <span className="font-mono text-xs text-[color:var(--ink-2)]">
            {formatDate(String(info.getValue()), "MMM d")}
          </span>
        ),
      },
      {
        accessorKey: "canonicalMerchant",
        header: "Merchant",
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium text-foreground">
              {row.original.canonicalMerchant}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.original.merchant}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "categoryId",
        header: "Category",
        enableSorting: false,
        cell: ({ row }) => {
          const txn = row.original
          return (
            <Select
              value={txn.categoryId}
              onValueChange={(v) => handleCategoryChange(txn.txnId, v)}
              disabled={savingId === txn.txnId}
            >
              <SelectTrigger
                className="h-7 w-[140px] text-xs"
                aria-label={`Category for ${txn.canonicalMerchant}`}
                onClick={(e) => e.stopPropagation()}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.categoryId} value={c.categoryId}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        },
      },
      {
        accessorKey: "amount",
        header: () => <span className="block text-right">Amount</span>,
        cell: ({ row }) => (
          <span className="block text-right">
            <Money value={row.original.amount} signed />
          </span>
        ),
      },
      {
        accessorKey: "txnId",
        header: "ID",
        enableSorting: false,
        cell: (info) => (
          <span className="font-mono text-[11px] text-[color:var(--ink-3)]">
            {String(info.getValue())}
          </span>
        ),
      },
    ],
    [categories, savingId, handleCategoryChange],
  )

  return (
    <DataTable<TransactionDTO>
      id="spending-transactions"
      columns={columns}
      data={transactions}
      onRowOpen={(row) => onOpenTransaction(row.txnId)}
      filterPlaceholder="Filter merchants, IDs…"
      emptyNoData={
        hasExternalFilter ? (
          <span>
            No transactions match the active filters. Clear filters to see
            everything.
          </span>
        ) : (
          <span>
            No transactions yet — connect a bank or upload a CSV from{" "}
            <span className="text-[color:var(--ink-2)]">Imports</span>.
          </span>
        )
      }
    />
  )
}
