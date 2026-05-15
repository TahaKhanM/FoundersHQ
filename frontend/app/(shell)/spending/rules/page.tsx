"use client"

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Pencil, Trash2 } from "lucide-react"

import { PageHeader } from "@/components/common/page-header"
import { PageError } from "@/components/dashboard/page-error"
import { RuleForm } from "@/components/spending/rule-form"
import { TableSkeleton } from "@/components/spending/table-skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/utils/format"
import {
  useCategories,
  useCreateRule,
  useRules,
} from "@/lib/api/queries/spending"
import type { CategorizationRuleDTO } from "@/lib/api/types"

export default function RulesPage() {
  const { data: rules, isLoading, error, mutate } = useRules()
  const { data: categories } = useCategories()
  const { trigger: createRule } = useCreateRule()
  const { toast } = useToast()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const getCategoryName = (id: string) =>
    categories?.find((c) => c.categoryId === id)?.name ?? id

  const columns = useMemo<ColumnDef<CategorizationRuleDTO>[]>(
    () => [
      {
        accessorKey: "pattern",
        header: "Pattern",
        cell: ({ row }) => (
          <code className="rounded bg-[color:var(--surface-2)] px-1.5 py-0.5 font-mono text-xs">
            {row.original.pattern}
          </code>
        ),
      },
      {
        accessorKey: "matchType",
        header: "Match",
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs capitalize">
            {row.original.matchType}
          </Badge>
        ),
      },
      {
        accessorKey: "categoryId",
        header: "Category",
        cell: ({ row }) => (
          <span className="text-sm">{getCategoryName(row.original.categoryId)}</span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.createdAt, "MMM d")}
          </span>
        ),
      },
      {
        accessorKey: "enabled",
        header: "Enabled",
        enableSorting: false,
        cell: ({ row }) => (
          <Switch
            checked={row.original.enabled}
            disabled={pendingId === row.original.ruleId}
            aria-label={`Toggle rule ${row.original.pattern}`}
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={() => {
              setPendingId(row.original.ruleId)
              // No update endpoint wired yet — surface intent locally.
              toast({
                title: "Toggle queued",
                description: "Rule edits are read-only in this build.",
              })
              setPendingId(null)
            }}
          />
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={`Edit rule ${row.original.pattern}`}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[color:var(--danger)]"
              aria-label={`Delete rule ${row.original.pattern}`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ),
      },
    ],
    [categories, pendingId, toast],
  )

  return (
    <>
      <PageHeader
        title="Categorization Rules"
        description="Auto-categorize transactions by pattern matching"
      />

      <div className="mb-6">
        <RuleForm
          categories={categories ?? []}
          onCreate={async (values) => {
            await createRule(values)
            await mutate()
          }}
        />
      </div>

      {error ? (
        <PageError
          error={error}
          title="Couldn't load rules."
          onRetry={() => void mutate()}
        />
      ) : isLoading ? (
        <TableSkeleton rows={4} columns={6} />
      ) : (
        <DataTable<CategorizationRuleDTO>
          id="spending-rules"
          columns={columns}
          data={rules ?? []}
          filterPlaceholder="Filter patterns…"
          emptyNoData={
            <span>
              No rules yet — add one above to auto-categorize matching merchants.
            </span>
          }
        />
      )}
    </>
  )
}
