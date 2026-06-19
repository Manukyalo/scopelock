'use strict';

/**
 * src/context.js
 *
 * Generates a condensed, token-efficient AI context block.
 * The output is designed to be pasted into any AI agent's context window.
 * V2: Surfaces function-level locks alongside file-level locks.
 */

const { getManifest } = require('./manifest');

function generate(task) {
  const manifest = getManifest();
  const files    = Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b));

  const locked   = files.filter(([, v]) => v.status === 'locked');
  const active   = files.filter(([, v]) => v.status === 'active');

  // Files that are unscoped but contain locked functions
  const fnLocked = files.filter(([, v]) => {
    if (v.status === 'locked') return false; // already captured above
    if (!v.functions) return false;
    return Object.values(v.functions).some(f => f.status === 'locked');
  });

  console.log('='.repeat(60));
  console.log('AI AGENT SCOPE CONTEXT — DO NOT IGNORE THESE CONSTRAINTS');
  console.log('='.repeat(60));

  if (task) {
    console.log(`\nTask: ${task}`);
  }

  console.log('\n--- LOCKED (DO NOT MODIFY) ---');
  if (locked.length === 0 && fnLocked.length === 0) {
    console.log('  (none)');
  }
  for (const [filePath, data] of locked) {
    console.log(`  [LOCKED FILE] ${filePath}`);
    if (data.functions) {
      for (const [fnName, fnData] of Object.entries(data.functions)) {
        if (fnData.status === 'locked') {
          console.log(`    └── [LOCKED FUNCTION] ${fnName}()`);
        }
      }
    }
  }
  for (const [filePath, data] of fnLocked) {
    console.log(`  [FILE — partial lock] ${filePath}`);
    for (const [fnName, fnData] of Object.entries(data.functions)) {
      if (fnData.status === 'locked') {
        console.log(`    └── [LOCKED FUNCTION] ${fnName}() — DO NOT MODIFY`);
      }
    }
  }

  console.log('\n--- ACTIVE (In scope for this task) ---');
  if (active.length === 0) {
    console.log('  (none declared — use `scopelock lock` to classify files)');
  }
  for (const [filePath] of active) {
    console.log(`  [ACTIVE] ${filePath}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('INSTRUCTIONS FOR THIS SESSION:');
  console.log('1. You MUST NOT modify any [LOCKED FILE] or [LOCKED FUNCTION].');
  console.log('2. If a locked file or function genuinely needs to change,');
  console.log('   run: scopelock unlock <file>[:<function>] "<reason>"');
  console.log('3. Before committing, run: scopelock check');
  console.log('4. Scope creep = silent regressions. Stay in bounds.');
  console.log('='.repeat(60) + '\n');
}

module.exports = { generate };
