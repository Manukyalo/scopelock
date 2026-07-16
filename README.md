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

## 🛡️ Core Protection Features (The Guardrails)
- **File & Function Locks**: Surgical locking of specific files or even individual AST functions. If an AI agent tries to modify a locked function, the pre-commit hook hard-blocks it.
- **Production Path Seals**: Permanent locks for critical paths (like billing or auth). These cannot be unlocked normally and require explicit human sign-off via a PR or Jira ticket (`driftlock unseal --human-approved=<ticket>`).
- **Secret Sentinel**: A hard-blocking scanner that physically prevents agents from hallucinating and accidentally committing AWS keys, Stripe tokens, or `.env` leaks.
- **Test Coverage Gate**: Strict enforcement that blocks any source code changes made by AI agents that aren't accompanied by corresponding tests.
- **Dependency Lockdown**: Zero-trust dependency management. Automatically locks `package.json` on init to prevent silent dependency drift and hallucinated packages.

## 🛠️ Agent Tools (The Tooling)

- **Blast Radius Map**: Prevent scope creep before it happens. Agents can run `driftlock impact <file>` to see every file in the codebase that imports a target file before they touch it.
- **Rollback Snapshots**: Run `driftlock save` before an agent starts working. If the agent hallucinates or breaks the project, `driftlock restore` acts as an instant escape hatch to obliterate rogue changes and restore the clean snapshot.
- **Context Generation**: Agents run `driftlock context` to generate a token-efficient map of locked vs. active boundaries to feed into their own system prompts.

## 🤖 The 7 Native AI Skills (Drop-in for Claude/Antigravity/Cline)

Driftlock ships with 7 markdown-based Agent Skills. If your team uses an agent framework, you just point it to these folders and the AI automatically learns how to use Driftlock safely:

- `scope-enforcement`
- `dependency-lockdown`
- `secret-sentinel`
- `test-coverage-gate`
- `rollback-snapshot`
- `blast-radius`
- `production-path-lock`

---

## Commands & Tiers

Driftlock commands are gated by license tier (Free, Pro, Team).

### 🟢 Free Tier (No license required)
- `driftlock init` — Scan repo, generate `.driftlock.json`
- `driftlock lock <file>[:<func>] [reason]` — Lock a file or function
- `driftlock unlock <file>[:<func>] <reason>` — Unlock a target
- `driftlock status` — Print manifest summary

### 🟡 Pro Tier (Requires Pro License)
- `driftlock save` — Auto-snapshot repo state before an agent session
- `driftlock restore` — Rollback to the last snapshot
- `driftlock impact <file>` — Show all files that import this file
- `driftlock context [task]` — Generate AI context block for a task
- `driftlock guard [--tests]` — Check git diff for violations and secret leaks
- `driftlock seal <file> <reason>` — Permanent lock for production paths

### 🔵 Team Tier (Requires Team License)
- `driftlock unseal <file> --human-approved=<ticket> <reason>` — Release a sealed path
- `driftlock trust <file> <reason>` — Bypass Secret Sentinel for a specific file (Security Override)
- `driftlock godmode <file>` — Advanced cross-file refactoring with automated boundary expansion
- `driftlock scout` — Autonomous repository scanning for architectural drift
- `driftlock audit <branch>` — AI-driven security and scope-violation auditing for team PRs

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
## Data Model
All state is stored in `.driftlock.json` at the root of your repo.
The manifest is project state, not a personal config. Commit it so your whole team — and all their AI agents — share the same scope boundaries.
