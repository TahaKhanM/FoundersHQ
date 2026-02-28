"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/common/page-header"
import { RecordSheet } from "@/components/common/record-sheet"
import { useInvoices, useCustomers } from "@/lib/api/hooks"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { Search, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react"

const statusColors: Record<string, string> = {
  paid: "bg-success/10 text-success border-success/20",
  open: "bg-primary/10 text-primary border-primary/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
}

export default function InvoiceListPage() {
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [customerFilter, setCustomerFilter] = useState<string>("")
  const [page, setPage] = useState(1)
  const [sheetId, setSheetId] = useState<string | null>(null)

  const { data, isLoading } = useInvoices({
    page,
    pageSize: 10,
    status: statusFilter || undefined,
    customerId: customerFilter || undefined,
  })
  const { data: customers } = useCustomers()

  return (
    <>
      <PageHeader title="Invoices" description="All issued invoices with payment status and risk scoring">
        <Link href="/invoices">
          <Button variant="ghost" size="sm">Back to Overview</Button>
        </Link>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search invoices..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <Select value={customerFilter} onValueChange={(v) => { setCustomerFilter(v === "all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Customer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Customers</SelectItem>
            {customers?.map((c) => (
              <SelectItem key={c.customerId} value={c.customerId}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[100px]">
                <span className="flex items-center gap-1">Invoice <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Due Date</TableHead>
              <TableHead className="hidden lg:table-cell">Risk</TableHead>
              <TableHead className="hidden lg:table-cell">Confidence</TableHead>
              <TableHead className="hidden xl:table-cell">Expected (Base)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.data.length ? (
              data.data.map((inv) => (
                <TableRow
                  key={inv.invoiceId}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setSheetId(inv.invoiceId)}
                >
                  <TableCell className="font-mono text-xs">{inv.invoiceId.replace("inv_", "INV-")}</TableCell>
                  <TableCell>
                    <Link
                      href={`/invoices/customers/${inv.customerId}`}
                      className="text-sm font-medium text-foreground hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {inv.customerName}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(inv.amount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-xs capitalize", statusColors[inv.status])}>
                      {inv.status}
                      {inv.daysOverdue > 0 && ` (${inv.daysOverdue}d)`}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {formatDate(inv.dueDate)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            inv.riskScore > 70 ? "bg-destructive" : inv.riskScore > 40 ? "bg-warning" : "bg-success"
                          )}
                          style={{ width: `${inv.riskScore}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{inv.riskScore}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs capitalize",
                        inv.confidenceTier === "high" && "bg-success/10 text-success border-success/20",
                        inv.confidenceTier === "medium" && "bg-warning/10 text-warning-foreground border-warning/20",
                        inv.confidenceTier === "low" && "bg-destructive/10 text-destructive border-destructive/20",
                      )}
                    >
                      {inv.confidenceTier}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                    {inv.expectedPayDateBase ? formatDate(inv.expectedPayDateBase) : "--"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No invoices found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {(data.page - 1) * data.pageSize + 1}-{Math.min(data.page * data.pageSize, data.total)} of {data.total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <RecordSheet open={!!sheetId} onOpenChange={() => setSheetId(null)} evidenceId={sheetId} />
    </>
  )
}
