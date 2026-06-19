#!/usr/bin/env node
'use strict';

/**
 * bin/scopelock.js — CLI entry point
 *
 * Commands:
 *   scopelock init                          Scan repo, generate .scopelock.json
 *   scopelock lock <file>[:<func>] [reason] Lock a file or function
 *   scopelock unlock <file>[:<func>] <reason> Unlock with mandatory reason
 *   scopelock context [task]                Generate AI context block
 *   scopelock check                         Verify git diff — exits 1 on violation
 *   scopelock status                        Print manifest summary
 */

const manifest = require('../src/manifest');
const context  = require('../src/context');
const git      = require('../src/git');

const [,, command, ...args] = process.argv;

switch (command) {

  case 'init':
    manifest.init();
    break;

  case 'lock': {
    const target = args[0];
    const reason = args.slice(1).join(' ') || 'manually locked';
    if (!target) {
      console.error('Usage: scopelock lock <file>[:<function>] [reason]');
      process.exit(1);
    }
    manifest.lock(target, reason);
    break;
  }

  case 'unlock': {
    const target = args[0];
    const reason = args.slice(1).join(' ');
    if (!target || !reason) {
      console.error('Usage: scopelock unlock <file>[:<function>] <reason>');
      process.exit(1);
    }
    manifest.unlock(target, reason);
    break;
  }

  case 'context': {
    const task = args.join(' ');
    context.generate(task);
    break;
  }

  case 'check':
    git.check();
    break;

  case 'status':
    manifest.status();
    break;

  default:
    console.log(`
scopelock — Anti-hallucination scope locking for AI coding agents.

Usage:
  scopelock init                           Scan repo and generate .scopelock.json
  scopelock lock <file>[:<func>] [reason]  Lock a file or a specific function
  scopelock unlock <file>[:<func>] <reason> Unlock (reason is mandatory)
  scopelock context [task]                 Generate AI context block for a task
  scopelock check                          Check git diff for scope violations
  scopelock status                         Show manifest summary

Examples:
  scopelock lock src/auth.ts
  scopelock lock src/auth.ts:validateToken "stable — do not touch"
  scopelock unlock src/auth.ts:validateToken "need to fix JWT expiry bug"
  scopelock context "Fix the broken checkout flow"
  scopelock check
    `);
    process.exit(1);
}
