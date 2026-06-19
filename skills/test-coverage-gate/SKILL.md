---
name: test-coverage-gate
description: "Godmode Skill: Forces the AI agent to write or update test files whenever it modifies application logic. Run 'scopelock guard --tests' before committing to enforce this rule."
---

## Overview

This skill teaches the agent how to navigate the `scopelock` Test Coverage Gate. 
When `--tests` is active, the CLI will hard-block any commit that modifies a source file (`.js`, `.ts`, `.py`, etc.) if a corresponding test file (`.test.ts`, `.spec.js`, `test/`) is not also modified in the same diff.

## Agent Protocol

1. **Before writing code**: If you are about to modify application logic, understand that your changes will be rejected unless you also provide test coverage.
2. **Write the code**: Implement the requested feature or fix.
3. **Write the test**: You *must* update the corresponding test file or create a new one. The file path must contain `.test.`, `.spec.`, or be inside a `test/` or `__tests__/` directory.
4. **Validation**: Run `scopelock guard --tests` to mathematically verify your diff will pass the coverage gate.
5. **Ship**: Only after the test gate is passed are you allowed to commit or mark the task as complete.

## Why this exists

Agents often write code and immediately declare a task "done" without proving it works. This physical gate prevents the agent from bypassing the verification phase. No tests, no merge.
