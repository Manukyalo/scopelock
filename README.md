# scopelock

**Anti-hallucination scope locking for AI coding agents.**

```bash
npm install -g @manukyalo/scopelock
```

`scopelock` solves a specific, well-documented problem: AI coding agents frequently exhibit scope creep — modifying files outside the intended change — and lack persistent project memory across sessions.

`scopelock` acts as a physical guardrail (via a pre-commit hook) and an architectural memory bank (via the context block) to keep agents strictly confined to their authorized scope.

## Features

- **File-level locks**: Run `scopelock lock src/auth.ts` to make the file read-only for agents.
- **Function-level locks**: Don't want to lock the whole file? Lock specific AST functions so agents can only edit adjacent code.
- **Dependency Lockdown**: Zero-trust dependency management. Automatically locks `package.json` and other dependency manifests on init to prevent silent dependency drift.
- **Secret Sentinel**: A hard-blocking pre-commit scanner that physically prevents agents from committing AWS keys, Stripe tokens, or `.env` leaks.
- **Zero dependencies**: Written in pure Node.js. Install it anywhere without bloating your `node_modules`.

---

## Commands

```bash
  scopelock init                           Scan repo and generate .scopelock.json
  scopelock lock <file>[:<func>] [reason]  Lock a file or a specific function
  scopelock unlock <file>[:<func>] <reason> Unlock (reason is mandatory)
  scopelock allow-secret <file> <reason>   Bypass Secret Sentinel for a specific file
  scopelock context [task]                 Generate AI context block for a task
  scopelock check                          Check git diff for scope violations and secret leaks
  scopelock status                         Show manifest summary
```

### `scopelock init`
Scan the repo and generate `.scopelock.json`. Automatically ignores `node_modules`, `.git`, `.next`, `dist`, `build`, `out`, `coverage`, and other build artifacts.

### `scopelock lock <file>[:<function>] [reason]`
Lock a whole file or a specific named function.

```bash
# Lock a whole file
scopelock lock src/lib/supabase.ts "production client — stable"

# Lock a specific function (validates it exists before locking)
scopelock lock src/auth/token.ts:validateToken "tested — do not touch"
```

### `scopelock unlock <file>[:<function>] <reason>`
Unlock a file or function. Reason is mandatory and logged.

```bash
scopelock unlock src/auth/token.ts:validateToken "fixing JWT expiry edge case"
```

### `scopelock allow-secret <file> <reason>`
Bypass the Secret Sentinel hard-block for a specific file (e.g., when intentionally committing a mock test key).

```bash
scopelock allow-secret test/run.js "this is a mock stripe key for testing"
```

### `scopelock check`
Two-tier scope violation check against `git diff HEAD`. Exits non-zero on violations or secret leaks. Wire this up as a `pre-commit` hook.

```bash
scopelock check
```

### `scopelock context [task]`
Output a token-efficient AI context block with all locks clearly flagged.

```bash
scopelock context "Update the login page"
```
```
[SCOPE CONTEXT]
Task: Update the login page

Status:
  🔒 locked   — 1 file(s)
  ✏️ active   — 0 file(s)
  ⬜ unscoped — 14 file(s)

Locked files:
  src/lib/supabase.ts
```

## Agent Skill

`scopelock` includes a native Agent Skill. 
If you use an agent framework (like Antigravity or Cline) that supports Markdown skills, point it to `skills/scope-enforcement/SKILL.md` to automatically teach the agent how to use `scopelock` safely.

## Data Model
All state is stored in `.scopelock.json` at the root of your repo.

The manifest is project state, not a personal config. Commit it so your whole team — and all their AI agents — share the same scope boundaries.
