"use client"

import { use, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Building2 } from "lucide-react"

import { PageHeader } from "@/components/common/page-header"
import { RecordSheet } from "@/components/common/record-sheet"
import { PageError } from "@/components/dashboard/page-error"
import { MetricCard, Money } from "@/components/finance"
import { InvoiceListTable } from "@/components/invoices/invoice-list-table"
import { LatenessFingerprint } from "@/components/invoices/lateness-fingerprint"
import { TableSkeleton } from "@/components/spending/table-skeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useCustomer, useInvoices } from "@/lib/api/queries/invoices"

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const { customerId } = use(params)
  const {
    data: customer,
    isLoading: customerLoading,
    error: customerError,
    mutate: refetchCustomer,
  } = useCustomer(customerId)
  const {
    data: invoicesData,
    isLoading: invoicesLoading,
    error: invoicesError,
    mutate: refetchInvoices,
  } = useInvoices({ customerId, pageSize: 50 })
  const [sheetId, setSheetId] = useState<string | null>(null)

  if (customerError) {
    return (
      <PageError
        error={customerError}
        title="Couldn't load this customer."
        onRetry={() => void refetchCustomer()}
      />
    )
  }

  if (customerLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  if (!customer)
    return (
      <p className="text-muted-foreground">Customer not found.</p>
    )

  const totalExposure =
    customer.exposureOpenAmount + customer.exposureOverdueAmount
  const invoices = invoicesData?.data ?? []
  const lifetime = invoices.reduce((acc, i) => acc + i.amount, 0)

  return (
    <>
      <PageHeader
        title={customer.name}
        description={`Customer ID: ${customer.customerId}`}
      >
        <Button asChild variant="ghost" size="sm">
          <Link href="/invoices/customers">
            <ArrowLeft className="mr-1 h-4 w-4" /> All customers
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="On-time Rate"
          value={`${(customer.onTimeRate * 100).toFixed(0)}%`}
        />
        <MetricCard
          label="Median Delay"
          value={`${customer.medianDelayDays}d`}
        />
        <MetricCard
          label="P90 Delay"
          value={`${customer.p90DelayDays}d`}
        />
        <MetricCard
          label="Total Exposure"
          value={<Money value={totalExposure} />}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--surface-2)]">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {customer.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {customer.customerId}
                </p>
              </div>
            </div>
            <div className="space-y-2 border-t border-[color:var(--line)] pt-2">
              <Row label="Open">
                <Money value={customer.exposureOpenAmount} />
              </Row>
              <Row label="Overdue">
                <Money value={customer.exposureOverdueAmount} />
              </Row>
              <Row label="Lifetime invoiced">
                <Money value={lifetime} />
              </Row>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Lateness fingerprint
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LatenessFingerprint customer={customer} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Invoice History</CardTitle>
        </CardHeader>
        <CardContent>
          {invoicesError ? (
            <PageError
              error={invoicesError}
              title="Couldn't load this customer's invoices."
              onRetry={() => void refetchInvoices()}
            />
          ) : invoicesLoading ? (
            <TableSkeleton rows={5} columns={6} />
          ) : (
            <InvoiceListTable
              invoices={invoices}
              onOpenInvoice={(id) => setSheetId(id)}
            />
          )}
        </CardContent>
      </Card>

      <RecordSheet
        open={!!sheetId}
        onOpenChange={() => setSheetId(null)}
        evidenceId={sheetId}
        recordType="invoice"
      />
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{children}</span>
    </div>
  )
}
