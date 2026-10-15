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
