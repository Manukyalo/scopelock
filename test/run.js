const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Go to a test temp dir
const testDir = path.join(__dirname, 'tmp_repo');
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true, force: true });
}
fs.mkdirSync(testDir);
process.chdir(testDir);

console.log('--- Setting up mock repo ---');
execSync('git init');
// Set dummy git config so commit works in CI/temp environments
execSync('git config user.email "test@example.com"');
execSync('git config user.name "Test User"');

fs.writeFileSync('file1.js', 'console.log("hello");');
fs.writeFileSync('file2.js', 'console.log("world");');
execSync('git add .');
execSync('git commit -m "initial"');

console.log('\n--- Testing scopelock init ---');
execSync('node ../../bin/scopelock.js init', { stdio: 'inherit' });

console.log('\n--- Simulating locking file1.js ---');
const manifest = JSON.parse(fs.readFileSync('.scopelock.json', 'utf8'));
manifest.files['file1.js'].status = 'locked';
fs.writeFileSync('.scopelock.json', JSON.stringify(manifest, null, 2));

console.log('\n--- Modifying file1.js (Violation) ---');
fs.writeFileSync('file1.js', 'console.log("hacked");');

console.log('\n--- Testing scopelock check (Expected to fail) ---');
try {
  execSync('node ../../bin/scopelock.js check', { stdio: 'pipe' });
  console.error('FAILED: check should have thrown an error!');
  process.exit(1);
} catch (err) {
  console.log('Successfully caught violation:');
  console.log(err.stderr.toString());
}

console.log('\n--- Testing scopelock unlock ---');
execSync('node ../../bin/scopelock.js unlock file1.js "need to update greeting"', { stdio: 'inherit' });

console.log('\n--- Testing scopelock check (Expected to pass) ---');
execSync('node ../../bin/scopelock.js check', { stdio: 'inherit' });

console.log('\n✅ All tests passed.');
