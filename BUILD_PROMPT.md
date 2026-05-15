# FoundersHQ — Autonomous Build Prompt

> Paste this prompt into a fresh Claude Code session at the repo root. It will drive the build end-to-end. Follow the operating rules verbatim.

---

## Your mission

You are building **FoundersHQ** — a deterministic financial operating system for early-stage startups. An MVP exists in this repo: FastAPI + Next.js + Postgres + Celery, with the core idea that every number is reproducible from raw rows and every AI claim cites the underlying transaction/invoice UUIDs.

Your job is to take this MVP from "working primitives" to "a polished, professional product that founders trust with their cash". You will work autonomously, in phases, until the product clears the gates in `docs/FEATURE_ROADMAP.md`.

You have superpowers (skills). **Use them.** Do not invent your own process when a skill already prescribes one.

---

## Read these first, in this order

1. `CLAUDE.md` — invariants and command cheatsheet.
2. `docs/PRODUCT_SPEC.md` — what we're building and why.
3. `docs/ARCHITECTURE.md` — where new modules go.
4. `docs/DESIGN_SYSTEM.md` — the visual and interaction language.
5. `docs/FEATURE_ROADMAP.md` — the phased build plan.
6. `.claude/skills/foundershq-conventions/SKILL.md` — load via the `Skill` tool: `foundershq-conventions`.
7. `.claude/skills/deterministic-finance/SKILL.md` — load when touching metrics.
8. `.claude/skills/evidence-linked-llm/SKILL.md` — load when touching LLM features.

After reading, summarise back to the user, in under 200 words, what you understood the mission to be. Then begin Phase 0.

---

## Operating rules

### Skills are mandatory, not optional

Load these via the `Skill` tool at the moments described, every time:

- `foundershq-conventions` — at the start of every work session and before any non-trivial file.
- `superpowers:brainstorming` — before designing any feature in Tier 1, 2, or 3. Do not skip even if "the design seems obvious".
- `superpowers:writing-plans` — once a design is agreed and before writing code.
- `superpowers:test-driven-development` — every implementation task: write failing test → make pass → refactor.
- `superpowers:executing-plans` — when working through any written plan with checkpoints.
- `superpowers:dispatching-parallel-agents` — when a phase has independent workstreams. Most do.
- `superpowers:subagent-driven-development` — when dispatching multi-task implementation.
- `superpowers:verification-before-completion` — **before claiming any workstream done.** Run the verification commands and quote their output.
- `superpowers:systematic-debugging` — any test failure or unexpected behaviour.
- `superpowers:requesting-code-review` — before merging anything Tier-2 or larger.
- `frontend-design:frontend-design` — building new UI surfaces; pair with `docs/DESIGN_SYSTEM.md`.
- Domain-specific Vercel skills (`vercel:nextjs`, `vercel:ai-sdk`, `vercel:shadcn`, `vercel:next-cache-components`, `vercel:vercel-storage`, `vercel:workflow`) — when working in those areas.

When you complete a turn without using a relevant skill, you have made a mistake. Correct it on the next turn.

### Subagent strategy

Within each phase, identify workstreams that share no state and dispatch them in parallel using the `Agent` tool with one subagent per workstream. Use:

- `Explore` for read-only research across the repo (cheaper, faster).
- `Plan` for design plans that need to consider trade-offs.
- `general-purpose` (or specialist Vercel agents) for implementation.

Always brief subagents with: the workstream goal, the relevant files, the relevant docs and skill names to load, the success criteria, and the deliverable. Never ask a subagent to "do the rest" — give them a bounded task with a definition of done.

### Phase discipline

`docs/FEATURE_ROADMAP.md` defines five phases (0 through 5). **Do not start phase N+1 until phase N passes its gate.** When a phase gate is met, write a one-page summary of what shipped, what changed in the docs, and what's queued for the next phase. Commit it to `docs/changelog/phase-N.md`.

### Quality gates per phase (non-negotiable)

A workstream is complete only when:

1. Tests are written first and currently pass (`pytest -x`, `pnpm test` if added).
2. `make verify` (backend) and `pnpm verify` (frontend) pass. (Phase 0 creates these scripts.)
3. Every mutation route writes an audit log entry.
4. Every LLM call routes through `validate_llm_response`.
5. The user-visible surface has loading, empty, and error states.
6. A Playwright test covers the happy path (`mcp__plugin_playwright_playwright__*` tools).
7. The changes were exercised in a running app (start the dev server; click the feature; observe the data).
8. `superpowers:verification-before-completion` was loaded and its checklist quoted.

If any of these fail, the workstream is not done. Loop.

### When to ask, when to proceed

The user has asked you to work without stopping. Make the reasonable call and continue. Only ask if:

- A choice is genuinely irreversible (deleting tables, force-pushing, sending external messages).
- A required external resource is missing (an API key, an OAuth app, a Plaid client_id).
- The work would visibly diverge from `docs/PRODUCT_SPEC.md` in a way that changes scope.

For everything else, decide. Document the decision in a one-liner in the commit message.

### What you may not do

- Skip the LLM guardrails. Ever.
- Compute a metric in the frontend.
- Use `float` for money on the server.
- Mock the database in tests for the deterministic engine. Hit a real or test-scoped DB.
- Force-push, `git reset --hard`, `--no-verify`, `# type: ignore`, `any`.
- Add features outside the current phase's scope. Note them in `docs/parking-lot.md`.

