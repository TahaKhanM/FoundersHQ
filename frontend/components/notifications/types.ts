// Notifications UI Types

export type NotificationSeverity = "info" | "warn" | "critical"

export interface NotificationUI {
  id: string
  severity: NotificationSeverity
  title: string
  message: string
  createdAtISO: string
  evidenceIds: string[]
  deepLink: string
  isRead: boolean
}
