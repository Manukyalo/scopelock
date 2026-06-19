# scopelock v3.0

**Anti-hallucination scope locking for AI coding agents.**

```bash
npm install -g @manukyalo/scopelock
```

`scopelock` solves a specific, well-documented problem: AI coding agents frequently exhibit scope creep — modifying files outside the intended change — and lack persistent project memory across sessions.

`scopelock` acts as a physical guardrail (via a pre-commit hook) and an architectural memory bank (via the context block) to keep agents strictly confined to their authorized scope.

## Features

- **File & Function Locks**: Run `scopelock lock src/auth.ts` or `scopelock lock src/auth.ts:validateToken` to make code read-only for agents.
- **Production Path Locks (Seal)**: Use `scopelock seal` for critical paths like billing. Agents cannot override this; it requires explicit human sign-off via `scopelock unseal --human-approved=<ticket>`.
- **Blast Radius Map**: Prevent scope creep *before* it happens. Run `scopelock impact <file>` to see every file that imports a target file before you touch it.
- **Dependency Lockdown**: Zero-trust dependency management. Automatically locks `package.json` on init to prevent silent dependency drift.
- **Secret Sentinel**: A hard-blocking pre-commit scanner that physically prevents agents from committing AWS keys, Stripe tokens, or `.env` leaks.
- **Test Coverage Gate**: Run `scopelock guard --tests` to block any source code changes that aren't accompanied by tests.
- **Rollback Snapshots**: Run `scopelock save` before an agent starts working, and `scopelock restore` to obliterate any rogue changes instantly.

---

## Commands

### 🛡️ Guardrails & Locks
| Command | Description |
| :--- | :--- |
| `scopelock lock <file>[:<func>] [reason]` | Lock a file or a specific AST function |
| `scopelock unlock <file>[:<func>] <reason>` | Unlock (reason is mandatory) |
| `scopelock seal <file> <reason>` | Permanent production-path lock (cannot be unlocked normally) |
| `scopelock unseal <file> --human-approved=<ticket> <reason>` | Release a seal with a Jira/PR ticket |
| `scopelock guard [--tests]` | Wire as `pre-commit` to check diffs for violations & leaked secrets |
| `scopelock trust <file> <reason>` | Explicitly bypass Secret Sentinel for a mock/test file |

### 🛠️ Agent Tools (Godmode)
| Command | Description |
| :--- | :--- |
| `scopelock impact <file>` | Show the Blast Radius (all files importing this file) before modifying it |
| `scopelock save` | Auto-snapshot repo state into a hidden git stash before an agent session |
| `scopelock restore` | Instant escape hatch: obliterate agent changes and restore the snapshot |
| `scopelock context [task]` | Generate a token-efficient AI context block mapping the locked boundaries |

### ⚙️ Core
| Command | Description |
| :--- | :--- |
| `scopelock init` | Scan repo and generate `.scopelock.json` manifest |
| `scopelock status` | Show a summary of all locked/sealed files |

### `scopelock lock` & `unlock`
Lock a whole file or a specific named function. Unlock requires a reason that gets logged to history.

```bash
scopelock lock src/lib/supabase.ts "production client — stable"
scopelock lock src/auth/token.ts:validateToken "tested — do not touch"
scopelock unlock src/auth/token.ts:validateToken "fixing JWT expiry edge case"
```

### `scopelock seal` & `unseal`
For files that should *never* be touched without human oversight (e.g., `/billing`, `/migrations`). Seals cannot be removed by `unlock`.

```bash
scopelock seal src/billing/stripe.ts "core billing logic"
scopelock unseal src/billing/stripe.ts --human-approved=PR-123 "updating webhook"
```

### `scopelock impact`
Before making a change, see the blast radius. Outputs a list of all files in the repository that import the target file.

```bash
scopelock impact src/utils/auth.ts
```

### `scopelock guard`
Two-tier scope violation check against `git diff HEAD`. Exits non-zero on violations or secret leaks. Wire this up as a `pre-commit` hook. Add `--tests` to strictly enforce test coverage for any changed logic.

```bash
scopelock guard
scopelock guard --tests
```

### `scopelock save` & `restore`
Never fear an agent hallucination destroying your workspace again. `save` stores a snapshot in git stash that survives hard resets. `restore` obliterates the working directory and cleanly reverts to the snapshot.

```bash
scopelock save
scopelock restore
```

### `scopelock trust`
Bypass the Secret Sentinel hard-block for a specific file (e.g., when intentionally committing a mock test key).

```bash
scopelock trust test/run.js "this is a mock stripe key for testing"
```

### `scopelock context`
Output a token-efficient AI context block with all locks clearly flagged for the agent's system prompt.

```bash
scopelock context "Update the login page"
```

## Agent Skills (Godmode)

`scopelock` ships with 7 native AI Agent Skills located in the `skills/` folder. 
If you use an agent framework (like Antigravity or Cline) that supports Markdown skills, point it to these folders to automatically teach the agent how to use `scopelock` safely.

The skills map directly to features:
- `scope-enforcement`
- `dependency-lockdown`
- `secret-sentinel`
- `test-coverage-gate`
- `rollback-snapshot`
- `blast-radius`
- `production-path-lock`

## Data Model
All state is stored in `.scopelock.json` at the root of your repo.
The manifest is project state, not a personal config. Commit it so your whole team — and all their AI agents — share the same scope boundaries.
