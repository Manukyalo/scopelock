---
name: production-path-lock
description: "Godmode Skill: A permanent, override-resistant lock for critical production paths like /auth, /billing, /migrations. Regular 'scopelock unlock' cannot bypass it. Requires a second human's explicit sign-off via 'scopelock unseal' with a ticket."
---

## Overview

Some files must never be touched by an AI agent without explicit human sign-off. Your `/auth` logic, billing handlers, and database migration files are not negotiable. A `seal` makes this a physical constraint, not a policy.

A sealed file cannot be overridden by `scopelock unlock`. The agent must stop, escalate to a human, and provide a traceable ticket before any modification is allowed.

## Recommended Files to Seal on Every Project

```bash
# Authentication
scopelock seal src/auth/token.ts "core auth — requires senior review"
scopelock seal src/middleware/auth.ts "core auth — requires senior review"

# Billing & Payments
scopelock seal src/billing/stripe.ts "billing — requires finance team approval"
scopelock seal src/billing/webhooks.ts "billing — requires finance team approval"

# Database Migrations
scopelock seal migrations/ "schema changes — requires DBA review"

# Security-critical config
scopelock seal .env.production "production secrets — never touch"
```

## Agent Protocol

### When you encounter a sealed file:
```
❌ 'src/auth/token.ts' is SEALED and cannot be unlocked with 'scopelock unlock'.
   This path is a protected production route.
   Use: scopelock unseal src/auth/token.ts --human-approved=<ticket> <reason>
```

1. **STOP.** Do not attempt to work around the lock.
2. **Escalate.** Tell the human you cannot proceed without their explicit approval.
3. **The human must run:**
   ```bash
   scopelock unseal src/auth/token.ts --human-approved=JIRA-123 "fixing JWT expiry bug approved in PR-456"
   ```
4. Only after you see the `UNSEALED` confirmation may you proceed.
5. Re-seal the file immediately after your change is committed:
   ```bash
   scopelock seal src/auth/token.ts "re-locked after JWT fix — JIRA-123"
   ```

## The Audit Trail

Every `unseal` is permanently logged in `.scopelock.json` with:
- The timestamp
- The human-approved ticket number
- The full reason string

This creates a traceable, auditable record of every time a production path was modified — essential for SOC2, GDPR, and any compliance review.

## Why this exists

`locked` is a request. `sealed` is a wall. Some files need a wall.