---

## Phase 0 first task: housekeeping & permissions

Before any feature work, do this:

1. Create `.claude/settings.local.json` with the contents at the bottom of this file. (The user must approve this manually — present them with the file contents to copy in, or have them run a snippet of your choosing. Do not attempt to write that file yourself; permission self-modification is blocked.)

2. Run `git status` and review what's currently dirty. Untrack `.DS_Store` files and extend `.gitignore` to exclude them.

3. In `frontend/next.config.mjs`, turn `typescript.ignoreBuildErrors` to `false`. Run `pnpm exec tsc --noEmit` and fix everything it reports.

4. Create the verification scripts:
   - `backend/Makefile` with a `verify` target running `ruff check . && mypy app && pytest`.
   - `frontend/package.json`: add `"verify": "tsc --noEmit && eslint ."` to `scripts`.

5. Wire CI:
   - `.github/workflows/backend.yml` — runs `make verify` on PRs.
   - `.github/workflows/frontend.yml` — runs `pnpm verify` on PRs.

6. Install dev tools:
   - Backend: add `ruff`, `mypy`, `types-python-dateutil` to `[project.optional-dependencies] dev` in `pyproject.toml`. `ruff` config in `pyproject.toml` with sensible defaults (line length 100, target Python 3.11).
   - Frontend: add `@tanstack/react-table` (needed for `DataTable` in design system), `swr` is already there. No other dependency churn in this step.

7. Commit each of the above as a separate logical commit with a clear message.

When this is done, the gate is: CI green on a fresh PR; both `verify` scripts pass; no DS_Store in git; `next build` no longer needs `ignoreBuildErrors`.

Then continue to phase 0's remaining workstreams in `docs/FEATURE_ROADMAP.md` (0.B, 0.C, 0.D), dispatched as parallel subagents where independent.

---

## After phase 0

Work the phases in order. For each:

1. Re-read the corresponding section of `docs/FEATURE_ROADMAP.md`.
2. Identify workstreams. Decide which are independent.
3. For each non-trivial workstream, run `superpowers:brainstorming` with the user (concise; default to the spec when no user input arrives), then `superpowers:writing-plans`, then dispatch.
4. After dispatch, integrate, verify, commit, and write `docs/changelog/phase-N.md`.
5. Confirm the gate is met. Then proceed.

---

## Tone

You are working autonomously but communicating with a senior engineer. Be terse. Output progress lines like:

```
phase 1.B — building onboarding wizard … wizard.tsx 1/4 complete; tests passing; next: persistence
```

End each phase with a one-paragraph summary, the list of merged commits, and the gate-pass evidence.

Do not narrate your thinking. Do not write planning documents that aren't requested. Do not preface every action with "I will now…". Just do the work and report movement.

---

## Required `.claude/settings.local.json`

The autonomous build needs broader permissions than the default. Ask the user to put the following into `.claude/settings.local.json` (you cannot write this file yourself — Claude Code blocks self-modification of permission config):

```json
{
  "permissions": {
    "allow": [
      "Bash(git status)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git show:*)",
      "Bash(git branch:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git checkout:*)",
      "Bash(git switch:*)",
      "Bash(git stash:*)",
      "Bash(git rebase:*)",
      "Bash(git merge --no-ff:*)",

      "Bash(ls:*)",
      "Bash(find:*)",
      "Bash(rg:*)",
      "Bash(grep:*)",
      "Bash(wc:*)",

      "Bash(pnpm:*)",
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Bash(node:*)",
      "Bash(tsc:*)",

      "Bash(python:*)",
      "Bash(python3:*)",
      "Bash(pip:*)",
      "Bash(uv:*)",
      "Bash(pytest:*)",
      "Bash(ruff:*)",
      "Bash(mypy:*)",
      "Bash(alembic:*)",
      "Bash(uvicorn:*)",
      "Bash(celery:*)",

      "Bash(make:*)",

      "Bash(docker compose ps)",
      "Bash(docker compose up -d:*)",
      "Bash(docker compose logs:*)",
      "Bash(docker compose exec:*)",

      "Bash(gh pr list:*)",
      "Bash(gh pr view:*)",
      "Bash(gh pr checks:*)",
      "Bash(gh run list:*)",
      "Bash(gh run view:*)"
    ],
    "deny": [
      "Bash(docker compose down -v:*)",
      "Bash(rm -rf:*)",
      "Bash(git push --force:*)",
      "Bash(git push -f:*)",
      "Bash(git reset --hard:*)",
      "Bash(git clean -fd:*)",
      "Bash(git branch -D:*)",
      "Bash(alembic downgrade base:*)",
      "Bash(pnpm publish:*)",
      "Bash(npm publish:*)"
    ]
  }
}
```

This authorises the routine actions (tests, builds, migrations, branch commits) and explicitly denies the destructive ones (force-push, reset --hard, dropping volumes, publishing packages).

---

## Begin

When you're ready, respond with:

1. A 200-word summary of the mission.
2. A list of any blockers (missing keys, missing approvals).
3. The first concrete action you will take (typically: read the docs and confirm the current branch is clean).

Then start phase 0.
