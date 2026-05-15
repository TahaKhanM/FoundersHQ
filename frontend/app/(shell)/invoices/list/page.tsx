"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { RecordSheet } from "@/components/common/record-sheet"
import { PageError } from "@/components/dashboard/page-error"
import { InvoiceListTable } from "@/components/invoices/invoice-list-table"
import { TableSkeleton } from "@/components/spending/table-skeleton"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCustomers, useInvoices } from "@/lib/api/queries/invoices"

export default function InvoiceListPage() {
  // useSearchParams() requires a Suspense boundary for static prerender.
  return (
    <Suspense fallback={null}>
      <InvoiceListPageInner />
    </Suspense>
  )
}

function InvoiceListPageInner() {
  const searchParams = useSearchParams()
  const openInvoiceId = searchParams.get("openInvoiceId")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [customerFilter, setCustomerFilter] = useState<string>("")
  const [page, setPage] = useState(1)
  const [sheetId, setSheetId] = useState<string | null>(null)

  const {
    data,
    isLoading,
    error,
    mutate,
  } = useInvoices({
    page,
    pageSize: 10,
    status: statusFilter || undefined,
    customerId: customerFilter || undefined,
  })
  const { data: customers } = useCustomers()

  useEffect(() => {
    if (openInvoiceId) setSheetId(openInvoiceId)
  }, [openInvoiceId])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const hasExternalFilter = useMemo(
    () => Boolean(statusFilter || customerFilter),
    [statusFilter, customerFilter],
  )

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <Select
            value={statusFilter || "all"}
            onValueChange={(v) => {
              setStatusFilter(v === "all" ? "" : v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={customerFilter || "all"}
            onValueChange={(v) => {
              setCustomerFilter(v === "all" ? "" : v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              {customers?.map((c) => (
                <SelectItem key={c.customerId} value={c.customerId}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/invoices">Back to Overview</Link>
        </Button>
      </div>

      {error ? (
        <PageError
          error={error}
          title="Couldn't load invoices."
          onRetry={() => void mutate()}
        />
      ) : isLoading ? (
        <TableSkeleton rows={8} columns={8} />
      ) : (
        <InvoiceListTable
          invoices={data?.data ?? []}
          hasExternalFilter={hasExternalFilter}
          onOpenInvoice={(id) => setSheetId(id)}
        />
      )}

      {data && data.total > data.pageSize ? (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground tabular-nums">
            Showing {(data.page - 1) * data.pageSize + 1}–
            {Math.min(data.page * data.pageSize, data.total)} of {data.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
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
              disabled={page * data.pageSize >= data.total}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <RecordSheet
        open={!!sheetId}
        onOpenChange={() => setSheetId(null)}
        evidenceId={sheetId}
        recordType="invoice"
      />
    </>
  )
}
