"use client"

import { useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  KNOWN_NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  updateNotificationPreferences,
  useNotificationPreferences,
  useNotificationsMutate,
  type NotificationPreference,
  type NotificationType,
} from "@/lib/api/queries/notifications"
import { cn } from "@/lib/utils"

interface Props {
  className?: string
}

export function NotificationPreferences({ className }: Props) {
  const { data, isLoading, error, mutate } = useNotificationPreferences()
  const { refreshPrefs } = useNotificationsMutate()
  const [savingType, setSavingType] = useState<string | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)

  async function setPref(type: NotificationType, partial: Partial<NotificationPreference>) {
    if (!data) return
    setSavingType(type)
    setErrorText(null)
    const next = data.map((p) => (p.type === type ? { ...p, ...partial } : p))
    // Optimistically render the new state.
    await mutate(next, { revalidate: false })
    try {
      const saved = await updateNotificationPreferences(next)
      await mutate(saved, { revalidate: false })
      refreshPrefs()
    } catch (err) {
      await mutate(data, { revalidate: false })
      setErrorText(err instanceof Error ? err.message : "Failed to save preferences")
    } finally {
      setSavingType(null)
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">Notification preferences</CardTitle>
        <CardDescription>
          Choose how you receive each type of insight. Disabling a channel never
          deletes the notification — it just stops showing or sending it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}
        {error && !isLoading && (
          <p className="text-sm text-destructive">Failed to load preferences.</p>
        )}
        {errorText && (
          <p className="mb-3 text-sm text-destructive">{errorText}</p>
        )}
        {data && !isLoading && (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                    In-app
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                    Email
                  </th>
                </tr>
              </thead>
              <tbody>
                {KNOWN_NOTIFICATION_TYPES.map((type) => {
                  const pref = data.find((p) => p.type === type) ?? {
                    type,
                    inApp: true,
                    email: true,
                  }
                  const saving = savingType === type
                  return (
                    <tr
                      key={type}
                      className={cn(
                        "border-t border-border",
                        saving && "opacity-60",
                      )}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {NOTIFICATION_TYPE_LABELS[type as NotificationType]}
                      </td>
                      <td className="px-4 py-3">
                        <Switch
                          checked={pref.inApp}
                          disabled={saving}
                          onCheckedChange={(v) =>
                            void setPref(type as NotificationType, { inApp: Boolean(v) })
                          }
                          aria-label={`Toggle in-app for ${type}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Switch
                          checked={pref.email}
                          disabled={saving}
                          onCheckedChange={(v) =>
                            void setPref(type as NotificationType, { email: Boolean(v) })
                          }
                          aria-label={`Toggle email for ${type}`}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
