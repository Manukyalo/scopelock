#!/usr/bin/env node
'use strict';

/**
 * bin/driftlock.js — CLI entry point
 *
 * Commands:
 *   driftlock init                          Scan repo, generate .driftlock.json
 *   driftlock lock <file>[:<func>] [reason] Lock a file or function
 *   driftlock unlock <file>[:<func>] <reason> Unlock with mandatory reason
 *   driftlock context [task]                Generate AI context block
 *   driftlock check                         Verify git diff — exits 1 on violation
 *   driftlock status                        Print manifest summary
 */

const { execSync } = require('child_process');
const manifest = require('../src/manifest');
const context  = require('../src/context');
const git      = require('../src/git');
const blast    = require('../src/blast');
const gateway  = require('../src/license/gateway');

const [,, command, ...args] = process.argv;

switch (command) {

  case 'init':
    manifest.init();
    break;

  case 'lock': {
    const target = args[0];
    const reason = args.slice(1).join(' ') || 'manually locked';
    if (!target) {
      console.error('Usage: driftlock lock <file>[:<function>] [reason]');
      process.exit(1);
    }
    manifest.lock(target, reason);
    break;
  }

  case 'unlock': {
    const target = args[0];
    const reason = args.slice(1).join(' ');
    if (!target || !reason) {
      console.error('Usage: driftlock unlock <file>[:<function>] <reason>');
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

  case 'guard':
    git.guard(args);
    break;

  case 'status':
    manifest.status();
    break;

  case 'impact': {
    const target = args[0];
    if (!target) {
      console.error('Usage: driftlock impact <file>');
      process.exit(1);
    }
    blast.printBlastRadius(target);
    break;
  }

  case 'seal': {
    const target = args[0];
    const reason = args.slice(1).join(' ') || 'production path — seal applied';
    if (!target) {
      console.error('Usage: driftlock seal <file> <reason>');
      process.exit(1);
    }
    manifest.seal(target, reason);
    break;
  }

  case 'unseal': {
    const target = args[0];
    const ticketArg = args.find(a => a.startsWith('--human-approved='));
    const ticket = ticketArg ? ticketArg.replace('--human-approved=', '') : null;
    const reason = args.filter(a => !a.startsWith('--')).slice(1).join(' ');
    if (!target || !ticket || !reason) {
      console.error('Usage: driftlock unseal <file> --human-approved=<ticket> <reason>');
      process.exit(1);
    }
    manifest.unseal(target, ticket, reason);
    break;
  }

  case 'trust': {
    const target = args[0];
    const reason = args.slice(1).join(' ');
    if (!target || !reason) {
      console.error('Usage: driftlock trust <file> <reason>');
      process.exit(1);
    }
    manifest.trust(target, reason);
    break;
  }

  case 'save': {
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const manifestObj = manifest.getManifest();

      // Exclude .driftlock.json from stash — the manifest must survive the snapshot.
      // On Windows, stash@{0} needs to be quoted.
      const out = execSync(
        `git stash push --include-untracked -m "driftlock-snapshot-${ts}" -- . ":(exclude).driftlock.json"`,
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
      console.log(`✅ Snapshot created. Run 'driftlock restore' to obliterate agent changes and restore this state.`);
    } catch (e) {
      console.error('Failed to create snapshot.', e.stderr || e.message);
      process.exit(1);
    }
    break;
  }

  case 'restore': {
    try {
      const manifestObj = manifest.getManifest();
      if (!manifestObj.lastSnapshot) {
        console.error('❌ No snapshot found. Run `driftlock save` first.');
        process.exit(1);
      }
      console.log(`Obliterating agent mess...`);
      execSync(`git reset --hard HEAD`, { stdio: ['pipe', 'pipe', 'pipe'] });
      execSync(`git clean -fd`, { stdio: ['pipe', 'pipe', 'pipe'] });

      if (manifestObj.lastSnapshot === 'dirty') {
        const stashes = execSync('git stash list', { encoding: 'utf8' });
        const match = stashes.match(/stash@\{(\d+)\}: .*?driftlock-snapshot/);
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

  case 'login': {
    const key = args[0];
    if (!key) {
      console.error('Usage: driftlock login <license-key>');
      process.exit(1);
    }
    console.log('Verifying license with Gumroad...');
    gateway.login(key).then(res => {
      if (res.ok) {
        console.log(`✅ Success! License activated.`);
        console.log(`Tier: ${res.tier.toUpperCase()}`);
        console.log(`Key:  ${res.masked_key}`);
      } else {
        console.error(`❌ Login failed: ${res.reason}`);
        process.exit(1);
      }
    });
    break;
  }

  case 'logout': {
    gateway.logout();
    console.log('✅ Logged out. License cleared from local cache.');
    break;
  }

  case 'whoami': {
    const status = gateway.whoami();
    if (status.status === 'unlicensed') {
      console.log('You are currently on the Free tier. No license active.');
      console.log(`Upgrade here: ${require('../src/license/constants').GUMROAD_PURCHASE_URL}`);
    } else {
      console.log(`💳 License Status: ACTIVE`);
      console.log(`Tier:          ${status.tier.toUpperCase()}`);
      console.log(`Key:           ${status.masked_key}`);
      console.log(`Last Verified: ${new Date(status.verifiedAt).toLocaleString()}`);
      console.log(`Next Check:    ${new Date(status.nextCheckAt).toLocaleString()}`);
      if (status.isStale) console.log('⚠️  Cache is stale, will re-verify on next Pro command.');
    }
    break;
  }

  case 'scout':
  case 'audit':
  case 'godmode': {
    // Pro/Team commands gate
    gateway.checkAccess('pro').then(res => {
      if (!res.licensed) {
        console.error(`\n🔒 '${command}' requires a Pro or Team license.`);
        console.error(`Reason: ${res.reason}`);
        console.error(`\nGet your license here: ${res.purchaseUrl}`);
        process.exit(1);
      }
      console.log(`[${command}] is a Pro feature — implementation coming in next release.`);
    });
    break;
  }

  default:
    console.log(`
driftlock — AI agent scope enforcement for production codebases.

Usage:
  driftlock init                                    Scan repo and generate .driftlock.json
  driftlock lock <file>[:<func>] [reason]           Lock a file or a specific function
  driftlock unlock <file>[:<func>] <reason>         Unlock (reason is mandatory)
  driftlock seal <file> <reason>                    Permanent production-path lock (no override)
  driftlock unseal <file> --human-approved=<ticket> <reason>  Release a seal
  driftlock impact <file>                           Show all files that import this file
  driftlock trust <file> <reason>                   Bypass Secret Sentinel for a specific file
  driftlock save                                    Auto-snapshot repo state before an agent session
  driftlock restore                                 Rollback to the last snapshot
  driftlock context [task]                          Generate AI context block for a task
  driftlock guard [--tests]                         Check git diff for violations and secret leaks
  driftlock status                                  Show manifest summary

Account & Pro Features:
  driftlock login <key>                             Activate your Gumroad license
  driftlock logout                                  Remove local license cache
  driftlock whoami                                  Check current license status
  driftlock scout                                   [PRO] Coming soon
  driftlock audit                                   [PRO] Coming soon
  driftlock godmode                                 [PRO] Coming soon

Examples:
  driftlock lock src/auth.ts
  driftlock lock src/auth.ts:validateToken "stable — do not touch"
  driftlock unlock src/auth.ts:validateToken "need to fix JWT expiry bug"
  driftlock context "Fix the broken checkout flow"
  driftlock guard
    `);
    process.exit(1);
}
