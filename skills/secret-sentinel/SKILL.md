---
name: secret-sentinel
description: "Godmode Skill: Physically blocks AI agents from committing API keys, tokens, or .env leaks. scopelock guard scans every added line in the git diff for high-entropy secrets before the commit is allowed. This is a hard block — not a warning."
---

## Overview

Leaked secrets are the number one cause of production security incidents caused by AI agents. An agent will hardcode an API key to "test something quickly" and forget to remove it. This skill prevents that from ever reaching the repo.

## What Gets Blocked

The Secret Sentinel scans every newly added line for:
- **AWS Access Keys** (`AKIA...`)
- **Stripe Secret Keys** (`sk_live_...`, `sk_test_...`)
- **GitHub Tokens** (`ghp_...`, `ghs_...`)
- **Slack Tokens** (`xoxb-...`, `xoxs-...`)
- **Generic hardcoded secrets** (any `api_key = "..."`, `password = "..."`, `token = "..."` with a value 16+ chars long)

## Agent Protocol

### Before every commit:
```bash
scopelock guard
```
If a secret is detected, you will see:
```
❌ VIOLATION: SECRET LEAK [Stripe Secret Key] detected in 'src/api.ts' on line 42.
```

### How to resolve:
1. **Remove the secret from the file** — use an environment variable instead:
   ```ts
   // WRONG — will be blocked
   const key = "sk_live_1234abcdefgh";
   
   // CORRECT — reads from environment
   const key = process.env.STRIPE_SECRET_KEY;
   ```
2. Add the secret to `.env` (which should be in `.gitignore`).
3. Add the variable name to `.env.example` so other developers know it exists.

### Intentional exception (mock/test keys only):
If you are intentionally committing a **mock** key for testing purposes, a human must explicitly authorize it:
```bash
scopelock trust test/fixtures/mock.ts "contains a mock stripe key for unit tests — not a real key"
```
This bypass is logged permanently in `.scopelock.json` for audit purposes.

## Why this exists

You cannot undo a leaked secret that was pushed to a public GitHub repo. This skill makes leaking a secret a physical impossibility, not a code review catch.
