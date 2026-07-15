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

const CLI = 'node ../../bin/driftlock.js';

function run(cmd, expectFail = false) {
  try {
    return execSync(cmd, { 
      encoding: 'utf8', 
      stdio: 'pipe',
      env: { ...process.env, DRIFTLOCK_SKIP_LICENSE_CHECK: '1' }
    });
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
assert(fs.existsSync('.driftlock.json'), '.driftlock.json was created');
const manifest = JSON.parse(fs.readFileSync('.driftlock.json', 'utf8'));
assert(manifest.version === 2, 'Manifest is V2 schema');
assert(manifest.files['app.js'] !== undefined, 'app.js is tracked');

console.log('\n--- Test 2: Dependency auto-lock (Dependency Lockdown) ---');
assert(manifest.files['package.json'].status === 'locked', 'package.json is automatically locked on init');

console.log('\n--- Test 3: scopelock status ---');
const statusOut = run(`${CLI} status`);
assert(statusOut.includes('unscoped'), 'status shows unscoped files');

console.log('\n--- Test 4: File-level lock ---');
run(`${CLI} lock readme.txt "stable documentation"`);
const m2 = JSON.parse(fs.readFileSync('.driftlock.json', 'utf8'));
assert(m2.files['readme.txt'].status === 'locked', 'readme.txt is locked');

console.log('\n--- Test 5: File-level violation detection ---');
fs.appendFileSync('readme.txt', 'AI hallucinated this line.\n');
const violation1 = run(`${CLI} guard`, true);
assert(violation1.includes('VIOLATION'), 'guard detects locked file modification');

console.log('\n--- Test 6: File-level unlock clears violation ---');
run(`${CLI} unlock readme.txt "intentional update to docs"`);
const check1 = run(`${CLI} guard`);
assert(check1.includes('passed'), 'guard passes after unlock');
run('git restore readme.txt'); // clean up

console.log('\n--- Test 7: Secret Sentinel detection ---');
fs.appendFileSync('readme.txt', 'const stripe_key = "sk_test_12345abcdeABCDE12345abcd";\n');
const secretViolation = run(`${CLI} guard`, true);
assert(secretViolation.includes('SECRET LEAK'), 'guard detects leaked stripe key');
assert(secretViolation.includes('Stripe Secret Key'), 'guard identifies secret type');

console.log('\n--- Test 8: Secret Sentinel bypass (trust) ---');
run(`${CLI} trust readme.txt "it is a mock key for tests"`);
const secretCheck = run(`${CLI} guard`);
assert(secretCheck.includes('passed'), 'trust successfully bypasses secret sentinel');
run('git restore readme.txt'); // clean up

console.log('\n--- Test 9: Function-level lock ---');
run(`${CLI} lock app.js:stableFunc "tested, production-ready"`);
const m3 = JSON.parse(fs.readFileSync('.driftlock.json', 'utf8'));
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
const check2 = run(`${CLI} guard`);
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
const violation2 = run(`${CLI} guard`, true);
assert(violation2.includes('VIOLATION'), 'change inside locked function triggers violation');
assert(violation2.includes('stableFunc'), 'violation names the locked function');

console.log('\n--- Test 12: Function unlock clears function-level violation ---');
run(`${CLI} unlock app.js:stableFunc "need to update return value for new API"`);
const check3 = run(`${CLI} guard`);
assert(check3.includes('passed'), 'guard passes after function unlock');

console.log('\n--- Test 13: Lock unknown function fails gracefully ---');
const badLock = run(`${CLI} lock app.js:doesNotExist "testing"`, true);
assert(badLock.includes('not found'), 'locking unknown function fails with clear message');

console.log('\n--- Test 14: scopelock context output ---');
const ctx = run(`${CLI} context "update the WIP function"`);
assert(ctx.includes('SCOPE CONTEXT'), 'context output contains header');

console.log('\n--- Test 15: Test Coverage Gate (Missing Tests) ---');
fs.writeFileSync('feature.js', 'console.log("new logic");\n');
run('git add feature.js');
const testGateOut = run(`${CLI} guard --tests`, true);
assert(testGateOut.includes('TEST GATE VIOLATION'), 'guard catches missing tests when flag is used');

console.log('\n--- Test 16: Test Coverage Gate (Tests Provided) ---');
fs.writeFileSync('feature.test.js', 'console.log("test for logic");\n');
run('git add feature.test.js');
const testGatePass = run(`${CLI} guard --tests`);
assert(testGatePass.includes('passed'), 'guard passes when test files accompany source files');

console.log('\n--- Test 17: Rollback Snapshot Creation ---');
run(`${CLI} save`);
const m4 = JSON.parse(fs.readFileSync('.driftlock.json', 'utf8'));
assert(m4.lastSnapshot === 'clean' || m4.lastSnapshot === 'dirty', 'snapshot state is tracked in manifest');

console.log('\n--- Test 18: Rollback Revert ---');
fs.writeFileSync('rogue.js', 'I am a rogue agent destroying things');
run(`${CLI} restore`);
assert(!fs.existsSync('rogue.js'), 'restore destroys untracked rogue files');
const m5 = JSON.parse(fs.readFileSync('.driftlock.json', 'utf8'));
assert(m5.lastSnapshot === null, 'restore clears the snapshot marker');

console.log('\n--- Test 19: Production Path Lock (seal) ---');
run(`${CLI} seal app.js "core auth logic — requires PR approval to modify"`);
const m6 = JSON.parse(fs.readFileSync('.driftlock.json', 'utf8'));
assert(m6.files['app.js'].status === 'sealed', 'seal sets status to sealed');

console.log('\n--- Test 20: seal blocks regular unlock ---');
const superUnlockOut = run(`${CLI} unlock app.js "trying to bypass"`, true);
assert(superUnlockOut.includes('SEALED'), 'regular unlock is blocked on sealed file');

console.log('\n--- Test 21: seal blocks scopelock guard ---');
fs.appendFileSync('app.js', '\n// rogue addition\n');
const superCheckOut = run(`${CLI} guard`, true);
assert(superCheckOut.includes('SEALED'), 'guard reports SEALED violation');
run('git restore app.js');

console.log('\n--- Test 22: unseal releases a seal with ticket ---');
run(`${CLI} unseal app.js --human-approved=JIRA-999 "approved by senior eng for critical hotfix"`);
const m7 = JSON.parse(fs.readFileSync('.driftlock.json', 'utf8'));
assert(m7.files['app.js'].status === 'active', 'unseal transitions sealed to active');
const sudoHistory = m7.files['app.js'].history.find(h => h.action === 'unsealed');
assert(sudoHistory && sudoHistory.humanApproved === 'JIRA-999', 'unseal logs the human-approved ticket');

console.log('\n--- Test 23: Blast Radius Map (impact) ---');
// Make app.js import readme.txt by creating an importer
fs.writeFileSync('importer.js', `import { something } from './app';\n`);
const blastOut = run(`${CLI} impact app.js`);
assert(blastOut.includes('Blast Radius'), 'impact outputs the report header');
assert(blastOut.includes('importer.js'), 'impact correctly identifies importer.js as a dependent');

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log('\n✅  All 23 tests passed.\n');
