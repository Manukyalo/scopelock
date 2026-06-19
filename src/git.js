const { execSync } = require('child_process');
const { getManifest } = require('./manifest');

function check() {
  const manifest = getManifest();
  
  try {
    // Get list of changed files (unstaged + staged)
    const diffOutput = execSync('git diff HEAD --name-only', { encoding: 'utf8' });
    const changedFiles = diffOutput.split('\n').map(f => f.trim()).filter(f => f.length > 0);
    
    if (changedFiles.length === 0) {
      console.log('No git diff found. Scope check passed.');
      return;
    }
    
    let violationFound = false;
    
    for (const file of changedFiles) {
      // Normalize slashes for cross-platform checking
      const normalizedFile = file.replace(/\\/g, '/');
      const data = manifest.files[normalizedFile];
      
      if (data && data.status === 'locked') {
        console.error(`❌ VIOLATION: File '${normalizedFile}' is LOCKED but was modified in git diff.`);
        violationFound = true;
      }
    }
    
    if (violationFound) {
      console.error('\nScope check failed. Please revert locked files or run `scopelock unlock <file> <reason>` if edits are intentional.');
      process.exit(1);
    } else {
      console.log('✅ Scope check passed. No locked files modified.');
    }
  } catch (err) {
    console.error('Git error. Are you in a git repository or is there no HEAD yet?', err.message);
    process.exit(1);
  }
}

module.exports = { check };
