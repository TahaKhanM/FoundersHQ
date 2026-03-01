"use client"

import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import type { CategorizationRuleDTO, CategoryDTO } from "@/lib/api/types"

const ruleSchema = z.object({
  pattern: z
    .string()
    .min(1, "Pattern is required")
    .max(200, "Keep patterns under 200 chars"),
  matchType: z.enum(["contains", "regex"]),
  categoryId: z.string().min(1, "Pick a category"),
})

export type RuleFormValues = z.infer<typeof ruleSchema>

interface RuleFormProps {
  categories: CategoryDTO[]
  onCreate: (
    values: Omit<CategorizationRuleDTO, "ruleId" | "createdAt">,
  ) => Promise<unknown> | unknown
}

/**
 * Inline create form for categorization rules.
 *
 * Uses `react-hook-form` + `zod` so validation lives next to the schema and
 * submission stays declarative. On successful create the toast notifies and
 * the form resets so the user can keep adding without re-opening a dialog.
 */
export function RuleForm({ categories, onCreate }: RuleFormProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: { pattern: "", matchType: "contains", categoryId: "" },
  })

  async function onSubmit(values: RuleFormValues) {
    setSubmitting(true)
    try {
      await onCreate({ ...values, enabled: true })
      toast({
        title: "Rule created",
        description: `Future "${values.pattern}" charges will auto-categorize.`,
      })
      reset()
    } catch (e) {
      toast({
        title: "Couldn't create rule",
        description: e instanceof Error ? e.message : "Unknown error.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid grid-cols-1 gap-3 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-4 sm:grid-cols-[1fr_140px_180px_auto]"
      aria-label="Create categorization rule"
    >
      <div className="space-y-1">
        <Label htmlFor="rule-pattern" className="text-xs">
          Pattern
        </Label>
        <Input
          id="rule-pattern"
          placeholder="e.g. stripe, gusto, aws|amazon"
          aria-invalid={!!errors.pattern}
          {...register("pattern")}
        />
        {errors.pattern ? (
          <p className="text-[11px] text-[color:var(--danger)]">
            {errors.pattern.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Match</Label>
        <Controller
          control={control}
          name="matchType"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="regex">Regex</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Category</Label>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-invalid={!!errors.categoryId}>
                <SelectValue placeholder="Pick category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.categoryId} value={c.categoryId}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.categoryId ? (
          <p className="text-[11px] text-[color:var(--danger)]">
            {errors.categoryId.message}
          </p>
        ) : null}
      </div>

      <div className="flex items-end">
        <Button type="submit" size="sm" disabled={submitting} className="w-full">
          <Plus className="mr-1 h-3.5 w-3.5" />
          {submitting ? "Saving…" : "Add rule"}
        </Button>
      </div>
    </form>
  )
}
