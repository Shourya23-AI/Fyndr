// Gives every deploy its own service-worker cache name, so visitors never keep seeing old files after an update.
// Vercel runs this as the build command (see vercel.json). It replaces the __BUILD__ token in public/sw.js with the commit id.
// Locally it does nothing unless you pass --force, so your working copy is never rewritten by accident.
const fs = require('fs');
const path = require('path');
const file = process.env.SW_PATH || path.join(__dirname, '..', 'public', 'sw.js');
if (!process.env.VERCEL && !process.argv.includes('--force')) {
    console.log('stamp-build: not on Vercel, left sw.js alone (use --force to stamp).');
    process.exit(0);
}
const id = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 10) || Date.now().toString(36);
const src = fs.readFileSync(file, 'utf8');
if (!src.includes("const BUILD = '__BUILD__';")) {
    console.log('stamp-build: sw.js has no __BUILD__ token (already stamped?), nothing to do.');
    process.exit(0);
}
fs.writeFileSync(file, src.replace("const BUILD = '__BUILD__';", "const BUILD = '" + id + "';"));
console.log('stamp-build: service-worker cache is now fyndr-' + id);
