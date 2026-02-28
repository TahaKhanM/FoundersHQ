"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/common/page-header"
import { useRules, useCategories, useCreateRule } from "@/lib/api/hooks"
import { formatDate } from "@/lib/utils/format"
import { Plus, Pencil, Trash2 } from "lucide-react"

export default function RulesPage() {
  const { data: rules, isLoading } = useRules()
  const { data: categories } = useCategories()
  const { trigger: createRule } = useCreateRule()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pattern, setPattern] = useState("")
  const [matchType, setMatchType] = useState<"contains" | "regex">("contains")
  const [categoryId, setCategoryId] = useState("")

  async function handleCreate() {
    if (!pattern || !categoryId) return
    await createRule({ pattern, matchType, categoryId, enabled: true })
    setDialogOpen(false)
    setPattern("")
    setCategoryId("")
  }

  const getCategoryName = (id: string) => categories?.find((c) => c.categoryId === id)?.name ?? id

  return (
    <>
      <PageHeader
        title="Categorization Rules"
        description="Auto-categorize transactions by pattern matching"
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Rule
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Match Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules?.map((rule) => (
                  <TableRow key={rule.ruleId}>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {rule.pattern}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {rule.matchType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{getCategoryName(rule.categoryId)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(rule.createdAt, "MMM d")}
                    </TableCell>
                    <TableCell>
                      <Switch checked={rule.enabled} aria-label={`Toggle rule ${rule.pattern}`} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Pencil className="h-3 w-3" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                          <Trash2 className="h-3 w-3" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Categorization Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Pattern</Label>
              <Input
                placeholder="e.g. aws|amazon"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Match Type</Label>
              <Select value={matchType} onValueChange={(v) => setMatchType(v as "contains" | "regex")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="regex">Regex</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.categoryId} value={c.categoryId}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!pattern || !categoryId}>Create Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
