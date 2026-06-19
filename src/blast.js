'use strict';

/**
 * src/blast.js
 *
 * Cross-File Blast Radius Map.
 *
 * Given a file path, scan the entire repo for any file that imports or
 * requires it. Returns an array of dependent file paths.
 *
 * Handles the following import patterns (JS/TS/Python/Go):
 *   import ... from './path/to/file'
 *   require('./path/to/file')
 *   from './path/to/file' import ...   (Python)
 *   import "./path/to/file"
 */

const fs   = require('fs');
const path = require('path');

// Directories that are never part of the blast radius analysis.
const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage',
  '.turbo', '.cache', '__pycache__', '.venv', 'venv', 'target',
]);

/**
 * Recursively walk a directory and collect all files.
 * @param {string} dir
 * @returns {string[]}
 */
function walkDir(dir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

/**
 * Generate all possible import path variants for a given target file.
 * For example, given src/auth/token.ts, this yields:
 *   ./token, ../auth/token, ../../src/auth/token, etc.
 * We match against these from each candidate file's directory.
 *
 * @param {string} targetRelative  e.g. "src/auth/token.ts"
 * @returns {string[]}  stem variants (without extension, for partial matching)
 */
function getTargetStems(targetRelative) {
  const normalized = targetRelative.replace(/\\/g, '/');
  const noExt = normalized.replace(/\.[^.]+$/, '');
  return [normalized, noExt];
}

/**
 * Check if a file's content contains an import/require of the target.
 *
 * @param {string} fileContent
 * @param {string[]} targetStems
 * @param {string} fileDir       Absolute directory of the importing file
 * @param {string} repoRoot      Absolute repo root
 * @param {string} targetAbsolute Absolute path of the target file
 * @returns {boolean}
 */
function fileImportsTarget(fileContent, targetAbsolute, fileDir) {
  // Extract all quoted string literals that look like import paths
  const importPathRe = /(?:from|import|require)\s*\(?['"]([^'"]+)['"]\)?/g;
  let match;
  while ((match = importPathRe.exec(fileContent)) !== null) {
    const importPath = match[1];
    // Only resolve relative paths; skip node_module specifiers
    if (!importPath.startsWith('.')) continue;
    try {
      const resolved = path.resolve(fileDir, importPath);
      // Match with or without extension
      const targetNoExt = targetAbsolute.replace(/\.[^.]+$/, '');
      if (
        resolved === targetAbsolute ||
        resolved === targetNoExt ||
        resolved + path.extname(targetAbsolute) === targetAbsolute
      ) {
        return true;
      }
    } catch {
      // If resolution fails, skip
    }
  }
  return false;
}

/**
 * Compute the full blast radius for a given file.
 *
 * @param {string} targetFile  Relative or absolute path to the file.
 * @returns {{ target: string, dependents: string[], total: number }}
 */
function blastRadius(targetFile) {
  const repoRoot    = process.cwd();
  const targetAbs   = path.resolve(repoRoot, targetFile);
  const targetRel   = path.relative(repoRoot, targetAbs).replace(/\\/g, '/');
  const allFiles    = walkDir(repoRoot);
  const dependents  = [];

  for (const f of allFiles) {
    // Skip the target itself
    if (path.resolve(f) === targetAbs) continue;

    let content;
    try {
      content = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }

    if (fileImportsTarget(content, targetAbs, path.dirname(f))) {
      dependents.push(path.relative(repoRoot, f).replace(/\\/g, '/'));
    }
  }

  return { target: targetRel, dependents, total: dependents.length };
}

/**
 * Print a human-readable blast radius report to stdout.
 *
 * @param {string} targetFile
 */
function printBlastRadius(targetFile) {
  const { target, dependents, total } = blastRadius(targetFile);

  console.log(`\n💥  Blast Radius: ${target}\n`);

  if (total === 0) {
    console.log('   No other files import this file. Safe to modify.\n');
    return;
  }

  console.log(`   ${total} file(s) directly import this file:\n`);
  for (const dep of dependents) {
    console.log(`   → ${dep}`);
  }
  console.log('');
  console.log(`   ⚠️  Modifying '${target}' may impact all ${total} of the above file(s).`);
  console.log(`   Run 'scopelock lock ${target}' to protect it before your session.\n`);
}

module.exports = { blastRadius, printBlastRadius };
