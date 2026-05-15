# Parking Lot

Ideas that surfaced during development but are out of current scope. Don't delete; revisit when planning future phases.

Format: one bullet per idea. Use `[YYYY-MM-DD]` prefix.

---

- [2026-05-15] Adopt `next/core-web-vitals` ESLint preset once `eslint-config-next` supports flat-config on ESLint 10. Phase-0 ships a minimal flat config that lints syntax/scope only.
- [2026-05-15] Add `suppressHydrationWarning` to `<html>` in `app/layout.tsx`. The dark-mode `color-scheme` style differs SSR vs client and produces a cosmetic console error. Belongs in phase 1.D polish.
- [2026-05-15] Trim `@radix-ui/react-{menubar,aspect-ratio,accordion}` from `frontend/package.json`. 0.D deleted the consuming shadcn `.tsx` files but left the deps. Verify nothing transitively imports them, then remove.
- [2026-05-15] `s_fund` in `app/services/dashboard/health_score.py` is a documented placeholder capped at 80; a maxed health score is therefore 99. Replace with real funding signal in phase 3.B (Vendor / Funding Intel).
- [2026-05-15] CI matrix: add a job that brings up `postgres:15-alpine` and runs `make test-integration` so `tests/test_api_contracts.py` is exercised on every PR. Currently the existing `backend.yml` workflow runs `pytest -x` with the marker filter inherited from `Makefile`, which would skip integration. Decide whether CI should also gate on integration tests.
- [2026-05-15] Backfill `noqa` audit for the per-file ruff ignores added during 0.A (`app/services/events/sse.py: ASYNC109`, `app/models/*: F821`). Each should be inline noqa with a tight justification once SQLAlchemy 2 forward-ref types are widely understood.
