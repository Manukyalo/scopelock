# scopelock

**Anti-hallucination scope locking for AI coding agents.**

`scopelock` solves a specific, well-documented problem: AI coding agents frequently exhibit scope creep — modifying files outside the intended change — and lack persistent project memory across sessions.

```
npm install -g scopelock
```

---

## The Problem

You ask an AI agent to fix the login button. It also refactors your auth middleware, updates 3 unrelated components, and breaks a working API route. You have no pre-commit guardrail that would have stopped it.

`scopelock` fixes this.

---

## Commands

### `scopelock init`
Scan the repo and generate `.scopelock.json` — a structured manifest of every source file. All files start as `unscoped`. Mark critical files as `locked` to protect them.

```bash
scopelock init
```

### `scopelock context <task>`
Output a condensed, token-efficient context block to paste into any AI agent. Locked files are explicitly flagged with `DO NOT MODIFY`.

```bash
scopelock context "Fix the broken checkout flow"
```

### `scopelock check`
Run a `git diff` against HEAD, cross-reference changed files against the manifest, and exit non-zero if any `locked` file was touched. Wire this into a pre-commit hook.

```bash
scopelock check
```

### `scopelock unlock <file> <reason>`
Explicitly mark a file as in-scope for the current task. The reason is logged to `.scopelock.json` for auditability.

```bash
scopelock unlock src/auth/middleware.ts "Need to fix JWT refresh logic"
```

---

## Pre-commit Hook Setup

```bash
echo '#!/bin/sh\nscopelock check' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

---

## File Statuses

| Status | Meaning |
|--------|---------|
| `unscoped` | Not yet classified |
| `locked` | Tested and stable — do not touch unless explicitly unlocked |
| `active` | Currently in scope for this task |

---

## Zero Dependencies

Built entirely on Node.js built-ins (`fs`, `path`, `child_process`). No npm install required at runtime.

---

## License

MIT
