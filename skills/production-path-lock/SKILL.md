---
name: production-path-lock
description: "Godmode Skill: A permanent, override-resistant lock for critical production paths like /auth, /billing, /migrations. Regular 'scopelock unlock' cannot bypass it. Requires a second human's explicit sign-off via 'scopelock sudo-unlock' with a ticket."
---

## Overview

Some files must never be touched by an AI agent without explicit human sign-off. Your `/auth` logic, billing handlers, and database migration files are not negotiable. A `superlock` makes this a physical constraint, not a policy.

A superlocked file cannot be overridden by `scopelock unlock`. The agent must stop, escalate to a human, and provide a traceable ticket before any modification is allowed.

## Recommended Files to Superlock on Every Project

```bash
# Authentication
scopelock superlock src/auth/token.ts "core auth — requires senior review"
scopelock superlock src/middleware/auth.ts "core auth — requires senior review"

# Billing & Payments
scopelock superlock src/billing/stripe.ts "billing — requires finance team approval"
scopelock superlock src/billing/webhooks.ts "billing — requires finance team approval"

# Database Migrations
scopelock superlock migrations/ "schema changes — requires DBA review"

# Security-critical config
scopelock superlock .env.production "production secrets — never touch"
```

## Agent Protocol

### When you encounter a superlocked file:
```
❌ 'src/auth/token.ts' is SUPERLOCKED and cannot be unlocked with 'scopelock unlock'.
   This path is a protected production route.
   Use: scopelock sudo-unlock src/auth/token.ts --human-approved=<ticket> <reason>
```

1. **STOP.** Do not attempt to work around the lock.
2. **Escalate.** Tell the human you cannot proceed without their explicit approval.
3. **The human must run:**
   ```bash
   scopelock sudo-unlock src/auth/token.ts --human-approved=JIRA-123 "fixing JWT expiry bug approved in PR-456"
   ```
4. Only after you see the `SUDO-UNLOCKED` confirmation may you proceed.
5. Re-superlock the file immediately after your change is committed:
   ```bash
   scopelock superlock src/auth/token.ts "re-locked after JWT fix — JIRA-123"
   ```

## The Audit Trail

Every `sudo-unlock` is permanently logged in `.scopelock.json` with:
- The timestamp
- The human-approved ticket number
- The full reason string

This creates a traceable, auditable record of every time a production path was modified — essential for SOC2, GDPR, and any compliance review.

## Why this exists

`locked` is a request. `superlocked` is a wall. Some files need a wall.
