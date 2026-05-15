"use client"

import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AuditLogFilters } from "@/lib/api/types"

/**
 * Known action keys, kept in lockstep with backend mutations that call
 * record_audit. Used as a select dropdown; "all" clears the filter.
 *
 * Keep this list short — it's a quick filter, not an exhaustive registry.
 * Users can still drill into anything via the URL.
 */
export const KNOWN_ACTIONS = [
  "invitation.created",
  "invitation.revoked",
  "invitation.accepted",
  "membership.role_changed",
  "membership.removed",
  "password.reset_requested",
  "password.reset_completed",
] as const

export const KNOWN_ENTITY_TYPES = [
  "invitation",
  "membership",
  "user",
] as const

interface Props {
  value: AuditLogFilters
  onChange: (next: AuditLogFilters) => void
  onClear: () => void
}

export function AuditFilters({ value, onChange, onClear }: Props) {
  const hasAny =
    !!value.action || !!value.entityType || !!value.userId || !!value.from || !!value.to

  function patch(p: Partial<AuditLogFilters>) {
    // Drop the cursor whenever filters change so we start over from page 1.
    onChange({ ...value, ...p, cursor: undefined })
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/20 p-3">
      <div className="space-y-1">
        <Label htmlFor="audit-action" className="text-xs">
          Action
        </Label>
        <Select
          value={value.action ?? "all"}
          onValueChange={(v) =>
            patch({ action: v === "all" ? undefined : v })
          }
        >
          <SelectTrigger id="audit-action" className="w-[220px]">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {KNOWN_ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="audit-entity" className="text-xs">
          Entity
        </Label>
        <Select
          value={value.entityType ?? "all"}
          onValueChange={(v) =>
            patch({ entityType: v === "all" ? undefined : v })
          }
        >
          <SelectTrigger id="audit-entity" className="w-[180px]">
            <SelectValue placeholder="All entities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {KNOWN_ENTITY_TYPES.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="audit-user" className="text-xs">
          User ID
        </Label>
        <Input
          id="audit-user"
          value={value.userId ?? ""}
          onChange={(e) => patch({ userId: e.target.value || undefined })}
          placeholder="uuid"
          className="w-[280px] font-mono text-xs"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="audit-from" className="text-xs">
          From
        </Label>
        <Input
          id="audit-from"
          type="date"
          value={toDateInput(value.from)}
          onChange={(e) =>
            patch({ from: e.target.value ? `${e.target.value}T00:00:00Z` : undefined })
          }
          className="w-[160px]"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="audit-to" className="text-xs">
          To
        </Label>
        <Input
          id="audit-to"
          type="date"
          value={toDateInput(value.to)}
          onChange={(e) =>
            patch({ to: e.target.value ? `${e.target.value}T23:59:59Z` : undefined })
          }
          className="w-[160px]"
        />
      </div>

      {hasAny ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-muted-foreground"
        >
          <X className="mr-1.5 h-3 w-3" />
          Clear
        </Button>
      ) : null}
    </div>
  )
}

function toDateInput(iso: string | undefined): string {
  if (!iso) return ""
  // Strip everything after the date component for the native input.
  return iso.slice(0, 10)
}
