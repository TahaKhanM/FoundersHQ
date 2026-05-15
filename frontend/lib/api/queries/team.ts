/**
 * Team domain: members + pending invitations.
 *
 * SWR keyed by "/org/members" and "/org/invitations". Mutations call apiFetch
 * directly then revalidate via `mutate(key)` from the caller.
 */
import useSWR, { useSWRConfig } from "swr"
import { apiFetch, IS_MOCK } from "../client"
import type {
  InvitationDTO,
  InvitationCreateInput,
  MembershipDTO,
  OrgRole,
} from "../types"

interface BackendMembership {
  id: string
  org_id: string
  user_id: string
  email: string
  role: string
  created_at: string
}

interface BackendInvitation {
  id: string
  org_id: string
  email: string
  role: string
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
  created_at: string
  dev_token?: string | null
}

function mapMembership(b: BackendMembership): MembershipDTO {
  return {
    id: b.id,
    orgId: b.org_id,
    userId: b.user_id,
    email: b.email,
    role: (b.role as OrgRole),
    createdAt: b.created_at,
  }
}

function mapInvitation(b: BackendInvitation): InvitationDTO {
  return {
    id: b.id,
    orgId: b.org_id,
    email: b.email,
    role: (b.role as Exclude<OrgRole, "owner">),
    expiresAt: b.expires_at,
    acceptedAt: b.accepted_at,
    revokedAt: b.revoked_at,
    createdAt: b.created_at,
    devToken: b.dev_token ?? null,
  }
}

const MOCK_MEMBERS: MembershipDTO[] = [
  {
    id: "mock-m-1",
    orgId: "mock-org",
    userId: "mock-u-1",
    email: "founder@example.com",
    role: "owner",
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

const MOCK_INVITES: InvitationDTO[] = []

export function useMembers() {
  return useSWR<MembershipDTO[]>(
    "/org/members",
    IS_MOCK
      ? async () => MOCK_MEMBERS
      : async () => {
          const raw = await apiFetch<BackendMembership[]>("/org/members")
          return raw.map(mapMembership)
        }
  )
}

export function useInvitations() {
  return useSWR<InvitationDTO[]>(
    "/org/invitations",
    IS_MOCK
      ? async () => MOCK_INVITES
      : async () => {
          const raw = await apiFetch<BackendInvitation[]>("/org/invitations")
          return raw.map(mapInvitation)
        }
  )
}

export async function createInvitation(input: InvitationCreateInput): Promise<InvitationDTO> {
  if (IS_MOCK) {
    return {
      id: `mock-${Math.random().toString(36).slice(2, 8)}`,
      orgId: "mock-org",
      email: input.email,
      role: input.role,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      acceptedAt: null,
      revokedAt: null,
      createdAt: new Date().toISOString(),
      devToken: "mock-dev-token",
    }
  }
  const raw = await apiFetch<BackendInvitation>("/org/invitations", {
    method: "POST",
    body: JSON.stringify({ email: input.email, role: input.role }),
  })
  return mapInvitation(raw)
}

export async function revokeInvitation(id: string): Promise<void> {
  if (IS_MOCK) return
  await apiFetch<void>(`/org/invitations/${id}`, { method: "DELETE" })
}

export async function updateMemberRole(membershipId: string, role: OrgRole): Promise<MembershipDTO> {
  if (IS_MOCK) {
    return {
      id: membershipId,
      orgId: "mock-org",
      userId: "mock",
      email: "mock@example.com",
      role,
      createdAt: new Date().toISOString(),
    }
  }
  const raw = await apiFetch<BackendMembership>(`/org/members/${membershipId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  })
  return mapMembership(raw)
}

export async function removeMember(membershipId: string): Promise<void> {
  if (IS_MOCK) return
  await apiFetch<void>(`/org/members/${membershipId}`, { method: "DELETE" })
}

export function useTeamMutate() {
  const { mutate } = useSWRConfig()
  return {
    refreshMembers: () => mutate("/org/members"),
    refreshInvites: () => mutate("/org/invitations"),
  }
}
