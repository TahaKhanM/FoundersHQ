"use client"

import { useState } from "react"

import { EvidenceChip } from "@/components/finance"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { ImprovementItemDTO } from "@/lib/api/types"

interface ImprovementChecklistProps {
  items: ImprovementItemDTO[]
  onOpenEvidence: (id: string) => void
}

/**
 * Funding readiness checklist with a progress header and per-item
 * EvidenceChip linking to the underlying records in the RecordSheet
 * stack. The checked state is local in MVP — phase 2 wires the PATCH.
 */
export function ImprovementChecklist({
  items,
  onOpenEvidence,
}: ImprovementChecklistProps) {
  const [done, setDone] = useState<Set<string>>(
    () => new Set(items.filter((i) => i.done).map((i) => i.itemId)),
  )

  const total = items.length
  const completed = items.filter(
    (i) => i.done || done.has(i.itemId),
  ).length
  const pct = total > 0 ? (completed / total) * 100 : 0

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Funding Readiness Score
            </CardTitle>
            <span className="tabular-nums text-sm font-semibold text-foreground">
              {completed}/{total}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={pct} className="h-2" />
        </CardContent>
      </Card>

      <div className="space-y-2">
        {items.map((item) => {
          const isDone = item.done || done.has(item.itemId)
          return (
            <Card key={item.itemId} className={cn(isDone && "opacity-60")}>
              <CardContent className="flex items-start gap-3 p-4">
                <Checkbox
                  checked={isDone}
                  onCheckedChange={() => {
                    setDone((prev) => {
                      const next = new Set(prev)
                      if (next.has(item.itemId)) next.delete(item.itemId)
                      else next.add(item.itemId)
                      return next
                    })
                  }}
                  aria-label={`Mark "${item.title}" ${isDone ? "incomplete" : "done"}`}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        "text-sm font-medium text-foreground",
                        isDone && "line-through",
                      )}
                    >
                      {item.title}
                    </p>
                    <Badge variant="outline" className="text-xs capitalize">
                      {item.linkedModule}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                  {item.targetEvidenceIds &&
                  item.targetEvidenceIds.length > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <EvidenceChip
                        ids={item.targetEvidenceIds}
                        kind={
                          item.linkedModule === "invoices"
                            ? "invoice"
                            : "transaction"
                        }
                        onOpen={(id) => onOpenEvidence(id)}
                      />
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
