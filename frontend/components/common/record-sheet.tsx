"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { mockTransactions, mockInvoices } from "@/lib/mock/data"
import { formatCurrency, formatDate } from "@/lib/utils/format"

interface RecordSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  evidenceId: string | null
}

export function RecordSheet({ open, onOpenChange, evidenceId }: RecordSheetProps) {
  if (!evidenceId) return null

  const isTransaction = evidenceId.startsWith("txn_")
  const txn = isTransaction ? mockTransactions.find((t) => t.txnId === evidenceId) : null
  const inv = !isTransaction ? mockInvoices.find((i) => i.invoiceId === evidenceId) : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono text-sm">{evidenceId}</span>
            <Badge variant="outline" className="text-xs">
              {isTransaction ? "Transaction" : "Invoice"}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {txn && (
            <>
              <DetailRow label="Merchant" value={txn.canonicalMerchant} />
              <DetailRow label="Amount" value={formatCurrency(txn.amount)} />
              <DetailRow label="Date" value={formatDate(txn.date)} />
              <DetailRow label="Category" value={txn.categoryName} />
              <DetailRow label="Source" value={txn.source.toUpperCase()} />
              <Separator />
              <DetailRow label="Raw merchant" value={txn.merchant} />
              <DetailRow label="Transaction ID" value={txn.txnId} />
              <DetailRow label="Created" value={formatDate(txn.createdAt)} />
            </>
          )}

          {inv && (
            <>
              <DetailRow label="Customer" value={inv.customerName} />
              <DetailRow label="Amount" value={formatCurrency(inv.amount)} />
              <DetailRow label="Issue Date" value={formatDate(inv.issueDate)} />
              <DetailRow label="Due Date" value={formatDate(inv.dueDate)} />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge
                  variant={inv.status === "overdue" ? "destructive" : inv.status === "paid" ? "default" : "secondary"}
                >
                  {inv.status}
                </Badge>
              </div>
              {inv.daysOverdue > 0 && (
                <DetailRow label="Days Overdue" value={`${inv.daysOverdue} days`} />
              )}
              <Separator />
              {inv.expectedPayDateBase && (
                <DetailRow label="Expected Pay (Base)" value={formatDate(inv.expectedPayDateBase)} />
              )}
              {inv.expectedPayDatePess && (
                <DetailRow label="Expected Pay (Pess)" value={formatDate(inv.expectedPayDatePess)} />
              )}
              <DetailRow label="Risk Score" value={`${inv.riskScore}/100`} />
              <DetailRow label="Confidence" value={inv.confidenceTier} />
            </>
          )}

          {!txn && !inv && (
            <p className="text-sm text-muted-foreground">
              Record not found for {evidenceId}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}
