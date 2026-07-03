"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Upload,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface MockImport {
  id: string
  fileName: string
  status: "success" | "error" | "processing"
  rows: number
  importedAt: string
  /** Surfaced when the import fails so support can trace it back to a log line. */
  requestId?: string
  errorMessage?: string
}

const initialImports: MockImport[] = [
  {
    id: "imp_01",
    fileName: "invoices_feb_2026.csv",
    status: "success",
    rows: 12,
    importedAt: "2026-02-25T14:00:00Z",
  },
  {
    id: "imp_02",
    fileName: "invoices_jan_2026.csv",
    status: "success",
    rows: 8,
    importedAt: "2026-01-28T10:30:00Z",
  },
  {
    id: "imp_03",
    fileName: "invoices_dec_2025.csv",
    status: "error",
    rows: 0,
    importedAt: "2025-12-30T09:00:00Z",
    requestId: "req_dec25_invoice_import_failed",
    errorMessage:
      "Row 3: invalid date 'next tuesday' (expected ISO-8601). Aborting import — no rows written.",
  },
]

export default function ImportsPage() {
  const [isDragging, setIsDragging] = useState(false)
  const [uploads, setUploads] = useState<MockImport[]>(initialImports)

  const enqueue = useCallback((file: File) => {
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
            ? {
                ...u,
                status: "success",
                rows: Math.floor(Math.random() * 20) + 5,
              }
            : u,
        ),
      )
    }, 2000)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      Array.from(e.dataTransfer.files).forEach(enqueue)
    },
    [enqueue],
  )

  const failedImports = useMemo(
    () => uploads.filter((u) => u.status === "error"),
    [uploads],
  )

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Upload CSV or connect integrations to import invoices.
        </p>
        <Button asChild variant="ghost" size="sm">
          <Link href="/invoices">Back to Overview</Link>
        </Button>
      </div>

      <Card
        className={cn(
          "mb-6 cursor-pointer border-2 border-dashed transition-colors",
          isDragging
            ? "border-[color:var(--accent)] bg-[color:var(--accent)]/5"
            : "border-[color:var(--line)] hover:border-[color:var(--accent)]/40",
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => {
          const input = document.createElement("input")
          input.type = "file"
          input.accept = ".csv"
          input.multiple = true
          input.onchange = (e) => {
            Array.from((e.target as HTMLInputElement).files ?? []).forEach(
              enqueue,
            )
          }
          input.click()
        }}
      >
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--surface-2)]">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mb-1 text-sm font-medium text-foreground">
            Drop CSV files here or click to upload
          </p>
          <p className="text-xs text-muted-foreground">
            Supports CSV with columns: customer, amount, issue_date, due_date,
            status
          </p>
        </CardContent>
      </Card>

      {/* Errors call-out — gives operators a place to grab the request-id. */}
      {failedImports.length > 0 ? (
        <Card className="mb-6 border-[color:var(--danger)]/30 bg-[color:var(--danger)]/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="h-4 w-4 text-[color:var(--danger)]" />
              {failedImports.length} failed import
              {failedImports.length > 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {failedImports.map((imp) => (
              <div
                key={imp.id}
                className="rounded-lg border border-[color:var(--danger)]/30 bg-[color:var(--surface)] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {imp.fileName}
                  </p>
                  <Badge
                    variant="outline"
                    className="border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 text-[color:var(--danger)] text-xs"
                  >
                    Failed
                  </Badge>
                </div>
                {imp.errorMessage ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {imp.errorMessage}
                  </p>
                ) : null}
                {imp.requestId ? (
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    request-id:{" "}
                    <span className="text-[color:var(--ink-2)]">
                      {imp.requestId}
                    </span>
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Import History</CardTitle>
        </CardHeader>
        <CardContent>
          {uploads.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No imports yet. Drop a CSV above to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {uploads.map((imp) => (
                <div
                  key={imp.id}
                  className="flex items-center justify-between rounded-lg border border-[color:var(--line)] p-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {imp.fileName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {imp.status === "processing"
                          ? "Processing…"
                          : imp.status === "error"
                            ? imp.errorMessage ?? "Failed"
                            : `${imp.rows} rows imported`}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      imp.status === "success" &&
                        "border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 text-[color:var(--accent)]",
                      imp.status === "error" &&
                        "border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 text-[color:var(--danger)]",
                      imp.status === "processing" &&
                        "animate-pulse border-[color:var(--ink-3)]/30 bg-[color:var(--surface-2)] text-[color:var(--ink-2)]",
                    )}
                  >
                    {imp.status === "success" ? (
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                    ) : imp.status === "error" ? (
                      <AlertCircle className="mr-1 h-3 w-3" />
                    ) : null}
                    {imp.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
