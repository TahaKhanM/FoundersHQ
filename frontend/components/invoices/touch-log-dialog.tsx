"use client"

import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import type { ActionQueueItemDTO } from "@/lib/api/types"

const touchSchema = z.object({
  channel: z.enum(["email", "phone", "in_person", "chat"]),
  notes: z
    .string()
    .max(1000, "Keep notes under 1,000 characters")
    .optional()
    .default(""),
})

type TouchValues = z.infer<typeof touchSchema>

interface TouchLogDialogProps {
  action: ActionQueueItemDTO | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (
    args: {
      invoiceId: string
      channel: string
      touchType?: string
      notes?: string
    },
  ) => Promise<unknown>
  onLogged?: () => Promise<unknown> | unknown
}

function touchTypeFor(actionType: ActionQueueItemDTO["actionType"] | undefined) {
  if (actionType === "reminder") return "reminder"
  if (actionType === "escalation" || actionType === "call") return "escalation"
  return "reminder"
}

/**
 * Modal for logging a touch (email / phone / in-person) on a collections
 * action queue item. RHF + zod handles validation; submit triggers a
 * toast and a parent refresh callback.
 */
export function TouchLogDialog({
  action,
  open,
  onOpenChange,
  onSubmit,
  onLogged,
}: TouchLogDialogProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TouchValues>({
    resolver: zodResolver(touchSchema),
    defaultValues: { channel: "email", notes: "" },
  })

  // Reset to defaults whenever the modal opens for a different action.
  useEffect(() => {
    if (open) {
      reset({ channel: "email", notes: "" })
    }
  }, [open, action?.actionId, reset])

  async function onValid(values: TouchValues) {
    if (!action) return
    setSubmitting(true)
    try {
      await onSubmit({
        invoiceId: action.invoiceId,
        channel: values.channel,
        touchType: touchTypeFor(action.actionType),
        notes: values.notes || undefined,
      })
      toast({ title: "Touch logged", description: "Action queue updated." })
      await onLogged?.()
      onOpenChange(false)
    } catch (e) {
      toast({
        title: "Couldn't log touch",
        description: e instanceof Error ? e.message : "Unknown error.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="capitalize">
            {action ? `${action.actionType} action` : "Log touch"}
          </DialogTitle>
          {action ? (
            <DialogDescription>
              {action.invoiceId.replace("inv_", "INV-")}
              {" · "}
              Priority {action.priorityScore}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onValid)}
          className="space-y-4 pt-2"
          aria-label="Log touch"
        >
          <div className="space-y-1.5">
            <Label htmlFor="touch-channel">Channel</Label>
            <Controller
              control={control}
              name="channel"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="touch-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="in_person">In person</SelectItem>
                    <SelectItem value="chat">Chat</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="touch-notes">Notes (optional)</Label>
            <Textarea
              id="touch-notes"
              rows={3}
              placeholder="What did you cover?"
              aria-invalid={!!errors.notes}
              {...register("notes")}
            />
            {errors.notes ? (
              <p className="text-[11px] text-[color:var(--danger)]">
                {errors.notes.message}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !action}>
              {submitting ? "Logging…" : "Log touch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
