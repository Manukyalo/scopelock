const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEST_DIR = path.join(PROJECT_ROOT, '.e2e-test-dir');
const CLI_PATH = path.join(PROJECT_ROOT, 'bin', 'driftlock.js');

// Helper to run commands
function runCmd(cmd, assertFail = false) {
  try {
    const output = execSync(cmd, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      env: { ...process.env, DRIFTLOCK_SKIP_LICENSE_CHECK: '1' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    if (assertFail) {
      console.error(`\n❌ Expected command to fail, but it succeeded: ${cmd}`);
      console.error(`Output: ${output}`);
      process.exit(1);
    }
    return output;
  } catch (error) {
    if (!assertFail) {
      console.error(`\n❌ Command failed: ${cmd}`);
      console.error(error.stdout);
      console.error(error.stderr);
      process.exit(1);
    }
    return error.stdout + error.stderr;
  }
}

// 1. Setup Phase
console.log('--- 1. Setting up Test Repository ---');
if (fs.existsSync(TEST_DIR)) {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TEST_DIR);

// Initialize Git
runCmd('git init');
runCmd('git config user.name "Test User"');
runCmd('git config user.email "test@example.com"');

// Create dummy files
fs.mkdirSync(path.join(TEST_DIR, 'src'));
fs.writeFileSync(path.join(TEST_DIR, 'src', 'utils.js'), '// some utils');
fs.writeFileSync(path.join(TEST_DIR, 'src', 'auth.js'), 'const utils = require("./utils");\nfunction login() {}');
fs.writeFileSync(path.join(TEST_DIR, 'src', 'api.js'), 'const auth = require("./auth");\nfunction fetch() {}');

runCmd('git add .');
runCmd('git commit -m "Initial commit"');
try { runCmd('git branch -M main'); } catch(e) {} // Ensure branch is main
console.log('✅ Setup complete.\n');

// 2. Initialization Phase
console.log('--- 2. Testing Init & Locks ---');
runCmd(`node "${CLI_PATH}" init`);
if (!fs.existsSync(path.join(TEST_DIR, '.driftlock.json'))) {
  console.error('❌ .driftlock.json was not created');
  process.exit(1);
}

runCmd(`node "${CLI_PATH}" lock src/auth.js`);
runCmd(`node "${CLI_PATH}" seal src/api.js`);
console.log('✅ Locks and seals applied.\n');

// Commit the manifest so we have a clean working tree
runCmd('git add .driftlock.json');
runCmd('git commit -m "Add driftlock manifest"');

// 3. Guard Phase (The Watchdog)
console.log('--- 3. Testing Guard (Watchdog) ---');
fs.appendFileSync(path.join(TEST_DIR, 'src', 'auth.js'), '\n// malicious edit');
const guardFailOutput = runCmd(`node "${CLI_PATH}" guard`, true);
if (!guardFailOutput.includes('Scope violations detected')) {
  console.error('❌ Guard did not output expected violation message.');
  process.exit(1);
}
console.log('✅ Guard successfully blocked unauthorized modification.\n');

// Revert the malicious edit
runCmd('git restore src/auth.js');

// 4. Godmode Phase
console.log('--- 4. Testing Godmode ---');
runCmd(`node "${CLI_PATH}" godmode src/auth.js`);
fs.appendFileSync(path.join(TEST_DIR, 'src', 'auth.js'), '\n// massive refactor');
fs.appendFileSync(path.join(TEST_DIR, 'src', 'api.js'), '\n// massive refactor in dependent file');

// Guard should now PASS because the blast radius was unlocked
runCmd(`node "${CLI_PATH}" guard`);
console.log('✅ Godmode successfully bypassed locks for the blast radius.\n');

// Revert refactor and turn off godmode
runCmd('git restore src/auth.js src/api.js');
runCmd(`node "${CLI_PATH}" godmode --off`);

// Guard should fail again if we edit
fs.appendFileSync(path.join(TEST_DIR, 'src', 'auth.js'), '\n// malicious edit 2');
runCmd(`node "${CLI_PATH}" guard`, true);
runCmd('git restore src/auth.js');
console.log('✅ Godmode --off successfully restored the boundary.\n');

// 5. Scout Phase (Drift Detection)
console.log('--- 5. Testing Scout ---');
fs.writeFileSync(path.join(TEST_DIR, 'src', 'rogue.js'), 'const api = require("./api");\n// I am unscoped and importing a sealed file');
const scoutOutput = runCmd(`node "${CLI_PATH}" scout`);
if (!scoutOutput.includes('ARCHITECTURAL DRIFT DETECTED')) {
  console.error('❌ Scout failed to detect the unscoped file importing a sealed file.');
  process.exit(1);
}
console.log('✅ Scout successfully detected architectural drift.\n');

// 6. Audit Phase (CI/CD)
console.log('--- 6. Testing Audit ---');
runCmd('git checkout -b feature/bad-pr');
runCmd('git add src/rogue.js');
runCmd('git commit -m "Add rogue file"');

// Leak a secret
fs.appendFileSync(path.join(TEST_DIR, 'src', 'utils.js'), '\nconst aws_key = "AKIAIOSFODNN7EXAMPLE";');

const auditOutput = runCmd(`node "${CLI_PATH}" audit main`, true);
if (!auditOutput.includes('Scope Audit: FAILED')) {
  console.error('❌ Audit did not fail as expected.');
  process.exit(1);
}
if (!auditOutput.includes('Critical Security Leaks')) {
  console.error('❌ Audit did not detect the AWS secret leak.');
  process.exit(1);
}
console.log('✅ Audit successfully generated a failure report for the PR.\n');

// Teardown
console.log('--- Teardown ---');
fs.rmSync(TEST_DIR, { recursive: true, force: true });
console.log('✅ All E2E tests passed! Driftlock is production-ready. 🚀');
