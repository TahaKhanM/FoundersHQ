"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { formatCurrency, formatDate, formatRelative } from "@/lib/utils/format"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Copy,
  ExternalLink,
  FileText,
  Phone,
  Mail,
  MessageSquare,
  MoreHorizontal,
  AlertTriangle,
  AlertCircle,
  Clock,
} from "lucide-react"
import type { ActionQueueItemUI, LogTouchPayload, SeverityLevel } from "./types"

interface ActionQueueDetailPanelProps {
  item: ActionQueueItemUI | null
  onOpenInvoice?: (invoiceId: string) => void
  onCopyTemplate?: (itemId: string) => void
  onLogTouch?: (itemId: string, payload: LogTouchPayload) => void
  onEvidenceClick?: (evidenceId: string) => void
  isLoading?: boolean
  className?: string
}

const severityConfig: Record<SeverityLevel, {
  bg: string
  text: string
  icon: React.ElementType
  label: string
}> = {
  critical: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    icon: AlertTriangle,
    label: "Critical",
  },
  high: {
    bg: "bg-warning/10",
    text: "text-warning-foreground",
    icon: AlertCircle,
    label: "High",
  },
  medium: {
    bg: "bg-chart-1/10",
    text: "text-chart-1",
    icon: Clock,
    label: "Medium",
  },
  low: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    icon: Clock,
    label: "Low",
  },
}

const channelOptions = [
  { value: "email", label: "Email", icon: Mail },
  { value: "phone", label: "Phone", icon: Phone },
  { value: "sms", label: "SMS", icon: MessageSquare },
  { value: "other", label: "Other", icon: MoreHorizontal },
] as const

const touchTypeOptions = [
  { value: "reminder", label: "Reminder Sent" },
  { value: "follow_up", label: "Follow-up Call" },
  { value: "negotiation", label: "Payment Negotiation" },
  { value: "escalation", label: "Escalation" },
  { value: "payment_received", label: "Payment Received" },
] as const

export function ActionQueueDetailPanel({
  item,
  onOpenInvoice,
  onCopyTemplate,
  onLogTouch,
  onEvidenceClick,
  isLoading = false,
  className,
}: ActionQueueDetailPanelProps) {
  const [channel, setChannel] = React.useState<string>("")
  const [touchType, setTouchType] = React.useState<string>("")
  const [notes, setNotes] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Reset form when item changes
  React.useEffect(() => {
    setChannel("")
    setTouchType("")
    setNotes("")
  }, [item?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!item || !channel || !touchType) return

    setIsSubmitting(true)
    try {
      await onLogTouch?.(item.id, {
        channel: channel as LogTouchPayload["channel"],
        touchType: touchType as LogTouchPayload["touchType"],
        notes,
      })
      // Reset form on success
      setChannel("")
      setTouchType("")
      setNotes("")
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = channel && touchType

  if (!item) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-full text-muted-foreground",
          className
        )}
      >
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Select an action item to view details</p>
        </div>
      </div>
    )
  }

  const config = severityConfig[item.severity]
  const SeverityIcon = config.icon

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold text-foreground truncate">
                {item.customerName}
              </h2>
              {item.invoiceNumber && (
                <p className="text-sm text-muted-foreground">
                  Invoice #{item.invoiceNumber}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-foreground">
                {formatCurrency(item.amount)}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.currency}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className={cn("gap-1", config.bg, config.text)} variant="outline">
              <SeverityIcon className="h-3 w-3" />
              {config.label} Priority
            </Badge>
            <Badge variant="secondary">
              Score: {item.priorityScore}/100
            </Badge>
          </div>

          {item.dueDateISO && (
            <p className="text-sm text-muted-foreground">
              Due: {formatDate(item.dueDateISO)}
              {item.daysOverdue && item.daysOverdue > 0 && (
                <span className="text-destructive ml-2">
                  ({item.daysOverdue} days overdue)
                </span>
              )}
            </p>
          )}
        </div>

        <Separator />

        {/* Reasons */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">
            Priority Reasons
          </h3>
          <div className="flex flex-wrap gap-2">
            {item.reasons.map((reason, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {reason}
              </Badge>
            ))}
          </div>
        </div>

        {/* Evidence Links */}
        {item.evidenceIds && item.evidenceIds.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">
                Supporting Evidence
              </h3>
              <div className="flex flex-wrap gap-2">
                {item.evidenceIds.map((evidenceId) => (
                  <Button
                    key={evidenceId}
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => onEvidenceClick?.(evidenceId)}
                  >
                    <FileText className="h-3 w-3" />
                    {evidenceId}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Template Preview */}
        {item.template && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">
                  Suggested Template
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => onCopyTemplate?.(item.id)}
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </Button>
              </div>
              <div className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap">
                {item.template}
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Log Touch Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">
            Log Touch
          </h3>

          <div className="space-y-2">
            <Label htmlFor="channel">Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger id="channel" aria-label="Select communication channel">
                <SelectValue placeholder="Select channel" />
              </SelectTrigger>
              <SelectContent>
                {channelOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <opt.icon className="h-3.5 w-3.5" />
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="touchType">Touch Type</Label>
            <Select value={touchType} onValueChange={setTouchType}>
              <SelectTrigger id="touchType" aria-label="Select touch type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {touchTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any relevant notes about this interaction..."
              rows={3}
              aria-label="Touch notes"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!isFormValid || isSubmitting || isLoading}
          >
            {isSubmitting ? "Logging..." : "Log Touch"}
          </Button>
        </form>

        <Separator />

        {/* View Invoice CTA */}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => onOpenInvoice?.(item.invoiceId)}
        >
          <ExternalLink className="h-4 w-4" />
          View Invoice
        </Button>

        {/* Last Touch Summary */}
        {item.lastTouchedAtISO && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
            <p className="font-medium mb-1">Last Touch</p>
            <p>
              {item.lastTouchType || "Contact"} - {formatRelative(item.lastTouchedAtISO)}
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
