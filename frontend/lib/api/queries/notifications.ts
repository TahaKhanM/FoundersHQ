/**
 * Notifications domain: list, count, mutations, preferences.
 *
 * SWR keys live under `/notifications` so every mutation can `mutate()` them
 * together. In mock mode the queries serve a small static deck so the inbox
 * page is browsable without a backend.
 */
import useSWR, { useSWRConfig } from "swr"

import { apiFetch, IS_MOCK } from "../client"

export type NotificationStatus = "unread" | "all" | "archived"

export type NotificationSeverity = "info" | "warning" | "critical"

export type NotificationType =
  | "spending"
  | "invoice"
  | "runway"
  | "funding"
  | "system"

export interface NotificationDTO {
  id: string
  orgId: string
  type: NotificationType | string
  severity: NotificationSeverity | string
  title: string
  message: string
  evidenceIds: string[]
  deepLink: string | null
  createdAt: string | null
  readAt: string | null
  archivedAt: string | null
  snoozedUntil: string | null
  source: string | null
}

export interface NotificationPreference {
  type: string
  inApp: boolean
  email: boolean
}

export type SnoozeDuration = "1h" | "4h" | "24h" | "monday"

interface BackendNotification {
  id: string
  org_id: string
  type: string
  severity: string
  title: string
  message: string
  evidence_ids: string[] | null
  deep_link: string | null
  created_at: string | null
  read_at: string | null
  archived_at: string | null
  snoozed_until: string | null
  dedupe_key: string | null
  source: string | null
}

interface BackendPreference {
  type: string
  in_app: boolean
  email: boolean
}

function mapNotification(b: BackendNotification): NotificationDTO {
  return {
    id: b.id,
    orgId: b.org_id,
    type: b.type,
    severity: b.severity,
    title: b.title,
    message: b.message,
    evidenceIds: b.evidence_ids ?? [],
    deepLink: b.deep_link,
    createdAt: b.created_at,
    readAt: b.read_at,
    archivedAt: b.archived_at,
    snoozedUntil: b.snoozed_until,
    source: b.source,
  }
}

function mapPreference(b: BackendPreference): NotificationPreference {
  return { type: b.type, inApp: b.in_app, email: b.email }
}

// ---------------------------------------------------------------------------
// Mock fixtures
// ---------------------------------------------------------------------------

const MOCK_NOTIFICATIONS: NotificationDTO[] = [
  {
    id: "mock-n-1",
    orgId: "mock-org",
    type: "runway",
    severity: "critical",
    title: "Low runway",
    message: "Estimated runway: 8.4 weeks.",
    evidenceIds: [],
    deepLink: "/runway",
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    readAt: null,
    archivedAt: null,
    snoozedUntil: null,
    source: "daily_job",
  },
  {
    id: "mock-n-2",
    orgId: "mock-org",
    type: "invoice",
    severity: "warning",
    title: "3 overdue invoices",
    message: "Total overdue: $12,400 across 3 invoice(s).",
    evidenceIds: [],
    deepLink: "/invoices",
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    readAt: null,
    archivedAt: null,
    snoozedUntil: null,
    source: "csv_import",
  },
  {
    id: "mock-n-3",
    orgId: "mock-org",
    type: "spending",
    severity: "info",
    title: "Spend creep detected",
    message: "Current week outflow is 27% above baseline.",
    evidenceIds: [],
    deepLink: "/spending",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    readAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    archivedAt: null,
    snoozedUntil: null,
    source: "daily_job",
  },
]

const MOCK_PREFERENCES: NotificationPreference[] = [
  { type: "spending", inApp: true, email: true },
  { type: "invoice", inApp: true, email: true },
  { type: "runway", inApp: true, email: false },
  { type: "funding", inApp: true, email: true },
  { type: "system", inApp: true, email: false },
]

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

const KEY_LIST = (status: NotificationStatus) => `/notifications?status=${status}`
const KEY_COUNT = "/notifications/count"
const KEY_PREFS = "/notifications/preferences"

export function useNotificationsList(status: NotificationStatus, limit = 50) {
  return useSWR<NotificationDTO[]>(
    [KEY_LIST(status), limit],
    IS_MOCK
      ? async () => {
          if (status === "unread") {
            return MOCK_NOTIFICATIONS.filter(
              (n) => n.readAt === null && n.archivedAt === null && n.snoozedUntil === null,
            )
          }
          if (status === "archived") {
            return MOCK_NOTIFICATIONS.filter((n) => n.archivedAt !== null)
          }
          return MOCK_NOTIFICATIONS
        }
      : async () => {
          const raw = await apiFetch<BackendNotification[]>(
            `/notifications?status=${status}&limit=${limit}`,
          )
          return (raw ?? []).map(mapNotification)
        },
  )
}

