'use strict';

/**
 * src/godmode.js
 *
 * Temporarily overrides locks across a file's entire blast radius
 * to allow for major cross-file refactoring. Restores exact prior state when disabled.
 */

const { getManifest, saveManifest } = require('./manifest');
const { blastRadius } = require('./blast');

function ensureFileEntry(manifest, relativePath) {
  if (!manifest.files[relativePath]) {
    manifest.files[relativePath] = { 
      status: 'unscoped', 
      functions: {}, 
      history: []
    };
  }
  if (!manifest.files[relativePath].functions) {
    manifest.files[relativePath].functions = {};
  }
}

/**
 * Enable Godmode for a specific file and its blast radius.
 * @param {string} targetFile
 */
function enable(targetFile) {
  const manifest = getManifest();

  if (manifest.godmodeBackup) {
    console.error('❌ Godmode is already active! Run `driftlock godmode --off` to restore normal state before starting a new session.');
    process.exit(1);
  }

  const { target, dependents, total } = blastRadius(targetFile);

  if (total === 0) {
    console.log(`ℹ️ '${target}' has no dependents. Godmode will only unlock the target itself.`);
  }

  // Backup current files state
  manifest.godmodeBackup = JSON.parse(JSON.stringify(manifest.files));

  const filesToUnlock = [target, ...dependents];

  let unlockedCount = 0;
  for (const file of filesToUnlock) {
    const normalizedFile = file.replace(/\\/g, '/');
    ensureFileEntry(manifest, normalizedFile);
    
    const entry = manifest.files[normalizedFile];
    
    // We unlock it fully, overriding even 'sealed' files temporarily.
    entry.status = 'active';
    
    // Unlock all functions within it
    if (entry.functions) {
      for (const fn of Object.values(entry.functions)) {
        fn.status = 'active';
      }
    }
    
    // Add audit history for the godmode session
    entry.history.push({
      timestamp: new Date().toISOString(),
      action: 'godmode_enabled',
      reason: `Godmode session triggered for ${target}`
    });
    
    unlockedCount++;
  }

  saveManifest(manifest);

  console.log(`\n🌩️  GODMODE ENABLED for '${target}'\n`);
  console.log(`  🔓 Unlocked ${unlockedCount} file(s) across its blast radius.`);
  console.log(`  🛡️  Pre-commit guard is still active for files outside this radius.`);
  console.log(`\n  When finished, run: driftlock godmode --off\n`);
}

/**
 * Disable Godmode and restore previous locks.
 */
function disable() {
  const manifest = getManifest();

  if (!manifest.godmodeBackup) {
    console.error('❌ Godmode is not currently active.');
    process.exit(1);
  }

  // Restore state
  manifest.files = manifest.godmodeBackup;
  delete manifest.godmodeBackup;

  saveManifest(manifest);

  console.log(`✅ GODMODE DISABLED. All locks and seals have been perfectly restored.`);
}

module.exports = { enable, disable };
