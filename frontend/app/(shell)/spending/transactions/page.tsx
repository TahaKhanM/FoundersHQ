"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { PageHeader } from "@/components/common/page-header"
import { RecordSheet } from "@/components/common/record-sheet"
import { PageError } from "@/components/dashboard/page-error"
import { RuleForm } from "@/components/spending/rule-form"
import { TableSkeleton } from "@/components/spending/table-skeleton"
import { TransactionsTable } from "@/components/spending/transactions-table"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useCategories,
  useCreateRule,
  useTransactions,
  useUpdateTransactionCategory,
} from "@/lib/api/queries/spending"

export default function TransactionsPage() {
  // useSearchParams() requires a Suspense boundary for static prerender.
  return (
    <Suspense fallback={null}>
      <TransactionsPageInner />
    </Suspense>
  )
}

function TransactionsPageInner() {
  const searchParams = useSearchParams()
  const openTxnId = searchParams.get("openTxnId")
  const [page, setPage] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState<string>("")
  const [sheetId, setSheetId] = useState<string | null>(null)

  const {
    data,
    isLoading,
    error,
    mutate: refetchTxns,
  } = useTransactions({
    page,
    pageSize: 10,
    category: categoryFilter || undefined,
  })
  const { data: categories } = useCategories()
  const { trigger: updateCategory } = useUpdateTransactionCategory()
  const { trigger: createRule } = useCreateRule()

  useEffect(() => {
    if (openTxnId) setSheetId(openTxnId)
  }, [openTxnId])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const hasExternalFilter = Boolean(categoryFilter)

  return (
    <>
      <PageHeader
        title="Transactions"
        description="View and categorize your transaction data"
      />

      {/* Rule form — inline create (RHF + zod) */}
      <div className="mb-6">
        <RuleForm
          categories={categories ?? []}
          onCreate={(values) => createRule(values)}
        />
      </div>

      {/* Filters: only category filter survives — `/` opens DataTable's filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={categoryFilter || "all"}
          onValueChange={(v) => {
            setCategoryFilter(v === "all" ? "" : v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.categoryId} value={c.categoryId}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="ml-auto text-xs text-muted-foreground">
          Tip: press <kbd className="rounded border border-[color:var(--line)] px-1 font-mono text-[10px]">/</kbd>{" "}
          to focus filter,{" "}
          <kbd className="rounded border border-[color:var(--line)] px-1 font-mono text-[10px]">j</kbd>{" "}
          /{" "}
          <kbd className="rounded border border-[color:var(--line)] px-1 font-mono text-[10px]">k</kbd>{" "}
          to navigate.
        </p>
      </div>

      {error ? (
        <PageError
          error={error}
          title="Couldn't load transactions."
          onRetry={() => void refetchTxns()}
        />
      ) : isLoading ? (
        <TableSkeleton rows={8} columns={5} />
      ) : (
        <TransactionsTable
          transactions={data?.data ?? []}
          categories={categories ?? []}
          hasExternalFilter={hasExternalFilter}
          onOpenTransaction={(id) => setSheetId(id)}
          onChangeCategory={(args) => updateCategory(args)}
        />
      )}

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data ? `${data.total.toLocaleString()} transactions` : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <RecordSheet
        open={!!sheetId}
        onOpenChange={() => setSheetId(null)}
        evidenceId={sheetId}
        recordType="transaction"
      />
    </>
  )
}
