'use strict';

/**
 * src/scout.js
 *
 * Autonomous repository scanning for architectural drift.
 * Heuristic: Finds 'unscoped' files that import 'sealed' or 'locked' files.
 * These are drift risks because they are highly coupled to protected boundaries
 * but remain unprotected, creating a backdoor for agent hallucinations.
 */

const { getManifest } = require('./manifest');
const { blastRadius } = require('./blast');

function runScout() {
  console.log('🔍 Scouting repository for architectural drift...\n');
  
  const manifest = getManifest();
  const files = Object.entries(manifest.files);

  const protectedFiles = files.filter(([, data]) => data.status === 'locked' || data.status === 'sealed');
  
  if (protectedFiles.length === 0) {
    console.log('✅ No protected files found in manifest. Run `driftlock lock` or `seal` to set boundaries first.');
    return;
  }

  const risks = new Map(); // Unscoped file path -> Array of protected files it imports

  console.log(`Analyzing blast radius of ${protectedFiles.length} protected boundary file(s)...`);

  for (const [protectedFilePath, data] of protectedFiles) {
    const { dependents } = blastRadius(protectedFilePath);
    
    for (const dependent of dependents) {
      const depEntry = manifest.files[dependent];
      
      // If the dependent file is unscoped OR not tracked in the manifest, it's a drift risk
      if (!depEntry || depEntry.status === 'unscoped') {
        if (!risks.has(dependent)) {
          risks.set(dependent, []);
        }
        risks.get(dependent).push({
          file: protectedFilePath,
          status: data.status
        });
      }
    }
  }

  if (risks.size === 0) {
    console.log('\n✅ No architectural drift detected. All dependencies of protected files are also protected.');
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log('⚠️  ARCHITECTURAL DRIFT DETECTED');
  console.log('='.repeat(60) + '\n');
  console.log(`Found ${risks.size} unscoped file(s) tightly coupled to protected boundaries.\n`);

  for (const [unscopedFile, importedProtectedFiles] of risks.entries()) {
    console.log(`📄 [UNSCOPED] ${unscopedFile}`);
    console.log(`   Imports protected modules:`);
    for (const p of importedProtectedFiles) {
      console.log(`   └── [${p.status.toUpperCase()}] ${p.file}`);
    }
    console.log('');
  }

  console.log('---\n💡 Recommendation: Run `driftlock lock` on these files to close the backdoor.\n');
}

module.exports = { runScout };
