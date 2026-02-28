"use client"

import { use, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { MetricCard } from "@/components/common/metric-card"
import { RecordSheet } from "@/components/common/record-sheet"
import { PageHeader } from "@/components/common/page-header"
import { useCustomer, useInvoices } from "@/lib/api/hooks"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { ArrowLeft, Building2 } from "lucide-react"

const statusColors: Record<string, string> = {
  paid: "bg-success/10 text-success border-success/20",
  open: "bg-primary/10 text-primary border-primary/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
}

export default function CustomerDetailPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = use(params)
  const { data: customer, isLoading: customerLoading } = useCustomer(customerId)
  const { data: invoicesData, isLoading: invoicesLoading } = useInvoices({ customerId, pageSize: 50 })
  const [sheetId, setSheetId] = useState<string | null>(null)

  if (customerLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    )
  }

  if (!customer) return <p className="text-muted-foreground">Customer not found.</p>

  const totalExposure = customer.exposureOpenAmount + customer.exposureOverdueAmount

  return (
    <>
      <PageHeader
        title={customer.name}
        description={`Customer ID: ${customer.customerId}`}
      >
        <Link href="/invoices/customers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> All Customers
          </Button>
        </Link>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <MetricCard title="On-time Rate" value={`${(customer.onTimeRate * 100).toFixed(0)}%`} tooltip="Percentage of invoices paid by due date" />
        <MetricCard title="Median Delay" value={`${customer.medianDelayDays}d`} tooltip="Typical payment delay in days" />
        <MetricCard title="P90 Delay" value={`${customer.p90DelayDays}d`} tooltip="Worst-case payment delay (90th percentile)" />
        <MetricCard title="Total Exposure" value={formatCurrency(totalExposure)} tooltip="Open + overdue amounts" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{customer.name}</p>
                <p className="text-xs text-muted-foreground">{customer.customerId}</p>
              </div>
            </div>
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Open Amount</span>
                <span className="font-medium text-foreground">{formatCurrency(customer.exposureOpenAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Overdue Amount</span>
                <span className={cn("font-medium", customer.exposureOverdueAmount > 0 ? "text-destructive" : "text-foreground")}>
                  {formatCurrency(customer.exposureOverdueAmount)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Invoice History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Invoice</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Due</TableHead>
                    <TableHead className="hidden md:table-cell">Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : invoicesData?.data.length ? (
                    invoicesData.data.map((inv) => (
                      <TableRow
                        key={inv.invoiceId}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setSheetId(inv.invoiceId)}
                      >
                        <TableCell className="font-mono text-xs">{inv.invoiceId.replace("inv_", "INV-")}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(inv.amount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-xs capitalize", statusColors[inv.status])}>
                            {inv.status}
                            {inv.daysOverdue > 0 && ` (${inv.daysOverdue}d)`}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {formatDate(inv.dueDate)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-12 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  inv.riskScore > 70 ? "bg-destructive" : inv.riskScore > 40 ? "bg-warning" : "bg-success"
                                )}
                                style={{ width: `${inv.riskScore}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{inv.riskScore}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        No invoices found for this customer
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <RecordSheet open={!!sheetId} onOpenChange={() => setSheetId(null)} evidenceId={sheetId} />
    </>
  )
}
