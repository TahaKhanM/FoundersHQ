"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, X } from "lucide-react"
import { removeMember, updateMemberRole } from "@/lib/api/queries/team"
import type { MembershipDTO, OrgRole } from "@/lib/api/types"

interface MemberRowProps {
  member: MembershipDTO
  /** Current user's role, for UX gating (server still enforces). */
  viewerRole: OrgRole
  onChanged: () => void
}

export function MemberRow({ member, viewerRole, onChanged }: MemberRowProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const canEdit = viewerRole === "owner" || viewerRole === "admin"

  async function handleRoleChange(role: OrgRole) {
    if (role === member.role) return
    setBusy(true)
    setError(null)
    try {
      await updateMemberRole(member.id, role)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.")
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    setBusy(true)
    setError(null)
    try {
      await removeMember(member.id)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed.")
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3 text-sm text-foreground">{member.email}</td>
      <td className="px-4 py-3 text-sm">
        {canEdit ? (
          <Select
            value={member.role}
            onValueChange={(v) => handleRoleChange(v as OrgRole)}
            disabled={busy}
          >
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Member</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="capitalize text-muted-foreground">{member.role}</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {new Date(member.createdAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 text-right">
        {canEdit && (
          confirming ? (
            <div className="inline-flex items-center gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={handleRemove}
              >
                {busy && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                Confirm
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setConfirming(true)}
              disabled={busy}
            >
              <X className="mr-1.5 h-3 w-3" />
              Remove
            </Button>
          )
        )}
        {error && (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </td>
    </tr>
  )
}
