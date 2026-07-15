<div align="center">
  <img src="assets/logo.png" width="200" alt="driftlock logo" />
  <h1>driftlock v3.1</h1>
  <p><strong>AI agent scope enforcement for production codebases.</strong></p>
</div>

```bash
npm install -g driftlock
```

`driftlock` solves a specific, well-documented problem: AI coding agents frequently exhibit scope creep — modifying files outside the intended change — and lack persistent project memory across sessions.

`driftlock` acts as a physical guardrail (via a pre-commit hook) and an architectural memory bank (via the context block) to keep agents strictly confined to their authorized scope.

## Features

- **File & Function Locks**: Run `driftlock lock src/auth.ts` or `driftlock lock src/auth.ts:validateToken` to make code read-only for agents.
- **Production Path Locks (Seal)**: Use `driftlock seal` for critical paths like billing. Agents cannot override this; it requires explicit human sign-off via `driftlock unseal --human-approved=<ticket>`.
- **Blast Radius Map**: Prevent scope creep *before* it happens. Run `driftlock impact <file>` to see every file that imports a target file before you touch it.
- **Dependency Lockdown**: Zero-trust dependency management. Automatically locks `package.json` on init to prevent silent dependency drift.
- **Secret Sentinel**: A hard-blocking pre-commit scanner that physically prevents agents from committing AWS keys, Stripe tokens, or `.env` leaks.
- **Test Coverage Gate**: Run `driftlock guard --tests` to block any source code changes that aren't accompanied by tests.
- **Rollback Snapshots**: Run `driftlock save` before an agent starts working, and `driftlock restore` to obliterate any rogue changes instantly.

---

## Commands & Tiers

Driftlock commands are gated by license tier (Free, Pro, Team).

### 🟢 Free Tier (No license required)
- `driftlock lock <file>[:<func>] [reason]` — Lock a file or function
- `driftlock unlock <file>[:<func>] <reason>` — Unlock a target

### 🟡 Pro Tier (Requires Pro License)
- `driftlock init` — Scan repo, generate `.driftlock.json`
- `driftlock seal <file> <reason>` — Permanent lock for production paths
- `driftlock trust <file> <reason>` — Bypass Secret Sentinel for a specific file
- `driftlock status` — Print manifest summary
- `driftlock save` — Auto-snapshot repo state before an agent session
- `driftlock restore` — Rollback to the last snapshot
- `driftlock impact <file>` — Show all files that import this file
- `driftlock context [task]` — Generate AI context block for a task
- `driftlock guard [--tests]` — Check git diff for violations and secret leaks
- `driftlock scout / audit / godmode` — Advanced AI features (early access)

### 🔵 Team Tier (Requires Team License)
- `driftlock unseal <file> --human-approved=<ticket> <reason>` — Release a sealed path

---

## License Activation

Get your license here: [Driftlock Gumroad](https://kyalovibes.gumroad.com/l/lzozc)

```bash
# Activate your license
driftlock login <license-key>

# Check your tier and status
driftlock whoami

# Clear local license cache
driftlock logout
```

---

### `driftlock lock` & `unlock` [FREE]
Lock a whole file or a specific named function. Unlock requires a reason that gets logged to history.

```bash
driftlock lock src/lib/supabase.ts "production client — stable"
driftlock lock src/auth/token.ts:validateToken "tested — do not touch"
driftlock unlock src/auth/token.ts:validateToken "fixing JWT expiry edge case"
```

### `driftlock seal` [FREE] & `unseal` [TEAM]
For files that should *never* be touched without human oversight (e.g., `/billing`, `/migrations`). Seals cannot be removed by `unlock`.

```bash
driftlock seal src/billing/stripe.ts "core billing logic"
driftlock unseal src/billing/stripe.ts --human-approved=PR-123 "updating webhook"
```

### `driftlock impact` [PRO]
Before making a change, see the blast radius. Outputs a list of all files in the repository that import the target file.

```bash
driftlock impact src/utils/auth.ts
```

### `driftlock guard` [PRO]
Two-tier scope violation check against `git diff HEAD`. Exits non-zero on violations or secret leaks. Wire this up as a `pre-commit` hook. Add `--tests` to strictly enforce test coverage for any changed logic.

```bash
driftlock guard
driftlock guard --tests
```

### `driftlock save` & `restore` [PRO]
Never fear an agent hallucination destroying your workspace again. `save` stores a snapshot in git stash that survives hard resets. `restore` obliterates the working directory and cleanly reverts to the snapshot.

```bash
driftlock save
driftlock restore
```

### `driftlock trust` [FREE]
Bypass the Secret Sentinel hard-block for a specific file (e.g., when intentionally committing a mock test key).

```bash
driftlock trust test/run.js "this is a mock stripe key for testing"
```

### `driftlock context` [PRO]
Output a token-efficient AI context block with all locks clearly flagged for the agent's system prompt.

```bash
driftlock context "Update the login page"
```

## Agent Skills

`driftlock` ships with 7 native AI Agent Skills located in the `skills/` folder.
If you use an agent framework (like Antigravity or Cline) that supports Markdown skills, point it to these folders to automatically teach the agent how to use `driftlock` safely.

The skills map directly to features:
- `scope-enforcement`
- `dependency-lockdown`
- `secret-sentinel`
- `test-coverage-gate`
- `rollback-snapshot`
- `blast-radius`
- `production-path-lock`

## Data Model
All state is stored in `.driftlock.json` at the root of your repo.
The manifest is project state, not a personal config. Commit it so your whole team — and all their AI agents — share the same scope boundaries.
