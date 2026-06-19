'use strict';

/**
 * src/diff.js
 *
 * Parses `git diff HEAD -- <file>` output to extract the line numbers
 * (1-indexed, in the NEW version of the file) that were added or changed.
 *
 * Returned as a Set<number> for O(1) membership tests.
 */

const { execSync } = require('child_process');

// Matches hunk header: @@ -a,b +c,d @@
// We only care about the new-file start (group 1) and optional length (group 2).
const HUNK_HEADER_RE = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/**
 * @param {string} filePath
 * @returns {Map<number, string>}  1-indexed line numbers -> line content that changed in the new file.
 */
function getChangedLines(filePath) {
  let diffOutput;
  try {
    // Use -- to prevent ambiguity between file names and git flags.
    diffOutput = execSync(`git diff HEAD -- "${filePath}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],  // suppress git's stderr in normal use
    });
  } catch {
    return new Set();
  }

  if (!diffOutput.trim()) return new Map();

  const changedLines = new Map();
  const lines        = diffOutput.split('\n');
  let   currentLine  = 0;

  for (const line of lines) {
    const hunkMatch = line.match(HUNK_HEADER_RE);
    if (hunkMatch) {
      currentLine = parseInt(hunkMatch[1], 10);
      continue;
    }

    if (line.startsWith('+++') || line.startsWith('---')) {
      // File header lines — ignore
      continue;
    }

    if (line.startsWith('+')) {
      // Added/changed line in the new file
      // Strip the leading '+' before saving the content
      changedLines.set(currentLine, line.substring(1));
      currentLine++;
    } else if (line.startsWith('-')) {
      // Deleted line — does NOT advance the new-file line counter
    } else if (!line.startsWith('\\')) {
      // Context line (unchanged) — advances both counters
      currentLine++;
    }
    // `\ No newline at end of file` lines are ignored
  }

  return changedLines;
}

module.exports = { getChangedLines };
