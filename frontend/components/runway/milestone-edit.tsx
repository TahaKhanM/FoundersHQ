"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Flag, Save, Target } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { formatDate, formatWeeks } from "@/lib/utils/format"
import { Money } from "@/components/finance"
import { cn } from "@/lib/utils"
import type { MilestoneDTO } from "@/lib/api/types"

const editSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  targetValue: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "string" ? Number(v.replace(/[,$]/g, "")) : v))
    .refine((v) => Number.isFinite(v) && v >= 0, {
      message: "Must be a positive number",
    }),
  targetWeekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
})

type EditValues = z.infer<typeof editSchema>

interface MilestoneEditProps {
  milestone: MilestoneDTO
  /**
   * Submit handler — in MVP this only logs the intent (no PATCH endpoint
   * exists yet). Returning a resolved Promise makes the toast/disable
   * dance straightforward.
   */
  onSave?: (next: MilestoneDTO) => Promise<unknown> | unknown
}

/**
 * Inline-edit form for a single milestone. Submits on blur via
 * react-hook-form so the user never has to click Save explicitly, while
 * still surfacing an explicit Save button for clarity.
 */
export function MilestoneEdit({ milestone, onSave }: MilestoneEditProps) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: milestone.name,
      targetValue: milestone.targetValue,
      targetWeekStart: milestone.targetWeekStart,
    },
  })

  useEffect(() => {
    reset({
      name: milestone.name,
      targetValue: milestone.targetValue,
      targetWeekStart: milestone.targetWeekStart,
    })
  }, [milestone.milestoneId, milestone.name, milestone.targetValue, milestone.targetWeekStart, reset])

  const onValid = async (values: EditValues) => {
    setSubmitting(true)
    try {
      const next: MilestoneDTO = {
        ...milestone,
        name: values.name,
        targetValue: Number(values.targetValue),
        targetWeekStart: values.targetWeekStart,
      }
      await onSave?.(next)
      toast({ title: "Milestone updated" })
      setEditing(false)
    } catch (e) {
      toast({
        title: "Couldn't update",
        description: e instanceof Error ? e.message : "Unknown error.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[color:var(--surface-2)]">
          {milestone.targetType === "cash" ? (
            <Target className="h-4 w-4 text-[color:var(--accent)]" />
          ) : milestone.targetType === "revenue" ? (
            <Target className="h-4 w-4 text-[color:var(--accent)]" />
          ) : (
            <Flag className="h-4 w-4 text-[color:var(--warn)]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <form
              onSubmit={handleSubmit(onValid)}
              onBlur={() => {
                if (isDirty) void handleSubmit(onValid)()
              }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
              aria-label={`Edit ${milestone.name}`}
            >
              <div className="space-y-1">
                <Label htmlFor={`name-${milestone.milestoneId}`} className="text-xs">
                  Name
                </Label>
                <Input
                  id={`name-${milestone.milestoneId}`}
                  aria-invalid={!!errors.name}
                  {...register("name")}
                />
                {errors.name ? (
                  <p className="text-[11px] text-[color:var(--danger)]">
                    {errors.name.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor={`val-${milestone.milestoneId}`}
                  className="text-xs"
                >
                  Target value
                </Label>
                <Input
                  id={`val-${milestone.milestoneId}`}
                  inputMode="numeric"
                  aria-invalid={!!errors.targetValue}
                  {...register("targetValue")}
                />
                {errors.targetValue ? (
                  <p className="text-[11px] text-[color:var(--danger)]">
                    {errors.targetValue.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor={`date-${milestone.milestoneId}`}
                  className="text-xs"
                >
                  Target week
                </Label>
                <Input
                  id={`date-${milestone.milestoneId}`}
                  type="date"
                  aria-invalid={!!errors.targetWeekStart}
                  {...register("targetWeekStart")}
                />
                {errors.targetWeekStart ? (
                  <p className="text-[11px] text-[color:var(--danger)]">
                    {errors.targetWeekStart.message}
                  </p>
                ) : null}
              </div>
              <div className="flex items-end gap-1">
                <Button type="submit" size="sm" disabled={submitting}>
                  <Save className="mr-1 h-3.5 w-3.5" />
                  {submitting ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    reset()
                    setEditing(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="w-full text-left"
              aria-label={`Edit ${milestone.name}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {milestone.name}
                </h3>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    milestone.statusBase === "on_track"
                      ? "border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 text-[color:var(--accent)]"
                      : "border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 text-[color:var(--danger)]",
                  )}
                >
                  Base:{" "}
                  {milestone.statusBase === "on_track" ? "On track" : "Off track"}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    milestone.statusPess === "on_track"
                      ? "border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 text-[color:var(--accent)]"
                      : "border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 text-[color:var(--danger)]",
                  )}
                >
                  Pess:{" "}
                  {milestone.statusPess === "on_track" ? "On track" : "Off track"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Target:{" "}
                {milestone.targetType === "runway" ? (
                  formatWeeks(milestone.targetValue)
                ) : (
                  <Money value={milestone.targetValue} />
                )}
                {milestone.targetType === "revenue" ? " /mo" : null} by{" "}
                {formatDate(milestone.targetWeekStart)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Click to edit
              </p>
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
