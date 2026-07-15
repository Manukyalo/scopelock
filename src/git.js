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
const { detectSecret }  = require('./secrets');

function getViolations(base = 'HEAD', requireTests = false) {
  const manifest = getManifest();
  let diffOutput;

  try {
    diffOutput = execSync(`git diff ${base} --name-only`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    return { error: 'git error — are you inside a git repository with at least one commit?' };
  }

  const changedFiles = diffOutput
    .split('\n')
    .map(f => f.trim())
    .filter(f => f.length > 0);

  if (changedFiles.length === 0) {
    return { violations: [] };
  }

  const violations = [];
  
  // ── Tier -1: Test Coverage Gate ───────────────────────────────────────────
  if (requireTests) {
    const hasSourceChanges = changedFiles.some(f => 
      !f.includes('.test.') && !f.includes('.spec.') && !f.includes('/test/') && !f.includes('/__tests__/') &&
      (f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.py') || f.endsWith('.go') || f.endsWith('.rs'))
    );
    const hasTestChanges = changedFiles.some(f => 
      f.includes('.test.') || f.includes('.spec.') || f.includes('/test/') || f.includes('/__tests__/')
    );
    if (hasSourceChanges && !hasTestChanges) {
      violations.push({
        type: 'test-gate',
        file: 'N/A',
        message: 'TEST GATE VIOLATION: Source logic was modified, but no tests were added or updated. You must write tests to pass `--tests`.'
      });
    }
  }

  for (const file of changedFiles) {
    const normalizedFile = file.replace(/\\/g, '/');
    const entry          = manifest.files[normalizedFile];

    const changedLines = getChangedLines(normalizedFile, base);

    // ── Tier 0: Secret Sentinel ─────────────────────────────────────────────
    if (changedLines.size > 0) {
      const hasOverride = manifest.allowedSecrets && manifest.allowedSecrets[normalizedFile];
      if (!hasOverride) {
        for (const [lineNum, content] of changedLines.entries()) {
          const secretType = detectSecret(content);
          if (secretType) {
            violations.push({
              type: 'secret',
              file: normalizedFile,
              message: `SECRET LEAK [${secretType}] detected in '${normalizedFile}' on line ${lineNum}.`,
            });
            break;
          }
        }
      }
    }

    // ── Tier 1: File-level lock ─────────────────────────────────────────────
    if (entry && (entry.status === 'locked' || entry.status === 'sealed')) {
      const label = entry.status === 'sealed' ? 'SEALED' : 'LOCKED';
      violations.push({
        type: 'file',
        file: normalizedFile,
        message: `File '${normalizedFile}' is ${label}.`,
      });
      continue;
    }

    // ── Tier 2: Function-level lock ─────────────────────────────────────────
    if (!entry || !entry.functions) continue;

    const lockedFunctions = Object.entries(entry.functions)
      .filter(([, fnData]) => fnData.status === 'locked')
      .map(([name]) => name);

    if (lockedFunctions.length === 0) continue;

    const currentFunctions = extractFunctions(normalizedFile);

    for (const lockedFnName of lockedFunctions) {
      const fn = currentFunctions.find(f => f.name === lockedFnName);
      if (!fn) {
        violations.push({
          type:    'function-missing',
          file:    normalizedFile,
          fn:      lockedFnName,
          message: `Locked function '${lockedFnName}' in '${normalizedFile}' was removed or renamed.`,
        });
        continue;
      }

      for (const line of changedLines.keys()) {
        if (line >= fn.startLine && line <= fn.endLine) {
          violations.push({
            type: 'function',
            file: normalizedFile,
            fn:   lockedFnName,
            message: `Locked function '${lockedFnName}' in '${normalizedFile}' was modified (changed line ${line} is inside [${fn.startLine}–${fn.endLine}]).`,
          });
          break;
        }
      }
    }
  }

  return { violations };
}

function guard(args = []) {
  const requireTests = args.includes('--tests');
  const result = getViolations('HEAD', requireTests);

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  const { violations } = result;

  if (violations.length === 0) {
    console.log('✅ Scope guard passed — no locked files or functions were modified.');
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

module.exports = { guard, getViolations };
