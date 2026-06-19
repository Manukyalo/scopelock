'use strict';

/**
 * src/manifest.js
 *
 * All reads and writes to .scopelock.json go through this module.
 *
 * Manifest schema (V2):
 * {
 *   "version": 2,
 *   "files": {
 *     "src/auth.ts": {
 *       "status": "unscoped" | "locked" | "active",
 *       "functions": {                          // populated by `scopelock lock`
 *         "validateToken": {
 *           "status": "locked" | "active",
 *           "history": [{ timestamp, action, reason }]
 *         }
 *       },
 *       "history": [{ timestamp, action, reason }]
 *     }
 *   }
 * }
 *
 * V1 manifests (no "version" / no "functions" key) are read transparently.
 */

const fs   = require('fs');
const path = require('path');

const { extractFunctions, detectLanguage } = require('./parser');

const MANIFEST_FILE = '.scopelock.json';
const VERSION       = 2;

// ─── Ignored directories ──────────────────────────────────────────────────────

const IGNORED_DIRS = new Set([
  'node_modules', '.git',     '.next',   '.nuxt',   '.turbo',
  '.vercel',      '.expo',    'dist',    'build',   'out',
  'coverage',     '__pycache__', '.pytest_cache', '.mypy_cache',
  'target',       '.gradle',  '.idea',   '.vscode',
]);

// ─── File walker ──────────────────────────────────────────────────────────────

function walkDir(dir, fileList = []) {
  for (const entry of fs.readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const fullPath = path.join(dir, entry);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

// ─── Manifest I/O ─────────────────────────────────────────────────────────────

function getManifest() {
  if (!fs.existsSync(MANIFEST_FILE)) {
    console.error(`No ${MANIFEST_FILE} found. Run 'scopelock init' first.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
}

function saveManifest(data) {
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(data, null, 2));
}

// Ensure a file entry exists in the manifest, creating it if needed.
function ensureFileEntry(manifest, relativePath) {
  if (!manifest.files[relativePath]) {
    manifest.files[relativePath] = { status: 'unscoped', functions: {}, history: [] };
  }
  if (!manifest.files[relativePath].functions) {
    manifest.files[relativePath].functions = {};
  }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

function init() {
  if (fs.existsSync(MANIFEST_FILE)) {
    console.log(`.scopelock.json already exists. Use 'scopelock status' to view it.`);
    return;
  }

  const files    = walkDir('.');
  const manifest = { version: VERSION, files: {} };
  let   count    = 0;

  for (const f of files) {
    const relativePath = path.relative('.', f).replace(/\\/g, '/');
    if (relativePath === MANIFEST_FILE) continue;
    manifest.files[relativePath] = { status: 'unscoped', functions: {}, history: [] };
    count++;
  }

  saveManifest(manifest);
  console.log(`✅ Initialized ${MANIFEST_FILE} — ${count} source files tracked.`);
  console.log(`   Run 'scopelock lock <file>' to protect files or functions.`);
}

/**
 * Lock a file or a specific function within a file.
 *
 * @param {string} target  "<file>" or "<file>:<functionName>"
 * @param {string} [reason]  Optional reason (defaults to "manually locked")
 */
function lock(target, reason = 'manually locked') {
  const [filePart, funcName] = target.split(':');
  const relativePath = filePart.replace(/\\/g, '/');

  const manifest = getManifest();
  ensureFileEntry(manifest, relativePath);
  const entry = manifest.files[relativePath];

  const historyEntry = {
    timestamp: new Date().toISOString(),
    action:    'locked',
    reason,
  };

  if (funcName) {
    // Function-level lock — parse the file to validate the function exists
    if (!fs.existsSync(filePart)) {
      console.error(`File not found: ${filePart}`);
      process.exit(1);
    }

    const lang = detectLanguage(filePart);
    if (!lang) {
      console.error(
        `Function-level locking is only supported for JS, TS, and Python files.\n` +
        `'${filePart}' is not a supported language. Lock the whole file instead.`
      );
      process.exit(1);
    }

    const fns = extractFunctions(filePart);
    const found = fns.find(f => f.name === funcName);
    if (!found) {
      console.error(
        `Function '${funcName}' not found in ${filePart}.\n` +
        `Known functions: ${fns.map(f => f.name).join(', ') || '(none detected)'}`
      );
      process.exit(1);
    }

    entry.functions[funcName] = {
      status:  'locked',
      history: [historyEntry],
    };
    saveManifest(manifest);
    console.log(`🔒 Locked function '${funcName}' in ${relativePath}.`);
  } else {
    // File-level lock
    entry.status = 'locked';
    entry.history.push(historyEntry);
    saveManifest(manifest);
    console.log(`🔒 Locked ${relativePath}.`);
  }
}

/**
 * Unlock a file or a specific function.
 *
 * @param {string} target  "<file>" or "<file>:<functionName>"
 * @param {string} reason  Mandatory reason string for audit log.
 */
function unlock(target, reason) {
  const [filePart, funcName] = target.split(':');
  const relativePath = filePart.replace(/\\/g, '/');

  const manifest = getManifest();
  ensureFileEntry(manifest, relativePath);
  const entry = manifest.files[relativePath];

  const historyEntry = {
    timestamp: new Date().toISOString(),
    action:    'unlocked',
    reason,
  };

  if (funcName) {
    if (!entry.functions[funcName]) {
      entry.functions[funcName] = { status: 'active', history: [] };
    }
    entry.functions[funcName].status = 'active';
    entry.functions[funcName].history.push(historyEntry);
    saveManifest(manifest);
    console.log(`🔓 Unlocked function '${funcName}' in ${relativePath}. Reason: ${reason}`);
  } else {
    entry.status = 'active';
    entry.history.push(historyEntry);
    saveManifest(manifest);
    console.log(`🔓 Unlocked ${relativePath}. Reason: ${reason}`);
  }
}

/**
 * Print a human-readable summary of the current manifest state.
 */
function status() {
  const manifest = getManifest();
  const files    = Object.entries(manifest.files);

  const locked   = files.filter(([, v]) => v.status === 'locked');
  const active   = files.filter(([, v]) => v.status === 'active');
  const unscoped = files.filter(([, v]) => v.status === 'unscoped');

  // Count locked functions across all files
  let lockedFnCount = 0;
  for (const [, v] of files) {
    if (!v.functions) continue;
    lockedFnCount += Object.values(v.functions).filter(f => f.status === 'locked').length;
  }

  console.log(`\n📋  scopelock status\n`);
  console.log(`  🔒  locked    — ${locked.length} file(s), ${lockedFnCount} function(s)`);
  console.log(`  ✏️   active    — ${active.length} file(s)`);
  console.log(`  ⬜  unscoped  — ${unscoped.length} file(s)\n`);

  if (locked.length > 0) {
    console.log(`Locked files:`);
    for (const [filePath, data] of locked) {
      console.log(`  ${filePath}`);
      if (data.functions) {
        for (const [fnName, fnData] of Object.entries(data.functions)) {
          if (fnData.status === 'locked') {
            console.log(`    └── ${fnName}() [locked]`);
          }
        }
      }
    }
  }

  if (active.length > 0) {
    console.log(`\nActive (in-scope for current task):`);
    for (const [filePath, data] of active) {
      console.log(`  ${filePath}`);
      if (data.functions) {
        for (const [fnName, fnData] of Object.entries(data.functions)) {
          if (fnData.status === 'locked') {
            console.log(`    └── ${fnName}() [locked]`);
          }
        }
      }
    }
  }

  console.log('');
}

module.exports = { init, lock, unlock, status, getManifest, saveManifest };
