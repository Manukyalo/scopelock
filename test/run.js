'use strict';

/**
 * test/run.js
 *
 * Integration tests for scopelock V2.
 * Sets up a real git repo in test/tmp_repo/, exercises all commands,
 * and asserts correct exit codes and output.
 */

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

// ─── Setup ────────────────────────────────────────────────────────────────────

const testDir = path.join(__dirname, 'tmp_repo');
if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
fs.mkdirSync(testDir, { recursive: true });
process.chdir(testDir);

const CLI = 'node ../../bin/scopelock.js';

function run(cmd, expectFail = false) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
  } catch (err) {
    if (expectFail) return err.stderr + err.stdout;
    console.error(`\nUnexpected failure running: ${cmd}`);
    console.error(err.stdout);
    console.error(err.stderr);
    process.exit(1);
  }
}

function assert(condition, message) {
  if (!condition) {
    console.error(`\n  FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓  ${message}`);
}

// ─── Git repo bootstrap ───────────────────────────────────────────────────────

run('git init');
run('git config user.email "test@scopelock.dev"');
run('git config user.name "scopelock test"');

// Write a simple JS file with two named functions
fs.writeFileSync('app.js', `
function stableFunc() {
  return 'I am stable and tested';
}

function workInProgress() {
  return 'I am actively being edited';
}
`.trimStart());

fs.writeFileSync('readme.txt', 'Initial readme content.\n');
fs.writeFileSync('package.json', '{"name":"test"}\n'); // Dummy package manifest
run('git add .');
run('git commit -m "initial"');

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\n--- Test 1: scopelock init ---');
run(`${CLI} init`);
assert(fs.existsSync('.scopelock.json'), '.scopelock.json was created');
const manifest = JSON.parse(fs.readFileSync('.scopelock.json', 'utf8'));
assert(manifest.version === 2, 'Manifest is V2 schema');
assert(manifest.files['app.js'] !== undefined, 'app.js is tracked');

console.log('\n--- Test 2: Dependency auto-lock (Dependency Lockdown) ---');
assert(manifest.files['package.json'].status === 'locked', 'package.json is automatically locked on init');

console.log('\n--- Test 3: scopelock status ---');
const statusOut = run(`${CLI} status`);
assert(statusOut.includes('unscoped'), 'status shows unscoped files');

console.log('\n--- Test 4: File-level lock ---');
run(`${CLI} lock readme.txt "stable documentation"`);
const m2 = JSON.parse(fs.readFileSync('.scopelock.json', 'utf8'));
assert(m2.files['readme.txt'].status === 'locked', 'readme.txt is locked');

console.log('\n--- Test 5: File-level violation detection ---');
fs.appendFileSync('readme.txt', 'AI hallucinated this line.\n');
const violation1 = run(`${CLI} check`, true);
assert(violation1.includes('VIOLATION'), 'check detects locked file modification');

console.log('\n--- Test 6: File-level unlock clears violation ---');
run(`${CLI} unlock readme.txt "intentional update to docs"`);
const check1 = run(`${CLI} check`);
assert(check1.includes('passed'), 'check passes after unlock');
run('git restore readme.txt'); // clean up

console.log('\n--- Test 7: Secret Sentinel detection ---');
fs.appendFileSync('readme.txt', 'const stripe_key = "sk_test_12345abcdeABCDE12345abcd";\n');
const secretViolation = run(`${CLI} check`, true);
assert(secretViolation.includes('SECRET LEAK'), 'check detects leaked stripe key');
assert(secretViolation.includes('Stripe Secret Key'), 'check identifies secret type');

console.log('\n--- Test 8: Secret Sentinel bypass (allow-secret) ---');
run(`${CLI} allow-secret readme.txt "it is a mock key for tests"`);
const secretCheck = run(`${CLI} check`);
assert(secretCheck.includes('passed'), 'allow-secret successfully bypasses secret sentinel');
run('git restore readme.txt'); // clean up

console.log('\n--- Test 9: Function-level lock ---');
run(`${CLI} lock app.js:stableFunc "tested, production-ready"`);
const m3 = JSON.parse(fs.readFileSync('.scopelock.json', 'utf8'));
assert(
  m3.files['app.js'].functions['stableFunc'].status === 'locked',
  'stableFunc is function-locked'
);

console.log('\n--- Test 10: Change OUTSIDE locked function — no violation ---');
// Modify workInProgress (line 6-8), stableFunc is locked (lines 1-3)
fs.writeFileSync('app.js', `
function stableFunc() {
  return 'I am stable and tested';
}

function workInProgress() {
  return 'actively being edited -- new change';
}
`.trimStart());
const check2 = run(`${CLI} check`);
assert(check2.includes('passed'), 'change outside locked function does not trigger violation');

console.log('\n--- Test 11: Change INSIDE locked function — violation ---');
fs.writeFileSync('app.js', `
function stableFunc() {
  return 'I have been hallucinated';
}

function workInProgress() {
  return 'actively being edited -- new change';
}
`.trimStart());
const violation2 = run(`${CLI} check`, true);
assert(violation2.includes('VIOLATION'), 'change inside locked function triggers violation');
assert(violation2.includes('stableFunc'), 'violation names the locked function');

console.log('\n--- Test 12: Function unlock clears function-level violation ---');
run(`${CLI} unlock app.js:stableFunc "need to update return value for new API"`);
const check3 = run(`${CLI} check`);
assert(check3.includes('passed'), 'check passes after function unlock');

console.log('\n--- Test 13: Lock unknown function fails gracefully ---');
const badLock = run(`${CLI} lock app.js:doesNotExist "testing"`, true);
assert(badLock.includes('not found'), 'locking unknown function fails with clear message');

console.log('\n--- Test 14: scopelock context output ---');
const ctx = run(`${CLI} context "update the WIP function"`);
assert(ctx.includes('SCOPE CONTEXT'), 'context output contains header');

console.log('\n--- Test 15: Test Coverage Gate (Missing Tests) ---');
fs.writeFileSync('feature.js', 'console.log("new logic");\n');
run('git add feature.js');
const testGateOut = run(`${CLI} check --require-tests`, true);
assert(testGateOut.includes('TEST GATE VIOLATION'), 'check catches missing tests when flag is used');

console.log('\n--- Test 16: Test Coverage Gate (Tests Provided) ---');
fs.writeFileSync('feature.test.js', 'console.log("test for logic");\n');
run('git add feature.test.js');
const testGatePass = run(`${CLI} check --require-tests`);
assert(testGatePass.includes('passed'), 'check passes when test files accompany source files');

console.log('\n--- Test 17: Rollback Snapshot Creation ---');
run(`${CLI} snapshot`);
const m4 = JSON.parse(fs.readFileSync('.scopelock.json', 'utf8'));
assert(m4.lastSnapshot === 'clean' || m4.lastSnapshot === 'dirty', 'snapshot state is tracked in manifest');

console.log('\n--- Test 18: Rollback Revert ---');
fs.writeFileSync('rogue.js', 'I am a rogue agent destroying things');
run(`${CLI} revert`);
assert(!fs.existsSync('rogue.js'), 'revert destroys untracked rogue files');
const m5 = JSON.parse(fs.readFileSync('.scopelock.json', 'utf8'));
assert(m5.lastSnapshot === null, 'revert clears the snapshot marker');

console.log('\n--- Test 19: Production Path Lock (superlock) ---');
run(`${CLI} superlock app.js "core auth logic — requires PR approval to modify"`);
const m6 = JSON.parse(fs.readFileSync('.scopelock.json', 'utf8'));
assert(m6.files['app.js'].status === 'superlocked', 'superlock sets status to superlocked');

console.log('\n--- Test 20: superlock blocks regular unlock ---');
const superUnlockOut = run(`${CLI} unlock app.js "trying to bypass"`, true);
assert(superUnlockOut.includes('SUPERLOCKED'), 'regular unlock is blocked on superlocked file');

console.log('\n--- Test 21: superlock blocks scopelock check ---');
fs.appendFileSync('app.js', '\n// rogue addition\n');
const superCheckOut = run(`${CLI} check`, true);
assert(superCheckOut.includes('SUPERLOCKED'), 'check reports SUPERLOCKED violation');
run('git restore app.js');

console.log('\n--- Test 22: sudo-unlock releases a superlock with ticket ---');
run(`${CLI} sudo-unlock app.js --human-approved=JIRA-999 "approved by senior eng for critical hotfix"`);
const m7 = JSON.parse(fs.readFileSync('.scopelock.json', 'utf8'));
assert(m7.files['app.js'].status === 'active', 'sudo-unlock transitions superlocked to active');
const sudoHistory = m7.files['app.js'].history.find(h => h.action === 'sudo-unlocked');
assert(sudoHistory && sudoHistory.humanApproved === 'JIRA-999', 'sudo-unlock logs the human-approved ticket');

console.log('\n--- Test 23: Blast Radius Map ---');
// Make app.js import readme.txt by creating an importer
fs.writeFileSync('importer.js', `import { something } from './app';\n`);
const blastOut = run(`${CLI} blast-radius app.js`);
assert(blastOut.includes('Blast Radius'), 'blast-radius outputs the report header');
assert(blastOut.includes('importer.js'), 'blast-radius correctly identifies importer.js as a dependent');

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log('\n✅  All 23 tests passed.\n');
