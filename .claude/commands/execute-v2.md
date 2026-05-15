---
description: Autonomously build the next slice of FoundersHQ. Phase-aware, resumable, self-verifying.
argument-hint: [phase=N | workstream=N.X | resume]
---

# /execute-v2 — FoundersHQ autonomous build driver

You are the autonomous build driver for **FoundersHQ**. This command is invoked repeatedly. Every invocation: orient → decide → plan → dispatch → integrate → verify → record → advance. Do not stop until the current phase's gate is met or you hit an authorized-decision blocker.

Arguments (optional, via `$ARGUMENTS`):
- `phase=N` — force start at phase N (skipping detection).
- `workstream=N.X` — execute one specific workstream.
- `resume` — resume the most recent in-progress workstream from its plan.
- (no arguments) — detect state and continue from where the last invocation left off.

---

## Step 0 — Load the floor (every invocation, no exceptions)

Before anything else, in parallel:

1. **Invoke `Skill` `foundershq-conventions`.** This skill is mandatory on every turn. It encodes the three invariants. Announce: `Using foundershq-conventions skill`.
2. **Read** `CLAUDE.md`, `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/FEATURE_ROADMAP.md`. (You may skip files already in context from a prior turn — but never skip them on a cold start.)
3. **`git status`** and **`git log --oneline -n 20`**. Confirm we're on a sensible branch (default: `main`; for phases ≥1 prefer feature branches `phase-N/<workstream>`).
4. **`ls docs/changelog/`** to determine the highest completed phase.
5. **`cat docs/parking-lot.md`** to surface deferred ideas relevant to this phase.

State the detected current phase and next workstream in one sentence to the user.

---

## Step 1 — Decide what to do this turn

Decision tree:

```
if $ARGUMENTS contains phase=N:
    target_phase = N; target_workstream = first not-completed in that phase
elif $ARGUMENTS contains workstream=N.X:
    target_phase = N; target_workstream = N.X
elif $ARGUMENTS == "resume":
    target_workstream = the most recent workstream branch with a written plan, not yet merged
else:
    target_phase   = (highest completed in docs/changelog/) + 0 if that phase still has open workstreams, else +1
    target_workstream = next workstream listed in FEATURE_ROADMAP.md for target_phase that has no merge yet
```

If `target_phase == 0` and there's no `.claude/settings.local.json` with the permissions block from `BUILD_PROMPT.md`, **stop and request the user pastes it in**. This is one of the few authorized-blocker conditions.

Announce: `phase {N}.{X} — {one-line workstream goal}`.

---

## Step 2 — Plan (or load the existing plan)

For each workstream:

1. Check `docs/plans/phase-{N}-{X}.md`. If absent, generate it now:
   - Invoke `Skill` `superpowers:brainstorming` first **only if** the workstream is non-trivial (Tier 1+ feature, new external integration, new schema). For pure plumbing (CI, lint config, migration scaffolding), skip brainstorming and go straight to plan-writing.
   - Invoke `Skill` `superpowers:writing-plans`.
   - The plan must list: files touched, schema changes, tests, success criteria, dependencies on other workstreams.
   - Save the plan to `docs/plans/phase-{N}-{X}.md`. **Commit the plan before writing code.**

2. If the workstream is in a domain covered by a skill, load it now:
   - Touching metrics/forecasts → `deterministic-finance`.
   - Touching LLM → `evidence-linked-llm`.
   - Touching server-side agents → `multi-agent-orchestration` + `claude-api` (if Anthropic SDK in play).
   - Touching SSE / pub-sub / streaming / durable flows → `realtime-and-streaming` (and `vercel:workflow` for WDK).
   - Touching UI surfaces → `frontend-design:frontend-design` + the relevant `vercel:*` skill (`vercel:nextjs`, `vercel:shadcn`, `vercel:next-cache-components`, `vercel:ai-sdk`).
   - Touching storage (receipts) → `vercel:vercel-storage`.
   - Touching deployment / env → `vercel:deployments-cicd`, `vercel:env-vars`.

3. Cross-check the plan against `docs/PRODUCT_SPEC.md`. If the plan extends beyond what the spec describes, **append the new scope to `docs/parking-lot.md`** rather than implementing it now.

---

## Step 3 — Dispatch (parallel where independent)

Identify sub-tasks within the workstream that share no state. Dispatch them as parallel `Agent` calls in one message. Briefing each subagent:

