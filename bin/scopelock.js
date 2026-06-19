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

const { execSync } = require('child_process');
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
    git.check(args);
    break;

  case 'status':
    manifest.status();
    break;

  case 'allow-secret': {
    const target = args[0];
    const reason = args.slice(1).join(' ');
    if (!target || !reason) {
      console.error('Usage: scopelock allow-secret <file> <reason>');
      process.exit(1);
    }
    manifest.allowSecret(target, reason);
    break;
  }

  case 'snapshot': {
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const manifestObj = manifest.getManifest();

      // Exclude .scopelock.json from stash — the manifest must survive the snapshot.
      // On Windows, stash@{0} needs to be quoted.
      const out = execSync(
        `git stash push --include-untracked -m "scopelock-snapshot-${ts}" -- . ":(exclude).scopelock.json"`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );

      if (out.includes('No local changes to save')) {
        manifestObj.lastSnapshot = 'clean';
      } else {
        // Re-apply so the working tree is fully restored; stash stays as our savepoint.
        execSync(`git stash apply "stash@{0}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        manifestObj.lastSnapshot = 'dirty';
      }

      manifest.saveManifest(manifestObj);
      console.log(`✅ Snapshot created. Run 'scopelock revert' to obliterate agent changes and restore this state.`);
    } catch (e) {
      console.error('Failed to create snapshot.', e.stderr || e.message);
      process.exit(1);
    }
    break;
  }

  case 'revert': {
    try {
      const manifestObj = manifest.getManifest();
      if (!manifestObj.lastSnapshot) {
        console.error('❌ No snapshot found. Run `scopelock snapshot` first.');
        process.exit(1);
      }
      console.log(`Obliterating agent mess...`);
      execSync(`git reset --hard HEAD`, { stdio: ['pipe', 'pipe', 'pipe'] });
      execSync(`git clean -fd`, { stdio: ['pipe', 'pipe', 'pipe'] });

      if (manifestObj.lastSnapshot === 'dirty') {
        const stashes = execSync('git stash list', { encoding: 'utf8' });
        const match = stashes.match(/stash@\{(\d+)\}: .*?scopelock-snapshot/);
        if (match) {
          execSync(`git stash pop "stash@{${match[1]}}"`, { stdio: ['pipe', 'pipe', 'pipe'] });
        }
      }

      manifestObj.lastSnapshot = null;
      manifest.saveManifest(manifestObj);
      console.log(`✅ Rollback complete. The repository has been restored.`);
    } catch (e) {
      console.error('Failed to revert.', e.stderr || e.message);
      process.exit(1);
    }
    break;
  }

  default:
    console.log(`
scopelock — Anti-hallucination scope locking for AI coding agents.

Usage:
  scopelock init                           Scan repo and generate .scopelock.json
  scopelock lock <file>[:<func>] [reason]  Lock a file or a specific function
  scopelock unlock <file>[:<func>] <reason> Unlock (reason is mandatory)
  scopelock allow-secret <file> <reason>   Bypass Secret Sentinel for a specific file
  scopelock context [task]                 Generate AI context block for a task
  scopelock snapshot                       Auto-snapshot repo state before an agent session
  scopelock revert                         Rollback to the last snapshot
  scopelock check [--require-tests]        Check git diff for violations and test coverage
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
