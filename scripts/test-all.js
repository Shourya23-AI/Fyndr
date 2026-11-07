// Runs every test file (test/*.test.js) one after the other and stops with an error if any fails. Same on Windows, Mac and Linux:  npm test
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dir = path.join(__dirname, '..', 'test');
const failed = [];
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.test.js')).sort()) {
    console.log('== test/' + f);
    const r = spawnSync(process.execPath, [path.join(dir, f)], { stdio: 'inherit', env: { ...process.env, NODE_NO_WARNINGS: '1' } });
    if (r.status !== 0) {
        failed.push(f);
    }
}
console.log(failed.length ? '\nFAILED: ' + failed.join(', ') : '\nAll test files passed.');
process.exit(failed.length ? 1 : 0);
