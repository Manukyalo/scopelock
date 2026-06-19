const fs = require('fs');
const path = require('path');

const MANIFEST_FILE = '.scopelock.json';

// Directories that are never meaningful to track — build artifacts,
// caches, and generated output that no agent should be modifying.
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  '.turbo',
  '.vercel',
  '.expo',
  'dist',
  'build',
  'out',
  'coverage',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  'target',       // Rust / Java Maven
  '.gradle',
  '.idea',
  '.vscode',
]);

function walkDir(dir, fileList = []) {
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
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

function init() {
  if (fs.existsSync(MANIFEST_FILE)) {
    console.log('.scopelock.json already exists. Run `scopelock status` to view the manifest.');
    return;
  }

  const files = walkDir('.');
  const manifest = { files: {} };

  let count = 0;
  for (const f of files) {
    const relativePath = path.relative('.', f).replace(/\\/g, '/');
    // Never track the manifest file itself
    if (relativePath === MANIFEST_FILE) continue;
    manifest.files[relativePath] = { status: 'unscoped', history: [] };
    count++;
  }

  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  console.log(`✅ Initialized ${MANIFEST_FILE} — ${count} source files tracked.`);
  console.log(`   Set files to 'locked' in .scopelock.json to protect them from AI edits.`);
}

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

function unlock(file, reason) {
  const manifest = getManifest();
  const targetFile = file.replace(/\\/g, '/');
  
  if (!manifest.files[targetFile]) {
    manifest.files[targetFile] = { status: 'active', history: [] };
  }
  
  manifest.files[targetFile].status = 'active';
  manifest.files[targetFile].history.push({
    timestamp: new Date().toISOString(),
    action: 'unlocked',
    reason
  });
  
  saveManifest(manifest);
  console.log(`Unlocked ${targetFile}. Reason: ${reason}`);
}

module.exports = { init, getManifest, unlock, saveManifest };
