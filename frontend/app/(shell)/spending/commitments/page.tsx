"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/common/page-header"
import { useCommitments } from "@/lib/api/hooks"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { CalendarClock } from "lucide-react"

export default function CommitmentsPage() {
  const { data: commitments, isLoading } = useCommitments()

  return (
    <>
      <PageHeader
        title="Recurring Commitments"
        description="Track recurring charges and subscription obligations"
      />

      {/* Timeline (next 30 days) */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            Upcoming (Next 30 days)
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {commitments
                ?.filter((c) => c.enabled)
                .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())
                .map((c) => (
                  <div
                    key={c.commitmentId}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {c.merchant}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Due {formatDate(c.nextDueDate, "MMM d")}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {formatCurrency(c.typicalAmount)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead className="text-right">Typical Amount</TableHead>
                  <TableHead>Next Charge</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commitments?.map((c) => (
                  <TableRow key={c.commitmentId}>
                    <TableCell className="font-medium">{c.merchant}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize text-xs">
                        {c.frequency}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(c.typicalAmount)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(c.nextDueDate, "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${c.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {(c.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={c.enabled}
                        aria-label={`Toggle ${c.merchant}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
