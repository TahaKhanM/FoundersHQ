/**
 * Audit log queries: paginated list + CSV export.
 *
 * The list hook is keyed by the serialized filter object so that changing
 * a filter triggers an SWR re-fetch. The export helper bypasses SWR and
 * returns a Blob URL ready for `<a href=... download>` consumption.
 */
import useSWR from "swr"

import { API_BASE_URL, apiFetch, IS_MOCK } from "../client"
import { getAccessToken } from "../auth"
import type {
  AuditLogDTO,
  AuditLogFilters,
  AuditLogListResponse,
} from "../types"

interface BackendAuditLog {
  id: string
  org_id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown> | null
  request_id: string | null
  created_at: string
}

interface BackendAuditList {
  items: BackendAuditLog[]
  next_cursor: string | null
}

function mapAuditLog(b: BackendAuditLog): AuditLogDTO {
  return {
    id: b.id,
    orgId: b.org_id,
    userId: b.user_id,
    action: b.action,
    entityType: b.entity_type,
    entityId: b.entity_id,
    details: b.details ?? {},
    requestId: b.request_id,
    createdAt: b.created_at,
  }
}

/** Build the query-string for audit filters. Empty / undefined values are omitted. */
export function buildAuditQuery(filters: AuditLogFilters): string {
  const params = new URLSearchParams()
  if (filters.action) params.set("action", filters.action)
  if (filters.entityType) params.set("entity_type", filters.entityType)
  if (filters.userId) params.set("user_id", filters.userId)
  if (filters.from) params.set("from", filters.from)
  if (filters.to) params.set("to", filters.to)
  if (filters.cursor) params.set("cursor", filters.cursor)
  if (filters.limit) params.set("limit", String(filters.limit))
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

const MOCK_AUDIT: AuditLogDTO[] = [
  {
    id: "audit-1",
    orgId: "mock-org",
    userId: "mock-user-1",
    action: "invitation.created",
    entityType: "invitation",
    entityId: "inv-001",
    details: { email: "new@example.com", role: "admin" },
    requestId: "req-001",
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "audit-2",
    orgId: "mock-org",
    userId: "mock-user-1",
    action: "membership.role_changed",
    entityType: "membership",
    entityId: "mem-002",
    details: { from: "member", to: "admin" },
    requestId: "req-002",
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "audit-3",
    orgId: "mock-org",
    userId: null,
    action: "password.reset_requested",
    entityType: "user",
    entityId: "u-003",
    details: { email: "x@example.com" },
    requestId: "req-003",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
]

export function useAuditLogs(filters: AuditLogFilters) {
  const key = `/audit${buildAuditQuery(filters)}`
  return useSWR<AuditLogListResponse>(
    key,
    IS_MOCK
      ? async () => {
          const filtered = MOCK_AUDIT.filter((row) => {
            if (filters.action && row.action !== filters.action) return false
            if (filters.entityType && row.entityType !== filters.entityType) return false
            if (filters.userId && row.userId !== filters.userId) return false
            return true
          })
          return { items: filtered, nextCursor: null }
        }
      : async () => {
          const raw = await apiFetch<BackendAuditList>(key)
          return {
            items: raw.items.map(mapAuditLog),
            nextCursor: raw.next_cursor,
          }
        },
  )
}

/**
 * Trigger a CSV download. Filters mirror the list view (no `cursor` / `limit`).
 * Returns once the file has been handed to the browser.
 */
export async function downloadAuditCsv(
  filters: Omit<AuditLogFilters, "cursor" | "limit">,
): Promise<void> {
  if (IS_MOCK) {
    const header = "created_at,action,entity_type,entity_id,user_id,request_id,details\n"
    const lines = MOCK_AUDIT.map(
      (r) =>
        `${r.createdAt},${r.action},${r.entityType},${r.entityId ?? ""},${r.userId ?? ""},${r.requestId ?? ""},${JSON.stringify(r.details)}`,
    ).join("\n")
    const blob = new Blob([header + lines], { type: "text/csv" })
    triggerDownload(blob, defaultFilename())
    return
  }
  const qs = buildAuditQuery(filters)
  const token = getAccessToken()
  const res = await fetch(`${API_BASE_URL}/audit/export.csv${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  })
  if (!res.ok) {
    throw new Error(`CSV export failed: ${res.status}`)
  }
  const blob = await res.blob()
  const filename = extractFilename(res.headers.get("content-disposition")) ?? defaultFilename()
  triggerDownload(blob, filename)
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Defer revoke so Safari has a tick to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function extractFilename(disposition: string | null): string | null {
  if (!disposition) return null
  const m = /filename="([^"]+)"/.exec(disposition)
  return m ? m[1] : null
}

function defaultFilename(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `audit-log-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.csv`
}