export function useNotificationCount() {
  return useSWR<number>(
    KEY_COUNT,
    IS_MOCK
      ? async () =>
          MOCK_NOTIFICATIONS.filter(
            (n) => n.readAt === null && n.archivedAt === null && n.snoozedUntil === null,
          ).length
      : async () => {
          const raw = await apiFetch<{ count: number }>(
            "/notifications/count?status=unread",
          )
          return raw.count ?? 0
        },
  )
}

export function useNotificationPreferences() {
  return useSWR<NotificationPreference[]>(
    KEY_PREFS,
    IS_MOCK
      ? async () => MOCK_PREFERENCES
      : async () => {
          const raw = await apiFetch<BackendPreference[]>("/notifications/preferences")
          return (raw ?? []).map(mapPreference)
        },
  )
}

// ---------------------------------------------------------------------------
// Mutations — components call these directly and then revalidate via
// `useNotificationsMutate()`.
// ---------------------------------------------------------------------------

export async function markNotificationRead(id: string): Promise<NotificationDTO> {
  if (IS_MOCK) {
    const found = MOCK_NOTIFICATIONS.find((n) => n.id === id)
    if (found) found.readAt = new Date().toISOString()
    return found ?? MOCK_NOTIFICATIONS[0]
  }
  const raw = await apiFetch<BackendNotification>(`/notifications/${id}/read`, {
    method: "POST",
  })
  return mapNotification(raw)
}

export async function archiveNotification(id: string): Promise<NotificationDTO> {
  if (IS_MOCK) {
    const found = MOCK_NOTIFICATIONS.find((n) => n.id === id)
    if (found) found.archivedAt = new Date().toISOString()
    return found ?? MOCK_NOTIFICATIONS[0]
  }
  const raw = await apiFetch<BackendNotification>(`/notifications/${id}/archive`, {
    method: "POST",
  })
  return mapNotification(raw)
}

export async function snoozeNotification(
  id: string,
  duration: SnoozeDuration,
): Promise<NotificationDTO> {
  if (IS_MOCK) {
    const found = MOCK_NOTIFICATIONS.find((n) => n.id === id)
    if (found) {
      const ms =
        duration === "1h"
          ? 60 * 60 * 1000
          : duration === "4h"
            ? 4 * 60 * 60 * 1000
            : duration === "24h"
              ? 24 * 60 * 60 * 1000
              : 3 * 24 * 60 * 60 * 1000
      found.snoozedUntil = new Date(Date.now() + ms).toISOString()
    }
    return found ?? MOCK_NOTIFICATIONS[0]
  }
  const raw = await apiFetch<BackendNotification>(`/notifications/${id}/snooze`, {
    method: "POST",
    body: JSON.stringify({ duration }),
  })
  return mapNotification(raw)
}

export async function updateNotificationPreferences(
  preferences: NotificationPreference[],
): Promise<NotificationPreference[]> {
  if (IS_MOCK) {
    return preferences
  }
  const raw = await apiFetch<BackendPreference[]>("/notifications/preferences", {
    method: "PUT",
    body: JSON.stringify({
      preferences: preferences.map((p) => ({
        type: p.type,
        in_app: p.inApp,
        email: p.email,
      })),
    }),
  })
  return (raw ?? []).map(mapPreference)
}

export function useNotificationsMutate() {
  const { mutate } = useSWRConfig()
  return {
    refreshAll: () => {
      void mutate((key) => typeof key === "string" && key.startsWith("/notifications"))
      void mutate((key) => Array.isArray(key) && typeof key[0] === "string" && key[0].startsWith("/notifications"))
    },
    refreshCount: () => mutate(KEY_COUNT),
    refreshPrefs: () => mutate(KEY_PREFS),
    refreshList: (status: NotificationStatus) =>
      mutate((key) => Array.isArray(key) && key[0] === KEY_LIST(status)),
  }
}

export const SNOOZE_OPTIONS: { value: SnoozeDuration; label: string }[] = [
  { value: "1h", label: "1 hour" },
  { value: "4h", label: "4 hours" },
  { value: "24h", label: "24 hours" },
  { value: "monday", label: "Until next Monday" },
]

export const KNOWN_NOTIFICATION_TYPES: NotificationType[] = [
  "spending",
  "invoice",
  "runway",
  "funding",
  "system",
]

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  spending: "Spending",
  invoice: "Invoices",
  runway: "Runway",
  funding: "Funding",
  system: "System",
}
