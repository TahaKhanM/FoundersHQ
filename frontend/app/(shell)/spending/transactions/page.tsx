"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/common/page-header"
import { EvidenceLink } from "@/components/common/evidence-link"
import { RecordSheet } from "@/components/common/record-sheet"
import { useTransactions, useCategories, useUpdateTransactionCategory, useCreateRule } from "@/lib/api/hooks"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { Search, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { useSearchParams } from "next/navigation"

export default function TransactionsPage() {
  const searchParams = useSearchParams()
  const openTxnId = searchParams.get("openTxnId")
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("")
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [rulePattern, setRulePattern] = useState("")
  const [ruleCategory, setRuleCategory] = useState("")
  const [ruleMatchType, setRuleMatchType] = useState<"contains" | "regex">("contains")
  const [editingTxn, setEditingTxn] = useState<string | null>(null)

  const { data, isLoading } = useTransactions({ page, pageSize: 10, category: categoryFilter || undefined, search: search || undefined })
  const { data: categories } = useCategories()
  const { trigger: updateCategory } = useUpdateTransactionCategory()
  const { trigger: createRule } = useCreateRule()

  useEffect(() => {
    if (openTxnId) setSheetId(openTxnId)
  }, [openTxnId])

  async function handleCategoryChange(txnId: string, categoryId: string) {
    setEditingTxn(txnId)
    await updateCategory({ txnId, categoryId })
    setEditingTxn(null)
  }

  async function handleCreateRule() {
    if (!rulePattern || !ruleCategory) return
    await createRule({ pattern: rulePattern, matchType: ruleMatchType, categoryId: ruleCategory, enabled: true })
    setRuleDialogOpen(false)
    setRulePattern("")
    setRuleCategory("")
  }

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1

  return (
    <>
      <PageHeader
        title="Transactions"
        description="View and categorize your transaction data"
        actions={
          <Button size="sm" onClick={() => setRuleDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Rule
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 py-3 px-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search merchant, ID..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v === "all" ? "" : v); setPage(1) }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.categoryId} value={c.categoryId}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((txn) => (
                  <TableRow key={txn.txnId}>
                    <TableCell className="text-sm">{formatDate(txn.date, "MMM d")}</TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{txn.canonicalMerchant}</p>
                      <p className="text-xs text-muted-foreground">{txn.merchant}</p>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={txn.categoryId}
                        onValueChange={(v) => handleCategoryChange(txn.txnId, v)}
                        disabled={editingTxn === txn.txnId}
                      >
                        <SelectTrigger className="h-7 w-[130px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories?.map((c) => (
                            <SelectItem key={c.categoryId} value={c.categoryId}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={txn.amount < 0 ? "text-foreground" : "text-success font-medium"}>
                        {formatCurrency(txn.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <EvidenceLink evidenceId={txn.txnId} onClick={setSheetId} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-muted-foreground">
          {data ? `${data.total} transactions` : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Create Rule Dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Categorization Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Pattern</Label>
              <Input
                placeholder="e.g. stripe, google ads"
                value={rulePattern}
                onChange={(e) => setRulePattern(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Match Type</Label>
              <Select value={ruleMatchType} onValueChange={(v) => setRuleMatchType(v as "contains" | "regex")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="regex">Regex</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={ruleCategory} onValueChange={setRuleCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.categoryId} value={c.categoryId}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRule} disabled={!rulePattern || !ruleCategory}>Create Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RecordSheet open={!!sheetId} onOpenChange={() => setSheetId(null)} evidenceId={sheetId} recordType="transaction" />
    </>
  )
}
