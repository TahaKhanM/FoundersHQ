"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PageHeader } from "@/components/common/page-header"
import { useActionQueue, useLogTouch } from "@/lib/api/hooks"
import { formatDate } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Phone, Mail, AlertTriangle, ChevronRight, MessageSquare, CheckCircle2, Copy } from "lucide-react"

const actionIcons: Record<string, React.ReactNode> = {
  reminder: <Mail className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  escalation: <AlertTriangle className="h-4 w-4" />,
}

const actionColors: Record<string, string> = {
  reminder: "bg-primary/10 text-primary border-primary/20",
  call: "bg-warning/10 text-warning-foreground border-warning/20",
  escalation: "bg-destructive/10 text-destructive border-destructive/20",
}

export default function ActionsPage() {
  const { data: actions, isLoading, mutate } = useActionQueue()
  const { trigger: logTouch, isMutating } = useLogTouch()
  const { toast } = useToast()
  const [selectedAction, setSelectedAction] = useState<string | null>(null)
  const [touchChannel, setTouchChannel] = useState("email")
  const [touchNotes, setTouchNotes] = useState("")
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false)
  const [filterNoTouch7d, setFilterNoTouch7d] = useState(false)
  const [filterHighAmount, setFilterHighAmount] = useState(false)

  const sorted = actions?.slice().sort((a, b) => b.priorityScore - a.priorityScore) ?? []
  const filtered = sorted.filter((a) => {
    if (filterOverdueOnly && (a.daysOverdue ?? 0) <= 0) return false
    if (filterNoTouch7d) {
      const touched = a.lastTouchedAt ? new Date(a.lastTouchedAt).getTime() : 0
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      if (touched >= sevenDaysAgo) return false
    }
    if (filterHighAmount && (a.amount ?? 0) < 10000) return false
    return true
  })
  const activeAction = sorted?.find((a) => a.actionId === selectedAction)

  const touchTypeFromAction = (actionType: string) =>
    actionType === "reminder" ? "reminder" : actionType === "escalation" || actionType === "call" ? "escalation" : "reminder"

  async function handleLogTouch() {
    if (!activeAction) return
    try {
      await logTouch({
        invoiceId: activeAction.invoiceId,
        channel: touchChannel,
        touchType: touchTypeFromAction(activeAction.actionType),
        notes: touchNotes || undefined,
      })
      await mutate()
      toast({ title: "Touch logged", description: "Action queue updated." })
      setSelectedAction(null)
      setTouchNotes("")
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to log touch", variant: "destructive" })
    }
  }

  function handleCopyTemplate() {
    if (!activeAction?.template) return
    void navigator.clipboard.writeText(activeAction.template)
    toast({ title: "Copied", description: "Template copied to clipboard." })
  }

  return (
    <>
      <PageHeader title="Action Queue" description="Prioritized collection actions based on risk and overdue analysis">
        <Link href="/invoices">
          <Button variant="ghost" size="sm">Back to Overview</Button>
        </Link>
      </PageHeader>

      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant={filterOverdueOnly ? "secondary" : "outline"} size="sm" onClick={() => setFilterOverdueOnly((v) => !v)}>
          Overdue only
        </Button>
        <Button variant={filterNoTouch7d ? "secondary" : "outline"} size="sm" onClick={() => setFilterNoTouch7d((v) => !v)}>
          No touch in 7 days
        </Button>
        <Button variant={filterHighAmount ? "secondary" : "outline"} size="sm" onClick={() => setFilterHighAmount((v) => !v)}>
          High amount (≥$10k)
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))
        ) : filtered.map((action) => {
          const isDone = action.isCompleted === true
          return (
            <Card
              key={action.actionId}
              className={cn(
                "transition-all",
                isDone && "opacity-60",
                !isDone && "hover:shadow-md hover:border-primary/20 cursor-pointer"
              )}
              onClick={() => !isDone && setSelectedAction(action.actionId)}
            >
              <CardContent className="flex items-start gap-4 p-4">
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", actionColors[action.actionType])}>
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : actionIcons[action.actionType]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn("text-xs capitalize", actionColors[action.actionType])}>
                      {action.actionType}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Due: {formatDate(action.dueAt ?? action.dueDate ?? "")}</span>
                    {action.lastTouchedAt && (
                      <span className="text-xs text-muted-foreground">
                        Last touch: {formatDate(action.lastTouchedAt)}
                        {action.lastTouchType && ` (${action.lastTouchType})`}
                      </span>
                    )}
                    <span className="text-xs font-medium text-foreground ml-auto">
                      Priority: {action.priorityScore}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground mt-1">
                    {action.invoiceId.replace("inv_", "INV-")} - {action.customerName ?? action.customerId?.replace("cust_", "Customer ") ?? "—"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {action.reasons.map((r, i) => (
                      <span key={i} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                {!isDone && <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 self-center" />}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={!!selectedAction} onOpenChange={() => setSelectedAction(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeAction && actionIcons[activeAction.actionType]}
              <span className="capitalize">{activeAction?.actionType}</span> Action
            </DialogTitle>
            <DialogDescription>
              {activeAction?.invoiceId.replace("inv_", "INV-")} | Priority {activeAction?.priorityScore}
            </DialogDescription>
          </DialogHeader>

          {activeAction?.template && (
            <Card className="bg-muted/50">
              <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> Template
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={handleCopyTemplate}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <pre className="text-xs whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                  {activeAction.template}
                </pre>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Channel</label>
              <Select value={touchChannel} onValueChange={setTouchChannel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="in_person">In Person</SelectItem>
                  <SelectItem value="chat">Chat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Notes (optional)</label>
              <Textarea
                placeholder="Add notes about this interaction..."
                value={touchNotes}
                onChange={(e) => setTouchNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAction(null)}>Cancel</Button>
            <Button onClick={handleLogTouch} disabled={isMutating}>
              {isMutating ? "Logging..." : "Log Touch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
