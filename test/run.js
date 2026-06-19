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

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log('\n✅  All 14 tests passed.\n');
