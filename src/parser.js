'use strict';

/**
 * src/parser.js
 *
 * Language-aware function/class extractor.
 * No external dependencies — uses line-by-line regex matching
 * + brace-depth counting for JS/TS and indentation tracking for Python.
 *
 * Returns: Array<{ name: string, startLine: number, endLine: number }>
 * All line numbers are 1-indexed.
 */

const fs   = require('fs');
const path = require('path');

// Extensions we know how to parse. Everything else gets file-level locking only.
const EXTENSION_TO_LANG = {
  '.js':  'javascript',
  '.jsx': 'javascript',
  '.ts':  'typescript',
  '.tsx': 'typescript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py':  'python',
};

// JS / TS patterns — each must capture the function/class name in group 1.
// Order matters: more specific patterns first.
const JS_PATTERNS = [
  // export async function foo(  /  export function foo(  /  function foo(
  /^[\t ]*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*[(<]/,
  // export class Foo  /  class Foo
  /^[\t ]*(?:export\s+)?(?:default\s+)?class\s+(\w+)/,
  // export const foo = async (  /  const foo = (  /  const foo = function(
  /^[\t ]*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\(|function\s*[({(])/,
  // Class method shorthand: foo() {  /  async foo() {
  /^[\t ]+(?:(?:static|async|get|set|public|private|protected|override|abstract)\s+)*(\w+)\s*\([^)]*\)\s*(?::\s*\S+\s*)?\{/,
  // Object method shorthand or TypeScript interface method
  /^[\t ]+(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[\w<>[\]|&, ]+\s*)?\{/,
];

const PY_PATTERNS = [
  /^[\t ]*(?:async\s+)?def\s+(\w+)\s*\(/,
  /^[\t ]*class\s+(\w+)/,
];

// ─── Language detection ───────────────────────────────────────────────────────

function detectLanguage(filePath) {
  return EXTENSION_TO_LANG[path.extname(filePath).toLowerCase()] || null;
}

// ─── End-of-function detection ────────────────────────────────────────────────

/**
 * Walk forward from startLine to find where this function/class ends.
 * Returns a 0-indexed line number.
 */
function findFunctionEnd(lines, startLine, lang) {
  if (lang === 'python') {
    // Python: end when indentation returns to the level of the def/class line
    // or we hit EOF.
    const defLine     = lines[startLine];
    const baseIndent  = (defLine.match(/^(\s*)/) || ['', ''])[1].length;

    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;                          // skip blank lines
      const indent = (line.match(/^(\s*)/) || ['', ''])[1].length;
      if (indent <= baseIndent) return i - 1;
    }
    return lines.length - 1;
  }

  // JS / TS: count braces from the declaration line forward.
  // Caveat: this is naive — string literals and block comments with braces
  // can confuse the counter, but it covers the vast majority of real code.
  let depth     = 0;
  let foundOpen = false;

  for (let i = startLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; foundOpen = true; }
      else if (ch === '}') depth--;
    }
    if (foundOpen && depth === 0) return i;
  }

  return lines.length - 1;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract all top-level and class-level function/method/class declarations
 * from a source file.
 *
 * @param {string} filePath  Absolute or relative path to a source file.
 * @returns {Array<{name: string, startLine: number, endLine: number}>}
 */
function extractFunctions(filePath) {
  const lang = detectLanguage(filePath);
  if (!lang) return [];

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const lines    = content.split('\n');
  const patterns = lang === 'python' ? PY_PATTERNS : JS_PATTERNS;
  const results  = [];

  // Track the last end line to avoid duplicate matches inside the same block
  let lastEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    if (i <= lastEnd) continue;      // already inside a block we catalogued

    for (const pattern of patterns) {
      const match = lines[i].match(pattern);
      if (match && match[1]) {
        const endLine = findFunctionEnd(lines, i, lang);
        results.push({
          name:      match[1],
          startLine: i + 1,          // 1-indexed
          endLine:   endLine + 1,    // 1-indexed
        });
        lastEnd = endLine;
        break;                       // only one pattern fires per line
      }
    }
  }

  return results;
}

module.exports = { extractFunctions, detectLanguage };
