"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/common/page-header"
import { EmptyState } from "@/components/common/empty-state"
import { InviteForm } from "@/components/team/invite-form"
import { MemberRow } from "@/components/team/member-row"
import { useInvitations, useMembers, revokeInvitation, useTeamMutate } from "@/lib/api/queries/team"
import type { InvitationDTO, OrgRole } from "@/lib/api/types"
import { Copy, X } from "lucide-react"

export default function TeamPage() {
  const members = useMembers()
  const invites = useInvitations()
  const { refreshMembers, refreshInvites } = useTeamMutate()
  const [recentInvite, setRecentInvite] = useState<InvitationDTO | null>(null)

  // Best-effort viewer role: assume owner of own org until /auth/me ships role.
  // Server is the boundary; this only controls UX rendering.
  const viewerRole: OrgRole = "owner"

  function handleInviteCreated(inv: InvitationDTO) {
    setRecentInvite(inv)
    void refreshInvites()
  }

  async function handleRevoke(id: string) {
    await revokeInvitation(id)
    void refreshInvites()
  }

  return (
    <>
      <PageHeader
        title="Team"
        description="Invite teammates and manage their roles."
      />

      <div className="space-y-6 max-w-4xl">
        {/* Invite form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite a teammate</CardTitle>
            <CardDescription>
              They receive a magic-link email (or, in dev, a one-time token shown here).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteForm onCreated={handleInviteCreated} />
            {recentInvite?.devToken && (
              <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-xs">
                <p className="font-medium text-foreground">Dev magic link (one time):</p>
                <code className="mt-1 block break-all rounded bg-background px-2 py-1 font-mono text-foreground">
                  {`${window.location.origin}/accept-invite?token=${recentInvite.devToken}&email=${encodeURIComponent(recentInvite.email)}`}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-2 h-7"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      `${window.location.origin}/accept-invite?token=${recentInvite.devToken}&email=${encodeURIComponent(recentInvite.email)}`,
                    )
                  }
                >
                  <Copy className="mr-1.5 h-3 w-3" />
                  Copy link
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Members table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members</CardTitle>
            <CardDescription>{members.data?.length ?? 0} teammates with access</CardDescription>
          </CardHeader>
          <CardContent>
            {members.isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : members.error ? (
              <p className="text-sm text-destructive">
                Failed to load members.{" "}
                <Button variant="link" className="px-1" onClick={() => members.mutate()}>
                  Retry
                </Button>
              </p>
            ) : members.data && members.data.length > 0 ? (
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">Email</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">Role</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">Joined</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {members.data.map((m) => (
                      <MemberRow
                        key={m.id}
                        member={m}
                        viewerRole={viewerRole}
                        onChanged={() => refreshMembers()}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No teammates yet"
                description="Invite your first teammate to share dashboards and approve actions."
              />
            )}
          </CardContent>
        </Card>

        {/* Pending invites */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending invitations</CardTitle>
            <CardDescription>
              {invites.data?.length ?? 0} outstanding invite{invites.data?.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invites.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : invites.error ? (
              <p className="text-sm text-destructive">Failed to load invitations.</p>
            ) : invites.data && invites.data.length > 0 ? (
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">Email</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">Role</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">Expires</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {invites.data.map((inv) => (
                      <tr key={inv.id} className="border-t border-border">
                        <td className="px-4 py-3 text-sm text-foreground">{inv.email}</td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant="secondary" className="capitalize">{inv.role}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => handleRevoke(inv.id)}
                          >
                            <X className="mr-1.5 h-3 w-3" />
                            Revoke
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No pending invitations.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
