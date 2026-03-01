"use client"

import Link from "next/link"
import { ArrowRight, Building2 } from "lucide-react"

import { PageError } from "@/components/dashboard/page-error"
import { Money } from "@/components/finance"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useCustomers } from "@/lib/api/queries/invoices"
import { cn } from "@/lib/utils"

function riskLevel(onTimeRate: number) {
  if (onTimeRate >= 0.8)
    return {
      label: "Low risk",
      color:
        "bg-[color:var(--accent)]/10 text-[color:var(--accent)] border-[color:var(--accent)]/30",
    }
  if (onTimeRate >= 0.6)
    return {
      label: "Medium risk",
      color:
        "bg-[color:var(--warn)]/10 text-[color:var(--warn)] border-[color:var(--warn)]/30",
    }
  return {
    label: "High risk",
    color:
      "bg-[color:var(--danger)]/10 text-[color:var(--danger)] border-[color:var(--danger)]/30",
  }
}

export default function CustomersPage() {
  const {
    data: customers,
    isLoading,
    error,
    mutate,
  } = useCustomers()

  const sorted = customers
    ?.slice()
    .sort(
      (a, b) =>
        b.exposureOverdueAmount +
        b.exposureOpenAmount -
        (a.exposureOverdueAmount + a.exposureOpenAmount),
    )

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          {customers ? `${customers.length} customers` : ""}
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/invoices">Back to Overview</Link>
        </Button>
      </div>

      {error ? (
        <PageError
          error={error}
          title="Couldn't load customers."
          onRetry={() => void mutate()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-lg" />
            ))
          ) : (sorted?.length ?? 0) === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed border-[color:var(--line)] bg-[color:var(--surface)] py-12 text-center text-sm text-muted-foreground">
              No customers yet —{" "}
              <Link
                href="/invoices/imports"
                className="text-[color:var(--accent)] underline"
              >
                import invoices
              </Link>{" "}
              to populate.
            </div>
          ) : (
            sorted?.map((customer) => {
              const risk = riskLevel(customer.onTimeRate)
              const totalExposure =
                customer.exposureOpenAmount + customer.exposureOverdueAmount
              return (
                <Link
                  key={customer.customerId}
                  href={`/invoices/customers/${customer.customerId}`}
                >
                  <Card className="h-full cursor-pointer transition-all hover:border-[color:var(--accent)]/30 hover:shadow-md">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--surface-2)]">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-semibold">
                              {customer.name}
                            </CardTitle>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Exposure: <Money value={totalExposure} />
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", risk.color)}
                        >
                          {risk.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <Stat
                          value={`${(customer.onTimeRate * 100).toFixed(0)}%`}
                          label="On-time"
                        />
                        <Stat
                          value={`${customer.medianDelayDays}d`}
                          label="Median delay"
                        />
                        <Stat
                          value={`${customer.p90DelayDays}d`}
                          label="P90 delay"
                        />
                      </div>
                      {customer.exposureOverdueAmount > 0 ? (
                        <div className="rounded-md border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/5 px-3 py-2">
                          <p className="text-xs font-medium text-[color:var(--danger)]">
                            <Money value={customer.exposureOverdueAmount} />{" "}
                            overdue
                          </p>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-end text-xs font-medium text-[color:var(--accent)]">
                        View details <ArrowRight className="ml-1 h-3 w-3" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })
          )}
        </div>
      )}
    </>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-lg font-semibold text-foreground tabular-nums">
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
