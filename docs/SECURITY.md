# FoundersHQ — Security Model

> Founders trust us with their cash data. We earn that trust with concrete controls, not platitudes.

## Threat model

We protect against:

1. **Cross-tenant data leaks.** A user from org A must never see a single row from org B.
2. **Credential theft & replay.** Stolen tokens get revoked fast; high-blast-radius actions require fresh auth.
3. **LLM prompt-injection that exfiltrates or misleads.** Guardrails reject; audit logs catch.
4. **Insider abuse.** Every action is logged with user and IP; sensitive actions require approval flows.
5. **Supply-chain compromise.** Dependency pinning + lockfile audits + signed builds.

We do **not** currently protect against:
- Compromised user devices (we recommend 2FA; we will add WebAuthn in phase 6).
- Subpoena of the cloud provider. (Out of scope — talk to a lawyer.)

## Authentication

- JWT (HS256) bearer tokens. 24h expiry. Refresh tokens with rotation.
- Phase 1 adds: email/password with bcrypt (already used), email-verification on signup, password reset, magic-link invitations.
- Phase 6 adds: WebAuthn / passkeys; optional TOTP.
- All auth events are audit-logged.

## Authorization

- `CurrentOrg` injection in every route is the boundary. No route bypasses it.
- Roles: `owner`, `admin`, `member`, `viewer`. The `requires(role)` dependency gates mutations.
- Owner-only: delete org, change billing, manage integrations' OAuth tokens.
- Admin-or-owner: invite members, change roles, manage API keys, create share links.
- Member-or-above: log touches, override categories, run forecasts, run decision queries.
- Viewer: read everything; write nothing.

Frontend role checks are UX-only. The backend re-checks on every mutation. **Never trust the frontend.**

## Data isolation

- Every org-scoped table has an `org_id` column with a foreign key and an index.
- A SQLAlchemy event listener (dev + staging) asserts `org_id` is present on every insert; raises in non-prod, logs + alerts in prod.
- Background jobs accept `org_id` as an explicit parameter; no global "all orgs" queries except for: FX-rate refresh, benchmark aggregation, scheduled-cleanup tasks.
- Public share links (F7) embed a signed token; the consumer route reads `share_links.snapshot` (frozen JSON) and **never** queries the live tables.

## Secrets

- Encrypted at rest with `cryptography.Fernet`; the Fernet key comes from env via `app.config`.
- Per-org secrets (Plaid item tokens, Slack tokens, etc.) live in the `connections` table, encrypted.
- The Fernet master key is derived from `SECRET_KEY` via HKDF; org-specific keys derived per-org via HKDF with `org_id` as the info parameter.
- No secrets in logs, error responses, or audit log details. A linter rule enforces this.

## Audit logs

- Append-only. Every mutation route writes a row via `record_audit(...)`.
- Every LLM call writes to `llm_calls` with the `facts_hash` (so we can prove what the model saw).
- Audit log UI (phase 1) supports filter + export. Export is CSV; for "send to auditor" we use the signed-export flow (F34).
- Retention: forever, with cold-storage archival from a future phase.

## LLM guardrails (reiteration)

- Every LLM call goes through `validate_llm_response`.
- Causal claims without UUID citation are rejected.
- Numbers not in the facts payload are rejected.
- Prompt injection in user input: sanitized, but the real defense is the validator — even if an injection causes the model to "speak freely", any number it invents fails the number check.
- See `.claude/skills/evidence-linked-llm/SKILL.md` for the mandatory pattern.

## Rate limiting

- Token bucket per IP and per API key (phase 5 adds API keys).
- Hard limits: 60 req/sec/IP for read endpoints; 10 req/sec/IP for writes; 2 req/sec for `/llm/*`.
- LLM cost ceiling: per-org monthly cap surfaced in admin; hard rejection past the cap.

## Inbound integration signatures

- All inbound webhooks (Plaid, Stripe, QuickBooks, Slack) verify the provider's signature using their documented method.
- A unverified webhook is logged and dropped with a 401.

## Sensitive UI affordances

- Card-rule changes, share-link creation, scenario→baseline promotion, integration disconnects, and member removal all require:
  - re-entering the user's password (or fresh 2FA), **and**
  - an audit entry with the reason field populated.
- High-blast-radius actions can be configured to require a second approver (F29 Slack approvals).

## CSP and headers

- Strict CSP on the frontend: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' [tailwind]; img-src 'self' data: <blob>; connect-src 'self' <api> <openai>`.
- `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`.
- No third-party scripts other than `@vercel/analytics`.

## Dependencies

- `pnpm audit` and `pip-audit` (or `safety`) in CI; PRs fail on critical advisories.
- Major-version bumps require a maintainer review.
- Lockfiles committed; `--frozen-lockfile` on CI.

## Data deletion

- Org delete is a soft-delete first (30-day grace); hard delete after grace expires.
- Hard delete cascades through every org-scoped table.
- Backups: scheduled daily, encrypted, with 30-day retention. Restore-from-backup is a documented (but rare) procedure with audit entries.

## Incident response

- Every error response carries a `request_id`; logs are indexed by it.
- A `/status` page (Phase 5) surfaces system health.
- Incidents above sev-2 trigger a post-mortem in `docs/post-mortems/`.
