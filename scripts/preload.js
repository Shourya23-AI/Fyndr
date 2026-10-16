// Writes <link rel="modulepreload"> tags for every script (and the Firebase SDK files) into public/index.html, so the browser
// downloads them in parallel instead of discovering them one import at a time. Run after adding/removing JS files:  node scripts/preload.js
const fs = require('fs');
const path = require('path');
const PUB = path.join(__dirname, '..', 'public');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []);
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const links = [...['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map(f => `<link rel="modulepreload" href="${SDK}${f}" crossorigin />`),
    ...walk(path.join(PUB, 'js')).map(f => path.relative(PUB, f).split(path.sep).join('/')).sort().map(f => `<link rel="modulepreload" href="${f}" />`)].join('\n    ');
const p = path.join(PUB, 'index.html');
let h = fs.readFileSync(p, 'utf8');
const block = `<!--STATIC-PRELOAD-->\n    ${links}\n    <!--/STATIC-PRELOAD-->`;
h = /<!--STATIC-PRELOAD-->[\s\S]*<!--\/STATIC-PRELOAD-->/.test(h) ? h.replace(/<!--STATIC-PRELOAD-->[\s\S]*<!--\/STATIC-PRELOAD-->/, block) : h.replace('<!--PRELOAD-->', '<!--PRELOAD-->\n    ' + block);
fs.writeFileSync(p, h);
console.log('preload tags written');

// precache.json: every file the service worker saves on the first visit, so the whole site (scripts, styles, catalogs) is on the device
// after one load and every page change after that is instant. Re-run this script after adding files.
const all = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? all(path.join(d, e.name)) : [path.join(d, e.name)]);
const rel = f => path.relative(PUB, f).split(path.sep).join('/');
const keep = rel => /^(js\/.+\.js|css\/app\.css|catalog\/.+\.json|icons\/.+\.(png|svg)|favicon\.svg|config\/(firebase-config|phone-email)\.json)$/.test(rel);
const list = ['index.html', ...all(PUB).map(rel).filter(keep).sort()];
fs.writeFileSync(path.join(PUB, 'precache.json'), JSON.stringify(list));
console.log('precache.json:', list.length, 'files');
