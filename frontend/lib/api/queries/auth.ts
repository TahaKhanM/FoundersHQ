/**
 * Auth-related mutations: forgot password, reset password, accept invite.
 *
 * Each hook returns a thin wrapper around fetch. Components must never call
 * apiFetch directly; in mock mode the hooks just no-op-resolve.
 */
import { apiFetch, IS_MOCK } from "../client"
import type {
  AcceptInviteInput,
  ForgotPasswordInput,
  ForgotPasswordResult,
  ResetPasswordInput,
  SessionDTO,
} from "../types"

interface BackendForgotPasswordResponse {
  ok: boolean
  dev_token?: string | null
}

interface BackendAcceptInviteResponse {
  access_token: string
  token_type: string
  user: { id: string; email: string; created_at?: string }
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<ForgotPasswordResult> {
  if (IS_MOCK) {
    return { ok: true, devToken: "mock-dev-token" }
  }
  const res = await apiFetch<BackendForgotPasswordResponse>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: input.email }),
  })
  return { ok: res.ok, devToken: res.dev_token ?? null }
}

export async function resetPassword(input: ResetPasswordInput): Promise<{ ok: boolean }> {
  if (IS_MOCK) {
    return { ok: true }
  }
  const res = await apiFetch<{ ok: boolean }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: input.token, new_password: input.newPassword }),
  })
  return { ok: res.ok }
}

export async function acceptInvite(input: AcceptInviteInput): Promise<SessionDTO & { accessToken: string }> {
  if (IS_MOCK) {
    return {
      user: { id: "mock", email: input.email, orgId: "mock-org" },
      tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      accessToken: "mock-token",
    }
  }
  const res = await apiFetch<BackendAcceptInviteResponse>("/auth/accept-invite", {
    method: "POST",
    body: JSON.stringify({
      token: input.token,
      email: input.email,
      password: input.password,
    }),
  })
  return {
    user: { id: res.user.id, email: res.user.email, orgId: "" },
    tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    accessToken: res.access_token,
  }
}
