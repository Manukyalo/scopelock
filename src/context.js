const { getManifest } = require('./manifest');

function generate(task) {
  const manifest = getManifest();
  
  console.log(`=== AI AGENT CONTEXT ===`);
  if (task) {
    console.log(`Task Scope: ${task}`);
  }
  console.log(`\nProject Manifest Constraints:\n`);
  
  const files = Object.keys(manifest.files).sort();
  
  for (const file of files) {
    const data = manifest.files[file];
    if (data.status === 'locked') {
      console.log(`[LOCKED] ${file} -> DO NOT MODIFY unless task explicitly requires it.`);
    } else if (data.status === 'active') {
      console.log(`[ACTIVE] ${file} -> Currently in scope for edits.`);
    } else {
      console.log(`[UNSCOPED] ${file}`);
    }
  }
  
  console.log(`\n========================`);
  console.log(`INSTRUCTION: You must strictly adhere to the locking status of files. If a file is LOCKED, you must run 'scopelock unlock <file> <reason>' before generating a modification.`);
}

module.exports = { generate };
