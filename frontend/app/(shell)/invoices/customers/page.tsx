"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/common/page-header"
import { useCustomers } from "@/lib/api/hooks"
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { ArrowRight, Building2 } from "lucide-react"

function riskLevel(onTimeRate: number) {
  if (onTimeRate >= 0.8) return { label: "Low Risk", color: "bg-success/10 text-success border-success/20" }
  if (onTimeRate >= 0.6) return { label: "Medium Risk", color: "bg-warning/10 text-warning-foreground border-warning/20" }
  return { label: "High Risk", color: "bg-destructive/10 text-destructive border-destructive/20" }
}

export default function CustomersPage() {
  const { data: customers, isLoading } = useCustomers()

  const sorted = customers?.slice().sort((a, b) => (b.exposureOverdueAmount + b.exposureOpenAmount) - (a.exposureOverdueAmount + a.exposureOpenAmount))

  return (
    <>
      <PageHeader title="Customers" description="Payment behavior analysis and exposure tracking">
        <Link href="/invoices">
          <Button variant="ghost" size="sm">Back to Overview</Button>
        </Link>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))
        ) : sorted?.map((customer) => {
          const risk = riskLevel(customer.onTimeRate)
          const totalExposure = customer.exposureOpenAmount + customer.exposureOverdueAmount
          return (
            <Link key={customer.customerId} href={`/invoices/customers/${customer.customerId}`}>
              <Card className="h-full transition-all hover:shadow-md hover:border-primary/30 cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">{customer.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Exposure: {formatCurrency(totalExposure)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("text-xs", risk.color)}>
                      {risk.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-semibold text-foreground">{(customer.onTimeRate * 100).toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">On-time</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground">{customer.medianDelayDays}d</p>
                      <p className="text-xs text-muted-foreground">Median Delay</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground">{customer.p90DelayDays}d</p>
                      <p className="text-xs text-muted-foreground">P90 Delay</p>
                    </div>
                  </div>
                  {customer.exposureOverdueAmount > 0 && (
                    <div className="rounded-md bg-destructive/5 px-3 py-2 border border-destructive/10">
                      <p className="text-xs font-medium text-destructive">
                        {formatCurrency(customer.exposureOverdueAmount)} overdue
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-end text-xs text-primary font-medium">
                    View details <ArrowRight className="ml-1 h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </>
  )
}
