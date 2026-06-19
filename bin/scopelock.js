#!/usr/bin/env node
const manifest = require('../src/manifest');
const context = require('../src/context');
const git = require('../src/git');

const command = process.argv[2];

switch (command) {
  case 'init':
    manifest.init();
    break;
  case 'context':
    const task = process.argv.slice(3).join(' ');
    context.generate(task);
    break;
  case 'check':
    git.check();
    break;
  case 'unlock':
    const file = process.argv[3];
    const reason = process.argv.slice(4).join(' ');
    if (!file || !reason) {
      console.error('Usage: scopelock unlock <file> <reason>');
      process.exit(1);
    }
    manifest.unlock(file, reason);
    break;
  default:
    console.log(`
Usage:
  scopelock init              - Scan repo and generate .scopelock.json
  scopelock context <task>    - Generate AI context for a task
  scopelock check             - Verify current git diff against locked scope
  scopelock unlock <file> <reason> - Unlock a file for editing
    `);
    process.exit(1);
}
