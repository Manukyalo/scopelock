---
name: rollback-snapshot
description: "Godmode Skill: Creates a one-command safety net before every agent session. If the agent goes rogue, a single command obliterates all changes and perfectly restores the repository to its pre-session state."
---

## Overview

Before you let an agent loose on a codebase, you need a guaranteed escape hatch. `scopelock snapshot` creates that escape hatch using git's native stash mechanism. It is instant, requires no external tools, and can restore the repo to its exact pre-session state in under one second.

## How Storage Works

- The snapshot is stored in **git's local stash** (`.git/refs/stash`) — it never leaves your machine and is never pushed to GitHub.
- The `.scopelock.json` manifest stores a pointer (`lastSnapshot: "dirty" | "clean"`) so `scopelock revert` knows what to restore.
- If you clone the repo on a new machine, the snapshot is gone — this is correct. Snapshots are session-scoped, not repository-scoped.

## Agent Protocol

### At the start of EVERY agent session:
```bash
scopelock snapshot
```
This is the first command you run, before writing a single line of code.

### If the session goes well:
Simply commit your work normally. The stash will remain in git until git's garbage collection cleans it up automatically (default: 90 days).

### If the agent goes rogue:
```bash
scopelock revert
```
This command:
1. Runs `git reset --hard HEAD` — obliterates all tracked file changes.
2. Runs `git clean -fd` — deletes all untracked files the agent created.
3. Pops the stash — restores your working tree to the exact state at snapshot time.

## When to Use

- Before any multi-file refactor.
- Before any session where the agent is given broad instructions like "fix all the TypeScript errors."
- Before any experiment where you are not 100% sure of the outcome.

## Why this exists

`Ctrl+Z` doesn't work across a 45-minute agent session. This skill gives you a time machine.
