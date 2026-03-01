"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { mockTransactions, mockInvoices } from "@/lib/mock/data"
import { useTransaction, useInvoiceDetail } from "@/lib/api/hooks"
import { isMockMode } from "@/lib/api/client"
import { formatCurrency, formatDate } from "@/lib/utils/format"

interface RecordSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  evidenceId: string | null
  /** When set, fetches from API in non-mock mode. Omit for alert evidence (mock or unknown type). */
  recordType?: "transaction" | "invoice"
}

export function RecordSheet({ open, onOpenChange, evidenceId, recordType }: RecordSheetProps) {
  const isMock = isMockMode()
  const isTransaction = recordType === "transaction" || (!!evidenceId && evidenceId.startsWith("txn_"))
  const isInvoice = recordType === "invoice" || (!!evidenceId && !evidenceId.startsWith("txn_"))
  const fetchTxn = !isMock && open && evidenceId && (recordType === "transaction" || !recordType)
  const fetchInv = !isMock && open && evidenceId && (recordType === "invoice" || !recordType)

  const { data: txnApi, isLoading: txnLoading } = useTransaction(fetchTxn ? evidenceId : null)
  const { data: invApi, isLoading: invLoading } = useInvoiceDetail(fetchInv ? evidenceId : null)

  const txn = isMock && isTransaction
    ? mockTransactions.find((t) => t.txnId === evidenceId) ?? null
    : (txnApi ?? null)
  const inv = isMock && isInvoice
    ? mockInvoices.find((i) => i.invoiceId === evidenceId) ?? null
    : (invApi ?? null)

  const isLoading = (!isMock && isTransaction && txnLoading) || (!isMock && isInvoice && invLoading)

  if (!evidenceId) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg pr-12 pl-6" side="right">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono text-sm">{evidenceId}</span>
            <Badge variant="outline" className="text-xs">
              {isTransaction ? "Transaction" : "Invoice"}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4 overflow-y-auto flex-1 min-h-0 pr-2">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </div>
          ) : txn ? (
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
          ) : inv ? (
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
          ) : !txn && !inv ? (
            <p className="text-sm text-muted-foreground">
              Record not found for {evidenceId}
            </p>
          ) : null}
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
