"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Mail,
  MessageSquare,
  Phone,
} from "lucide-react"

import { PageError } from "@/components/dashboard/page-error"
import { EvidenceChip, Money } from "@/components/finance"
import { TouchLogDialog } from "@/components/invoices/touch-log-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/format"
import { useActionQueue, useLogTouch } from "@/lib/api/queries/invoices"
import type { ActionQueueItemDTO } from "@/lib/api/types"

const actionIcons: Record<ActionQueueItemDTO["actionType"], React.ReactNode> = {
  reminder: <Mail className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  escalation: <AlertTriangle className="h-4 w-4" />,
}

const actionColors: Record<ActionQueueItemDTO["actionType"], string> = {
  reminder:
    "bg-[color:var(--surface-2)] text-[color:var(--ink-2)] border-[color:var(--line)]",
  call: "bg-[color:var(--warn)]/10 text-[color:var(--warn)] border-[color:var(--warn)]/30",
  escalation:
    "bg-[color:var(--danger)]/10 text-[color:var(--danger)] border-[color:var(--danger)]/30",
}

export default function ActionsPage() {
  const {
    data: actions,
    isLoading,
    error,
    mutate,
  } = useActionQueue()
  const { trigger: logTouch } = useLogTouch()
  const { toast } = useToast()
  const [selectedAction, setSelectedAction] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false)
  const [filterNoTouch7d, setFilterNoTouch7d] = useState(false)
  const [filterHighAmount, setFilterHighAmount] = useState(false)

  const sorted = useMemo(
    () =>
      actions?.slice().sort((a, b) => b.priorityScore - a.priorityScore) ?? [],
    [actions],
  )
  const filtered = useMemo(
    () =>
      sorted.filter((a) => {
        if (filterOverdueOnly && (a.daysOverdue ?? 0) <= 0) return false
        if (filterNoTouch7d) {
          const touched = a.lastTouchedAt
            ? new Date(a.lastTouchedAt).getTime()
            : 0
          const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
          if (touched >= sevenDaysAgo) return false
        }
        if (filterHighAmount && (a.amount ?? 0) < 10000) return false
        return true
      }),
    [sorted, filterOverdueOnly, filterNoTouch7d, filterHighAmount],
  )

  const activeAction =
    sorted.find((a) => a.actionId === selectedAction) ?? null

  function openTouch(actionId: string) {
    setSelectedAction(actionId)
    setSheetOpen(true)
  }

  function handleCopyTemplate() {
    if (!activeAction?.template) return
    void navigator.clipboard.writeText(activeAction.template)
    toast({ title: "Copied", description: "Template copied to clipboard." })
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterOverdueOnly ? "secondary" : "outline"}
            size="sm"
            onClick={() => setFilterOverdueOnly((v) => !v)}
          >
            Overdue only
          </Button>
          <Button
            variant={filterNoTouch7d ? "secondary" : "outline"}
            size="sm"
            onClick={() => setFilterNoTouch7d((v) => !v)}
          >
            No touch in 7 days
          </Button>
          <Button
            variant={filterHighAmount ? "secondary" : "outline"}
            size="sm"
            onClick={() => setFilterHighAmount((v) => !v)}
          >
            High amount (≥$10k)
          </Button>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/invoices">Back to Overview</Link>
        </Button>
      </div>

      {error ? (
        <PageError
          error={error}
          title="Couldn't load the action queue."
          onRetry={() => void mutate()}
        />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-[color:var(--accent)]" />
            <p className="text-sm font-medium text-foreground">
              Nothing to chase right now.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              New collections actions will appear here as invoices age.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((action) => {
            const isDone = action.isCompleted === true
            return (
              <Card
                key={action.actionId}
                className={cn(
                  "transition-all",
                  isDone && "opacity-60",
                  !isDone &&
                    "cursor-pointer hover:border-[color:var(--accent)]/30 hover:shadow-md",
                )}
                onClick={() => !isDone && openTouch(action.actionId)}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                      actionColors[action.actionType],
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      actionIcons[action.actionType]
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs capitalize",
                          actionColors[action.actionType],
                        )}
                      >
                        {action.actionType}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Due:{" "}
                        {formatDate(action.dueAt ?? action.dueDate ?? "")}
                      </span>
                      {action.lastTouchedAt ? (
                        <span className="text-xs text-muted-foreground">
                          Last touch: {formatDate(action.lastTouchedAt)}
                          {action.lastTouchType
                            ? ` (${action.lastTouchType})`
                            : null}
                        </span>
                      ) : null}
                      <span className="ml-auto inline-flex items-center gap-2 text-xs font-medium text-foreground tabular-nums">
                        {action.amount != null ? (
                          <Money value={action.amount} />
                        ) : null}
                        <span className="text-muted-foreground">
                          Priority {action.priorityScore}
                        </span>
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {action.invoiceId.replace("inv_", "INV-")}
                      {" — "}
                      {action.customerName ??
                        action.customerId?.replace("cust_", "Customer ") ??
                        "—"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {action.reasons.map((r, i) => (
                        <span
                          key={i}
                          className="rounded bg-[color:var(--surface-2)] px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {r}
                        </span>
                      ))}
                      {action.evidenceIds.length > 0 ? (
                        <EvidenceChip
                          ids={action.evidenceIds}
                          kind="invoice"
                          onOpen={() => openTouch(action.actionId)}
                        />
                      ) : null}
                    </div>
                  </div>
                  {!isDone ? (
                    <ChevronRight className="h-5 w-5 shrink-0 self-center text-muted-foreground" />
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Touch log modal */}
      {activeAction?.template ? (
        <div aria-hidden className="hidden" />
      ) : null}

      <TouchLogDialog
        action={activeAction}
        open={sheetOpen}
        onOpenChange={(v) => {
          setSheetOpen(v)
          if (!v) setSelectedAction(null)
        }}
        onSubmit={(args) => logTouch(args)}
        onLogged={() => mutate()}
      />

      {/* Template peek under the modal — rendered only when one exists.
         Plays nicely on small screens where the modal scrolls. */}
      {activeAction?.template && sheetOpen ? (
        <div className="fixed bottom-4 left-1/2 z-30 w-[min(90vw,42rem)] -translate-x-1/2 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-3 text-xs shadow-lg">
          <div className="mb-1 flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> Suggested template
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={handleCopyTemplate}
            >
              <Copy className="mr-1 h-3 w-3" /> Copy
            </Button>
          </div>
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-sans leading-relaxed text-foreground">
            {activeAction.template}
          </pre>
        </div>
      ) : null}
    </>
  )
}
