---
name: scope-enforcement
description: "Prevents AI agent scope creep by enforcing scopelock boundaries before, during, and after every coding task. Supports file-level and function-level locking. Use before writing any code, before every commit, and before any review or ship phase. Requires scopelock CLI (npm install -g scopelock)."
---

## Overview

AI coding agents default to the shortest path to a passing result — which frequently means modifying files, functions, and logic far outside the declared task. `scope-enforcement` is the guardrail that stops this before it reaches a commit.

This skill uses `scopelock` — a zero-dependency Node.js CLI — to enforce two tiers of scope protection:

- **File-level:** An entire file is locked. No agent may touch it.
- **Function-level:** A specific function within a file is locked. The file may be edited, but that function's body is off-limits. `scopelock check` detects if any changed line falls inside the locked function's boundaries.

The skill operates at three checkpoints: **Session Start**, **Pre-Commit**, and **Post-Task Review**.

---

## When to Use

Activate this skill whenever:
- Starting a new coding task in any AI-assisted session.
- An agent is about to generate, modify, or delete any file.
- Running a `/review` or `/ship` command.
- You suspect an agent has drifted outside the declared task scope.
- Onboarding a new agent to an existing codebase with stable, tested modules.

---

## Process

### Checkpoint 1 — Session Start (Before writing any code)

**Step 1: Verify scopelock is initialized.**
```bash
scopelock status
```
If no manifest exists:
```bash
scopelock init
```

**Step 2: Inject scope context into the agent.**
```bash
scopelock context "<task description>"
```
Paste the full output at the top of your agent's context window before writing a single line of code.

**Step 3: Lock your stable code (if not already done).**

Lock a whole file:
```bash
scopelock lock src/lib/supabase.ts "production client — stable"
```

Lock a specific function (JS, TS, Python):
```bash
scopelock lock src/auth/token.ts:validateToken "tested, do not touch"
```

---

### Checkpoint 2 — Pre-Commit (Before every `git commit`)

**Step 4: Run the scope check.**
```bash
scopelock check
```

Two-tier enforcement:

| Tier | What it detects |
|------|----------------|
| File-level | Any file in the diff whose status is `locked` |
| Function-level | Any changed line falling inside a locked function's body |

- Exit `0` → commit is clean. Proceed.
- Exit `1` → violation found. **Stop. Do not commit.**

**Step 5: Handle violations.**

*Unintentional (scope creep):*
```bash
git restore <file>
```

*Genuinely required change:*
```bash
scopelock unlock src/auth/token.ts:validateToken "fixing JWT expiry edge case"
scopelock check   # must pass before committing
```

---

### Checkpoint 3 — Post-Task Review

**Step 6: Audit the unlock history.**
Open `.scopelock.json` and review every `history` entry. Every unlock must have a specific, task-justified reason. Vague entries like "needed it" indicate unreviewed scope creep.

**Step 7: Re-lock completed code.**
```bash
scopelock lock src/auth/token.ts:validateToken "fixed and re-locked"
```

---

## Pre-commit Hook (Wire once, enforce forever)

```bash
echo '#!/bin/sh
scopelock check' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

---

## Common Rationalizations

| Excuse | Rebuttal |
|--------|----------|
| "The locked function only had a minor change." | Size is irrelevant. Run `git restore` or use `scopelock unlock <file>:<func>` with a real reason. |
| "I'll check scope after I finish the implementation." | Checking after the fact means the violation already happened. Start with `scopelock context`. |
| "The agent said it needed to modify that function." | Then re-evaluate scope, not the lock. If you can't write a specific reason, the modification isn't justified. |
| "Function-level locking is overkill." | File-level locking doesn't stop an agent from rewriting a critical function inside a file marked `active`. |
| "The parser didn't detect my function." | Use file-level locking instead. Flag the miss — it's a parser bug, not a reason to skip protection. |
| "Running `scopelock check` slows my commit flow." | Under 300ms. The alternative is debugging a hallucinated refactor for hours. |
| ".scopelock.json shouldn't be committed." | Commit it. It's shared project state — your whole team and their agents benefit. |

---

## Red Flags

- `scopelock check` reports violations in more than 2 files — significant scope drift.
- An unlock entry has a vague reason string (e.g., "fix", "update") — bypassed without thinking.
- The agent proposes unlocking multiple files at once with one generic reason — batch rationalization.
- A locked function is reported as `function-missing` after a diff — it was deleted or renamed.
- `scopelock status` shows 0 locked files when you expected protection — manifest may be stale or deleted.

---

## Verification

A session is compliant when ALL of the following are true:

- [ ] `.scopelock.json` exists and `scopelock status` shows the expected locks.
- [ ] `scopelock context "<task>"` output was injected into the agent before any code was written.
- [ ] `scopelock check` exits `0` before every commit in this session.
- [ ] Every `unlock` entry has a specific, task-justified reason string.
- [ ] No diff contains modifications to locked files or lines inside locked function bodies that were not explicitly unlocked.
- [ ] All modified files and functions have been reviewed for re-locking post-task.

"Seems like it probably didn't touch anything important" is not verification. Run the check.
