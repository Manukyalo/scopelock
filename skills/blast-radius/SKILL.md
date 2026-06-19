---
name: blast-radius-map
description: "Godmode Skill: Before modifying any file, run 'scopelock impact <file>' to see every other file that imports it. Prevents scope creep by making the full impact of a change visible BEFORE the agent writes a single line."
---

## Overview

An AI agent can't know what it doesn't know. If it modifies `src/utils/auth.ts` without understanding that 14 other files import it, it has no idea if the function signature change it's making will cascade into 14 broken components.

This skill instructs the agent to **check before it touches**, not after.

## Agent Protocol

### MANDATORY: Before editing any file

1. Run the blast radius check first:
   ```bash
   scopelock impact src/utils/auth.ts
   ```

2. Read the output:
   ```
   💥  Blast Radius: src/utils/auth.ts

      7 file(s) directly import this file:

      → src/pages/login.tsx
      → src/pages/register.tsx
      → src/api/session.ts
      → src/middleware.ts
      → src/hooks/useUser.ts
      → test/auth.test.ts
      → test/session.test.ts

      ⚠️  Modifying 'src/utils/auth.ts' may impact all 7 of the above file(s).
   ```

3. **Assess the risk** based on what you see:
   - **0 dependents** → safe to modify freely.
   - **1–5 dependents** → proceed carefully, check each dependent after your change.
   - **6+ dependents** → this is a high-blast-radius file. Consider locking it and building a new abstraction instead of modifying it directly.

4. If you decide to proceed, lock all other files first:
   ```bash
   scopelock lock src/pages/login.tsx "blast radius protection"
   scopelock lock src/middleware.ts "blast radius protection"
   # ... etc
   ```

5. Make your change to the target file only.

6. Run `scopelock guard` to verify no locked files were touched.

## Why this exists

The most expensive bugs come from changes that seemed small but weren't. This skill makes the full impact of every change explicit before the agent commits to it.