> **Goal:** {one-sentence outcome}.
> **Read:** `docs/plans/phase-{N}-{X}.md`, plus {specific files}.
> **Use skills:** {skill names}.
> **Files you may write:** {explicit list}.
> **Definition of done:** {bulleted, including the test name(s) that must pass}.
> **Report format:** {what to send back, under N words}.
> **Do not:** {scope guardrails}.

Always include `superpowers:test-driven-development` for any implementation subagent. The TDD skill makes them write the failing test first, then the code.

For research / scoping subagents, use `Explore` (read-only, fast). For design considerations across files, use `Plan`. For build work, use `general-purpose` or a `vercel:*` specialist.

When dispatching three or more agents, batch them in **one message** so they run concurrently — never sequentially when independent.

---

## Step 4 — Integrate

When subagents return:

1. Trust but verify — open each file the subagent claims it changed; confirm the change actually exists.
2. Run the test commands the plan specified (`pytest -x`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm exec playwright test`).
3. Bring up the relevant dev surface and exercise the feature (use `mcp__plugin_playwright_playwright__*` to drive a browser if the change is UI-visible).
4. If anything fails: load `Skill` `superpowers:systematic-debugging`. Do not paper over failures.

Commits during integration follow conventional commits: `feat(phase-2.A): plaid link & exchange`, `test(phase-2.A): item-error reconnect path`. Each logical chunk is its own commit.

---

## Step 5 — Verify against the gate

Before claiming the workstream done:

1. **Invoke `Skill` `superpowers:verification-before-completion`.** Quote its checklist.
2. Run the quality gates (every phase, no exceptions):
   - `cd backend && make verify` — ruff + mypy + pytest, all green.
   - `cd frontend && pnpm verify` — tsc + eslint + tests, all green.
   - Audit log entry exists for every new mutation route (grep for `record_audit(`).
   - `validate_llm_response` called for every new LLM call site (grep).
   - The user-visible surface renders loading, empty, and error states (manual check + Playwright snapshots).
   - A Playwright test covers at least the happy path.
3. Re-read the workstream's gate from `FEATURE_ROADMAP.md`. Quote it and the evidence that it's met.

If a gate fails: do not advance. Loop back to Step 3 with a corrective sub-task.

---

## Step 6 — Record

When the workstream passes:

1. Open or update `docs/changelog/phase-{N}.md` using the template in `docs/changelog/README.md`. Append this workstream's entry.
2. Append any deferred scope to `docs/parking-lot.md`.
3. If the workstream changed the conventions or surfaced a new pattern worth keeping, update the relevant `.claude/skills/*/SKILL.md`. If it surfaced a new architectural module, update `docs/ARCHITECTURE.md`.
4. Commit the docs changes: `docs(phase-{N}.{X}): changelog + parking lot`.

If the workstream completed an entire phase:

5. Verify the phase-level gate (in `FEATURE_ROADMAP.md`).
6. Write the phase summary section in `docs/changelog/phase-{N}.md`.
7. Open a PR for the phase branch (if used). `gh pr create` with the changelog content as the body. Do not auto-merge.
8. Announce: `phase {N} complete — gate met. next: phase {N+1}.`

---

## Step 7 — Advance or stop

- If there are more workstreams in this phase: continue with the next one **in the same turn** if budget allows; otherwise stop and let the next `/execute-v2` invocation pick up.
- If the phase is complete and the user is present: ask whether to proceed to phase {N+1} or pause.
- If the user is not present (autonomous mode): **proceed automatically up to phase 3**; pause before phase 4 (sharing — public surface change), phase 6 (cutting-edge AI — cost-bearing), phase 7 (native experiences — new surfaces requiring provider keys), and phase 8 (ecosystem — broader implications). These pause-points let the user confirm cost and external impact.

When pausing, surface:
- What was done this run (1–2 sentence summary).
- What's queued next (workstream name + 1 sentence).
- Any blockers requiring user input (API keys, OAuth apps, design decisions).

---

## Phase-specific entry hints

Use these as the first move when entering each phase for the first time. Each phase's `docs/FEATURE_ROADMAP.md` section is the authoritative source of work.

### Phase 0 first moves
1. Confirm `.claude/settings.local.json` exists with the permissions block (else block on user).
2. Dispatch in parallel: 0.A (housekeeping), 0.B (backend infra), 0.C (frontend infra), 0.D (design system). Each gets its own subagent.
3. CI workflows under `.github/workflows/` are part of 0.A. Use templates the user can review.

### Phase 1 first moves
1. RBAC middleware is the unblocker — do 1.A first, sequentially.
2. Then dispatch 1.B (onboarding), 1.C (notifications), 1.D (per-page polish, 5 sub-subagents one per surface), 1.E (audit UI), 1.F (search) in parallel.

### Phase 2 first moves
1. 2.C (multi-currency migration) blocks 2.A — do it first.
2. Then 2.A (Plaid) and 2.B (QBO/Xero/Stripe) in parallel; 2.D (documents) and 2.E (SSE wiring) in parallel after.
3. 2.F (Insight Stream) depends on the above; do it last.

### Phase 3 first moves
1. 3.A (scenarios) and 3.B (vendor intel) are independent — parallel.
2. 3.C (customer health) depends on lateness history → parallel with above.
3. 3.D (decision engine) depends on 3.A scenario primitives.
4. 3.E (Copilot side panel) depends on the SSE wiring from phase 2 — last.

### Phase 4 first moves
1. **Pause for user confirmation** — share links are a public surface; confirm scope and privacy expectations.
2. Then 4.A (links) and 4.B (investor update) in parallel.

### Phase 5 first moves
1. 5.A integrations are independent of each other — Slack, Linear, Notion, Webhooks, Email each a subagent.
2. 5.B (API keys + public REST + webhooks) is one workstream — do it as a sequence inside one plan.
3. 5.C (PWA) last.

### Phase 6 first moves
1. **Pause for user confirmation** — multi-agent loops have real API cost; agree on per-org caps.
2. 6.B (probabilistic forecast) and 6.C (semantic categorization) and 6.D (time-machine) and 6.E (capital efficiency) are independent — parallel.
3. 6.A (Causal Analyst) depends on 6.B + 6.C + 6.D — last.

### Phase 7 first moves
1. **Pause for user confirmation** — voice / email-in / browser extension each need provider accounts.
2. 7.B (Email AI), 7.C (Document Vault), 7.E (Slack approvals) are independent — parallel.
3. 7.A (Voice Copilot) requires Realtime API access; gate on that.
4. 7.D (Browser extension) is a separate codebase; treat as its own mini-repo under `extension/`.

### Phase 8 first moves
1. **Pause for user confirmation** — public benchmark network (F30) has privacy implications; agree on the privacy model before code.
2. 8.A, 8.B, 8.C, 8.E, 8.F are independent — parallel.
3. 8.D (federated reporting) requires the investor-tenant model; gate on schema decision.

---

## Hard rules (do not violate, ever)

1. **Skills first.** Every turn loads `foundershq-conventions`. Domain skills load before code touches their domain. Process skills (TDD, debugging, verification) load before the action they govern.
2. **Plans before code.** No implementation without a written plan in `docs/plans/phase-{N}-{X}.md` that has been committed.
3. **TDD per task.** Failing test → make pass → refactor. Implementation tasks that skip this fail review.
4. **Three invariants.** Determinism, evidence, audit. No feature is exempt.
5. **No phase-skipping.** If you find yourself wanting to "just add" a phase-6 feature in phase-2, write it to `docs/parking-lot.md` and return.
6. **No silent destructive actions.** `git reset --hard`, `--no-verify`, force-push, `drop table`, `alembic downgrade base`, `docker compose down -v` are forbidden unless the user explicitly authorizes that exact command this turn.
7. **No dependency rot.** New packages require a one-line justification in the commit message.
8. **No `any` / `# type: ignore` in new code.**
9. **No process.env in components.** Settings flow through `app.config` (backend) or via server-rendered context (frontend).
10. **No fabricated progress.** "I will add tests later" is forbidden. Tests are part of done.

---

## Output style this turn

Be terse. Each turn:
- One line announcing the phase and workstream.
- Skill invocations announced inline (`Using {skill}`).
- Progress reported in 1-line increments (`backend models added · migration ok · service tests 4/4 green`).
- A single closing block summarising what shipped, with the next workstream queued.

Do not narrate your thinking. Do not write planning documents that aren't requested. Do not over-explain. Just work.

---

## Begin

If `$ARGUMENTS` is empty, this is a fresh invocation: do Steps 0–7 in order.

If `$ARGUMENTS` contains `phase=` or `workstream=` or `resume`, jump to Step 1 and proceed accordingly.

Go.
