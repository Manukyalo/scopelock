'use strict';

/**
 * src/git.js
 *
 * Scope violation checker — V2.
 *
 * Two tiers of enforcement:
 *   1. File-level:     Any changed file whose manifest status is 'locked' → violation.
 *   2. Function-level: Any changed file that has locked functions →
 *                      parse the diff for changed line numbers, re-extract
 *                      function boundaries from the current file, and flag
 *                      any changed line that falls inside a locked function.
 *
 * Exits 1 if any violation found. Wireable as a pre-commit hook.
 */

const { execSync }      = require('child_process');
const { getManifest }   = require('./manifest');
const { getChangedLines } = require('./diff');
const { extractFunctions } = require('./parser');

function check() {
  const manifest = getManifest();
  let diffOutput;

  try {
    diffOutput = execSync('git diff HEAD --name-only', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    console.error('git error — are you inside a git repository with at least one commit?');
    console.error(err.message);
    process.exit(1);
  }

  const changedFiles = diffOutput
    .split('\n')
    .map(f => f.trim())
    .filter(f => f.length > 0);

  if (changedFiles.length === 0) {
    console.log('✅ Scope check passed — no changes detected.');
    return;
  }

  const violations = [];

  for (const file of changedFiles) {
    const normalizedFile = file.replace(/\\/g, '/');
    const entry          = manifest.files[normalizedFile];

    // ── Tier 1: File-level lock ─────────────────────────────────────────────
    if (entry && entry.status === 'locked') {
      violations.push({
        type: 'file',
        file: normalizedFile,
        message: `File '${normalizedFile}' is LOCKED.`,
      });
      continue; // No need to check functions if the whole file is locked
    }

    // ── Tier 2: Function-level lock ─────────────────────────────────────────
    if (!entry || !entry.functions) continue;

    const lockedFunctions = Object.entries(entry.functions)
      .filter(([, fnData]) => fnData.status === 'locked')
      .map(([name]) => name);

    if (lockedFunctions.length === 0) continue;

    // Get the line numbers that changed in this specific file
    const changedLines = getChangedLines(normalizedFile);
    if (changedLines.size === 0) continue;

    // Re-extract function boundaries from the current on-disk file
    const currentFunctions = extractFunctions(normalizedFile);

    for (const lockedFnName of lockedFunctions) {
      const fn = currentFunctions.find(f => f.name === lockedFnName);
      if (!fn) {
        // Function was deleted or renamed — this itself is a violation
        violations.push({
          type:    'function-missing',
          file:    normalizedFile,
          fn:      lockedFnName,
          message: `Locked function '${lockedFnName}' in '${normalizedFile}' was removed or renamed.`,
        });
        continue;
      }

      // Check if any changed line falls within the function's boundaries
      for (const line of changedLines) {
        if (line >= fn.startLine && line <= fn.endLine) {
          violations.push({
            type: 'function',
            file: normalizedFile,
            fn:   lockedFnName,
            message:
              `Locked function '${lockedFnName}' in '${normalizedFile}' was modified ` +
              `(changed line ${line} is inside [${fn.startLine}–${fn.endLine}]).`,
          });
          break; // One violation per function is enough
        }
      }
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  if (violations.length === 0) {
    console.log('✅ Scope check passed — no locked files or functions were modified.');
    return;
  }

  console.error(`\n❌ Scope violations detected:\n`);
  for (const v of violations) {
    console.error(`   VIOLATION: ${v.message}`);
  }
  console.error(
    `\n${violations.length} violation(s) found.\n` +
    `  • Revert unintentional changes with: git restore <file>\n` +
    `  • Explicitly unlock with:            scopelock unlock <file>[:<function>] "<reason>"`
  );

  process.exit(1);
}

module.exports = { check };
