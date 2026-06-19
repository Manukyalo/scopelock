---
name: scope-enforcement
description: "Prevents AI agent scope creep by enforcing scopelock boundaries before, during, and after every coding task. Use before writing any code in a session, before every commit, and before any review or ship phase. Requires scopelock CLI (npm install -g scopelock)."
---

## Overview

AI coding agents default to the shortest path to a passing result — which frequently means modifying files, functions, and logic far outside the declared task. `scope-enforcement` is the guardrail that stops this before it reaches a commit.

This skill uses `scopelock` — a zero-dependency CLI tool — to:
- Inject precise, file-level scope boundaries into your context before you write a single line.
- Block commits that touch files the developer has explicitly locked.
- Create an auditable trail of every scope override with a mandatory reason string.

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
ls .scopelock.json
```
If the manifest doesn't exist, run:
```bash
scopelock init
```
Do not proceed until the manifest exists.

**Step 2: Inject scope context into the agent.**
```bash
scopelock context "<task description>"
```
Paste the full output at the top of your agent's context window or system prompt. This tells the agent exactly which files are `locked` and which are `active`.

**Step 3: Declare active files.**
Before writing code, explicitly mark the files this task will touch as `active` in `.scopelock.json`. Any file you are not declaring `active` is implicitly off-limits.

---

### Checkpoint 2 — Pre-Commit (Before every `git commit`)

**Step 4: Run the scope check.**
```bash
scopelock check
```
- If it exits `0`: commit is clean. Proceed.
- If it exits `1`: a locked file was modified. **Stop. Do not commit.**

**Step 5: Handle violations — choose one path only.**

*Path A — The modification was unintentional (scope creep):*
```bash
git restore <locked-file>
```
Revert the file. Identify why the agent touched it. Re-run `scopelock context` with a more precise task description.

*Path B — The modification is genuinely required:*
```bash
scopelock unlock <file> "<precise reason this task requires this change>"
```
Then re-run `scopelock check` to confirm it now passes before committing.

---

### Checkpoint 3 — Post-Task Review

**Step 6: After the task is complete, audit the manifest.**
Open `.scopelock.json` and review the `history` array for every file that was unlocked. Every unlock entry must have a legitimate, task-specific reason. Generic reasons like "needed it" or "the agent required it" are not acceptable and indicate scope creep that was overridden without thinking.

**Step 7: Re-lock completed files.**
Once a task is complete and its changes are committed, manually set modified files back to `locked` in `.scopelock.json` if they are now stable. This keeps the manifest accurate for the next task.

---

## Pre-commit Hook (Wire once, enforce forever)

Add this to every project's git hooks at setup time:

```bash
echo '#!/bin/sh
scopelock check' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

Once wired, `scopelock check` runs automatically on every `git commit`. Agents cannot commit violations even if they try.

---

## Common Rationalizations

| Excuse | Rebuttal |
|--------|----------|
| "The locked file only had a minor change, it's fine." | The size of the change is irrelevant. The file was locked because it was stable and tested. Any unintended modification risks regression. Run `git restore` or use `scopelock unlock` with a real reason. |
| "I'll check scope after I finish the implementation." | Checking scope after the fact means the violation has already happened. The purpose of this skill is to prevent violations, not detect them after you've written 300 lines. Start with `scopelock context`. |
| "The agent said it needed to modify that file to complete the task." | Then the task scope needs to be re-evaluated, not the lock. Use `scopelock unlock` with an explicit reason. If you can't write a specific reason, the modification isn't justified. |
| "scopelock.json isn't committed to the repo, so other devs won't see it." | Add it to version control. It's project state, not a personal preference file. Your team's AI agents all benefit from shared scope boundaries. |
| "This is an isolated codebase so scope creep doesn't matter." | Scope creep in isolated codebases is still regressions, still wasted debugging time, still context confusion in the next AI session. The cost is always real. |
| "Running `scopelock check` slows down my commit flow." | It takes under 200ms. The alternative is debugging a hallucinated refactor for 2 hours. |

---

## Red Flags

Stop immediately if you observe any of the following:

- `scopelock check` output lists more than 2 locked file violations — the agent has significantly drifted from scope.
- An unlock entry in `.scopelock.json` has a vague reason string (e.g., "required", "fix", "update") — someone bypassed the guardrail without thinking.
- The agent generates changes in `node_modules/`, `.env`, or config files without being explicitly asked — immediate scope violation.
- `scopelock init` reports a drastically different file count than expected — the manifest may be stale or the project structure changed without re-initializing.
- The agent proposes to run `scopelock unlock` for more than one file at a time without a distinct, file-specific reason for each — this is batch rationalization, not legitimate scope expansion.

---

## Verification

A session is compliant with this skill when ALL of the following are true:

- [ ] `.scopelock.json` exists and was generated after the most recent `scopelock init`.
- [ ] `scopelock context "<task>"` was run and its output was injected into the agent context before any code was written.
- [ ] `scopelock check` exits `0` before every commit in this session.
- [ ] Every `unlock` entry in `.scopelock.json` has a non-generic, task-specific reason string.
- [ ] No `git diff` contains changes to files that were not declared `active` or explicitly unlocked for this task.
- [ ] All files modified in this task have been reviewed for re-locking if they are now stable.

"Seems like it probably didn't touch anything important" is not verification. Run the check.
