# Phase 0.A — Repo Housekeeping & Verify Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Establish `make verify` (backend) and `pnpm verify` (frontend) as the single quality gate; untrack OS detritus; install the dev tooling phases 0.B-0.D and beyond will rely on.

**Architecture:** Repo-level plumbing only. No app code. CI workflows are already drafted in `.github/workflows/` (committed in the foundation commit). This workstream wires the local verify scripts and dependencies those workflows invoke.

**Tech Stack:** ruff, mypy, pytest (backend); tsc, eslint, @tanstack/react-table (frontend).

**Dependencies:**
- Blocks 0.A2 (typecheck cleanup), which depends on this PLUS 0.C and 0.D completing.
- Does NOT block 0.B, 0.C, 0.D — they may proceed in parallel.

---

## File Structure

| Path | Action | Purpose |
|---|---|---|
| `backend/Makefile` | create | `make verify` runs ruff + mypy + pytest |
| `backend/pyproject.toml` | modify | add ruff/mypy config + `dev` extras |
| `frontend/package.json` | modify | add `verify` script + `@tanstack/react-table` dep |
| `.DS_Store`, `backend/.DS_Store`, `frontend/.DS_Store` | `git rm --cached` | untrack OS artifacts |

---

## Task 1 — Untrack DS_Store files

**Files:** `.DS_Store`, `backend/.DS_Store`, `frontend/.DS_Store`

- [ ] **Step 1: Confirm `.gitignore` already ignores `.DS_Store`**

Run: `grep -n '\.DS_Store' .gitignore`
Expected: at least one matching line (it's at the top of the OS section).

- [ ] **Step 2: Remove from git index**

```bash
git rm --cached .DS_Store backend/.DS_Store 2>/dev/null || true
# frontend/.DS_Store was deleted on disk; stage the deletion:
git add -A -- frontend/.DS_Store 2>/dev/null || true
```

- [ ] **Step 3: Verify clean**

Run: `git status --short | grep -E '\.DS_Store' || echo OK`
Expected: `OK` or only `D` entries pending commit.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(phase-0.A): untrack .DS_Store files"
```

---

## Task 2 — Backend Makefile + ruff/mypy config

**Files:**
- Create: `backend/Makefile`
- Modify: `backend/pyproject.toml`

- [ ] **Step 1: Append ruff + mypy + dev deps to `backend/pyproject.toml`**

After the existing `[tool.pytest.ini_options]` block, append:

```toml
[tool.ruff]
line-length = 100
target-version = "py311"
extend-exclude = ["alembic/versions"]

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP", "ASYNC", "S", "RET", "SIM"]
ignore = ["E501", "S101", "B008"]

[tool.ruff.lint.per-file-ignores]
"tests/*" = ["S", "ASYNC"]

[tool.mypy]
python_version = "3.11"
strict_optional = true
warn_unused_ignores = true
warn_redundant_casts = true
disallow_untyped_defs = false  # gradual; tighten in later phases
ignore_missing_imports = true
plugins = []
exclude = ["alembic/versions"]
```

Update `[project.optional-dependencies] dev` to:

```toml
dev = [
    "pytest>=7.4.0",
    "pytest-asyncio>=0.23.0",
    "pytest-cov>=4.1.0",
    "ruff>=0.6.0",
    "mypy>=1.10.0",
    "types-python-dateutil>=2.9.0",
]
```

- [ ] **Step 2: Create `backend/Makefile`**

```makefile
.PHONY: verify lint typecheck test install

install:
	pip install -e ".[dev]"

lint:
	ruff check .

typecheck:
	mypy app

test:
	pytest -x --tb=short

verify: lint typecheck test
```

- [ ] **Step 3: Install dev deps locally**

Run (from `backend/`): `pip install -e ".[dev]"`
Expected: ruff, mypy, pytest installed.

- [ ] **Step 4: Run `make verify`**

Run (from `backend/`): `make verify`
Expected outcome: any of lint/typecheck/test may fail today on existing code. **Record the failures and fix only the lint failures in this task** (ruff `--fix` for safe ones). Type errors and test failures stay deferred to their owning workstream; record them in the commit message.

- [ ] **Step 5: Commit**

```bash
git add backend/Makefile backend/pyproject.toml
git commit -m "feat(phase-0.A): backend make verify (ruff + mypy + pytest)"
```

---

## Task 3 — Frontend `pnpm verify` + `@tanstack/react-table`

**Files:** `frontend/package.json`

- [ ] **Step 1: Add `verify` script + react-table dep**

Modify `frontend/package.json`:
- In `scripts`, add: `"verify": "tsc --noEmit && eslint ."`
- In `dependencies`, add: `"@tanstack/react-table": "^8.20.5"`

- [ ] **Step 2: Install**

Run (from `frontend/`): `pnpm install`
Expected: lockfile updated; `@tanstack/react-table` resolved.

- [ ] **Step 3: Run `pnpm verify` (expect failures — record them)**

Run (from `frontend/`): `pnpm verify`
Expected: tsc will report errors (notably `mapInvoice` not imported in [lib/api/hooks.ts:213](frontend/lib/api/hooks.ts:213)) because `next.config.mjs` hides them today.
**Do not fix tsc errors in this task** — they belong to 0.A2 after 0.C/0.D land. Record the count in the commit message body.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml
git commit -m "feat(phase-0.A): frontend pnpm verify + @tanstack/react-table"
```

---

## Success criteria

- `backend/Makefile` exists with a `verify` target.
- `pnpm verify` script exists in `frontend/package.json`.
- `@tanstack/react-table` is in `frontend/package.json` and in the lockfile.
- `.DS_Store` files are no longer tracked by git.
- `ruff check .` is at least configured (may have findings to fix).

## Out of scope (handled by 0.A2 later)

- Turning `typescript.ignoreBuildErrors` off.
- Fixing the tsc errors that surface afterwards.
- Fixing any mypy errors found in existing code.

## Verification

- [ ] `git status` shows no untracked `.DS_Store`.
- [ ] `cd backend && make verify` runs (pass-or-fail recorded).
- [ ] `cd frontend && pnpm verify` runs (pass-or-fail recorded).
- [ ] All three commits land on `main` (or the phase branch).
