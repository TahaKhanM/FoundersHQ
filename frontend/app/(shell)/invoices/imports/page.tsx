"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/common/page-header"
import { cn } from "@/lib/utils"
import { Upload, FileText, CheckCircle2, AlertCircle, X } from "lucide-react"

interface MockImport {
  id: string
  fileName: string
  status: "success" | "error" | "processing"
  rows: number
  importedAt: string
}

const mockImports: MockImport[] = [
  { id: "imp_01", fileName: "invoices_feb_2026.csv", status: "success", rows: 12, importedAt: "2026-02-25T14:00:00Z" },
  { id: "imp_02", fileName: "invoices_jan_2026.csv", status: "success", rows: 8, importedAt: "2026-01-28T10:30:00Z" },
  { id: "imp_03", fileName: "invoices_dec_2025.csv", status: "error", rows: 0, importedAt: "2025-12-30T09:00:00Z" },
]

export default function ImportsPage() {
  const [isDragging, setIsDragging] = useState(false)
  const [uploads, setUploads] = useState<MockImport[]>(mockImports)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    files.forEach((file) => {
      setUploads((prev) => [
        {
          id: `imp_${Date.now()}`,
          fileName: file.name,
          status: "processing",
          rows: 0,
          importedAt: new Date().toISOString(),
        },
        ...prev,
      ])
      setTimeout(() => {
        setUploads((prev) =>
          prev.map((u) =>
            u.fileName === file.name && u.status === "processing"
              ? { ...u, status: "success", rows: Math.floor(Math.random() * 20) + 5 }
              : u
          )
        )
      }, 2000)
    })
  }, [])

  return (
    <>
      <PageHeader title="Invoice Imports" description="Upload CSV or connect integrations to import invoices">
        <Link href="/invoices">
          <Button variant="ghost" size="sm">Back to Overview</Button>
        </Link>
      </PageHeader>

      <Card
        className={cn(
          "border-2 border-dashed transition-colors cursor-pointer mb-6",
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => {
          const input = document.createElement("input")
          input.type = "file"
          input.accept = ".csv"
          input.multiple = true
          input.onchange = (e) => {
            const files = Array.from((e.target as HTMLInputElement).files ?? [])
            files.forEach((file) => {
              setUploads((prev) => [
                { id: `imp_${Date.now()}`, fileName: file.name, status: "processing", rows: 0, importedAt: new Date().toISOString() },
                ...prev,
              ])
              setTimeout(() => {
                setUploads((prev) =>
                  prev.map((u) =>
                    u.fileName === file.name && u.status === "processing"
                      ? { ...u, status: "success", rows: Math.floor(Math.random() * 20) + 5 }
                      : u
                  )
                )
              }, 2000)
            })
          }
          input.click()
        }}
      >
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            Drop CSV files here or click to upload
          </p>
          <p className="text-xs text-muted-foreground">
            Supports CSV with columns: customer, amount, issue_date, due_date, status
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Import History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {uploads.map((imp) => (
              <div key={imp.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{imp.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {imp.status === "processing" ? "Processing..." : `${imp.rows} rows imported`}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    imp.status === "success" && "bg-success/10 text-success border-success/20",
                    imp.status === "error" && "bg-destructive/10 text-destructive border-destructive/20",
                    imp.status === "processing" && "bg-primary/10 text-primary border-primary/20 animate-pulse"
                  )}
                >
                  {imp.status === "success" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                  {imp.status === "error" && <AlertCircle className="mr-1 h-3 w-3" />}
                  {imp.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
