---
name: dependency-lockdown
description: "Godmode Skill: Prevents AI agents from silently adding or upgrading npm/pip/cargo packages. Dependency manifest files (package.json, requirements.txt, etc.) are automatically locked by scopelock on init. Any diff touching these files will fail scopelock check until explicitly unlocked with a reason."
---

## Overview

Dependency drift is one of the most common and expensive agent mistakes. An agent trying to fix one bug will silently add 12 packages, bloat the bundle, and introduce unknown vulnerabilities. This skill makes that impossible.

## How it Works

On `scopelock init`, the following files are **automatically locked** without any manual action required:
- `package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
- `requirements.txt`, `Pipfile`, `Pipfile.lock`, `poetry.lock`
- `Cargo.toml`, `Cargo.lock`, `go.mod`, `go.sum`

## Agent Protocol

### When you need to add a dependency:
1. You MUST explicitly unlock the manifest first with a clear reason:
   ```bash
   scopelock unlock package.json "adding zod for runtime validation of API responses"
   ```
2. Make your change (add the dependency to the manifest).
3. Run `scopelock check` to confirm the change is authorized.
4. Re-lock the manifest immediately after:
   ```bash
   scopelock lock package.json "dependencies updated and reviewed"
   ```

### When you do NOT need a new dependency:
- If you find yourself reaching for a new package, stop and ask: can this be solved with a built-in or existing dependency?
- The lock exists to force that question before the decision is made.

## Why this exists

Agents never "just need one package." Every dependency is a long-term maintenance cost, a security surface, and a potential supply chain attack vector. This skill enforces that every dependency addition is a deliberate, logged, human-approved decision.
