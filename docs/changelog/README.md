# Phase Changelogs

When a phase passes its gate (see `docs/FEATURE_ROADMAP.md`), write a one-page summary to this folder named `phase-N.md` (or `phase-N-A.md` for individual workstreams that warrant their own entry).

## Template

```markdown
# Phase N — <name>

**Completed:** YYYY-MM-DD

## What shipped
- Bullet per workstream with the user-visible outcome.

## Changes to docs
- File path + one-line description.

## Tests
- Backend: N passing / 0 failing
- Frontend: tsc clean / N Playwright cases passing

## Commits
- abc1234 — message
- def5678 — message

## Gate evidence
- Quote the relevant gate from FEATURE_ROADMAP.md.
- Quote the verification command output that proves the gate was met.

## Carried forward
- Anything intentionally deferred. Add to `docs/parking-lot.md`.

## Notes for next phase
- One paragraph: what to keep in mind, what surprised us, what we'd do differently.
```

The `/execute-v2` slash command writes these automatically. If you complete phase work by hand, write one yourself before moving on.
