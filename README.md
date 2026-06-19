# scopelock

**Anti-hallucination scope locking for AI coding agents.**

```bash
npm install -g @manukyalo/scopelock
```

`scopelock` solves a specific, well-documented problem: AI coding agents frequently exhibit scope creep — modifying files outside the intended change — and lack persistent project memory across sessions.

---

## Companion Skill

`skills/scope-enforcement/SKILL.md` is a structured 3-checkpoint workflow for AI agents that enforces scopelock boundaries across every phase of a session. Load it into: **Antigravity**, **Claude Code**, **Gemini CLI**, **Cursor**, **Kiro**.

---

## The Problem

You ask an AI agent to fix the login button. It also refactors your auth middleware, updates 3 unrelated components, and breaks a working API route. You had no pre-commit guardrail to stop it.

`scopelock` enforces scope at two levels:

| Protection | What it stops |
|------------|--------------|
| **File-level** | Agent modifies any file marked `locked` |
| **Function-level** | Agent modifies lines inside a locked function body, even if the surrounding file is `active` |

---

## Commands

### `scopelock init`
Scan the repo and generate `.scopelock.json`. Automatically ignores `node_modules`, `.git`, `.next`, `dist`, `build`, `out`, `coverage`, and other build artifacts.

```bash
scopelock init
```

### `scopelock status`
Print a human-readable summary of the manifest.

```bash
scopelock status

# 📋  scopelock status
#
#   🔒  locked    — 3 file(s), 2 function(s)
#   ✏️   active    — 1 file(s)
#   ⬜  unscoped  — 98 file(s)
#
# Locked files:
#   src/lib/supabase.ts
#   src/middleware.ts
#     └── middleware() [locked]
```

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

### `scopelock check`
Two-tier scope violation check against `git diff HEAD`. Exits non-zero on violations.

```bash
scopelock check
```

### `scopelock context [task]`
Output a token-efficient AI context block with all locks clearly flagged.

```bash
scopelock context "Fix the broken checkout flow" | clip
```

---

## Pre-commit Hook

```bash
echo '#!/bin/sh
scopelock check' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

Once wired, no agent or developer can commit a scope violation.

---

## File Statuses

| Status | Meaning |
|--------|---------|
| `unscoped` | Not yet classified |
| `locked` | Stable — do not modify without an explicit `scopelock unlock` |
| `active` | In scope for the current task |

---

## Language Support for Function-level Locking

| Language | Extensions |
|----------|-----------|
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` |
| TypeScript | `.ts`, `.tsx` |
| Python | `.py` |

All other file types fall back to file-level locking automatically.

---

## Commit `.scopelock.json`

The manifest is project state, not a personal config. Commit it so your whole team — and all their AI agents — share the same scope boundaries.

---

## Zero Dependencies

Built entirely on Node.js built-ins (`fs`, `path`, `child_process`). No runtime dependencies.

---

## License

MIT
