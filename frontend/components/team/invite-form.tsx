"use client"

import { useState } from "react"
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
import { Loader2 } from "lucide-react"
import { createInvitation } from "@/lib/api/queries/team"
import type { InvitationDTO } from "@/lib/api/types"

interface InviteFormProps {
  onCreated: (inv: InvitationDTO) => void
}

type InviteRole = "admin" | "member"

export function InviteForm({ onCreated }: InviteFormProps) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<InviteRole>("member")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    try {
      const inv = await createInvitation({ email: email.trim(), role })
      onCreated(inv)
      setEmail("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row md:items-end">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          type="email"
          placeholder="teammate@startup.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5 md:w-40">
        <Label htmlFor="invite-role">Role</Label>
        <Select value={role} onValueChange={(v) => setRole(v as InviteRole)}>
          <SelectTrigger id="invite-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={loading || !email.trim()}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Send invite
      </Button>
      {error && (
        <div className="md:col-span-full text-sm text-destructive" role="alert">
          {error}
        </div>
      )}
    </form>
  )
}
