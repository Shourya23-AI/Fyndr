// Content-Security-Policy guard: the pages must work with NO inline script, so script-src can stay free of 'unsafe-inline'.
// If someone adds an inline <script>, an onclick="" / onchange="" attribute or a javascript: link, this fails before it ships.
// Also checks that the service worker does not download the two big catalogs on first visit.  Run:  node test/csp.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const PUB = path.join(__dirname, '..', 'public');
const read = f => fs.readFileSync(path.join(PUB, f), 'utf8');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

const index = read('index.html');
const cb = read('phone-callback.html');
const csp = html => (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
const directive = (policy, name) => ((policy.split(';').map(s => s.trim()).find(s => s.startsWith(name + ' '))) || '');

// 1) the policies
const main = csp(index);
ok(main.length > 0, 'index.html has a CSP');
ok(!/unsafe-inline|unsafe-eval/.test(directive(main, 'script-src')), "index.html script-src has no 'unsafe-inline' / 'unsafe-eval'");
ok(directive(main, 'script-src').includes("'self'"), 'script-src still allows own files');
ok(/frame-ancestors/.test(main) === false, 'frame-ancestors is not in a <meta> CSP (browsers ignore it there; the server sends it as a header)');
const cbp = csp(cb);
ok(cbp.includes("default-src 'none'") && !/unsafe-inline/.test(directive(cbp, 'script-src')), 'phone-callback.html has its own strict CSP');

// 2) no inline script, no inline event attributes, no javascript: links, in any page
const inlineScript = /<script(?![^>]*\ssrc=)[^>]*>\s*\S/i;
for (const [name, html] of [['index.html', index], ['phone-callback.html', cb], ['app.html', read('app.html')]]) {
    ok(!inlineScript.test(html), name + ' has no inline <script>');
    ok(!/\son[a-z]{3,14}\s*=\s*["']/i.test(html), name + ' has no inline on...="" handler');
    ok(!/href\s*=\s*["']\s*javascript:/i.test(html), name + ' has no javascript: link');
}
// ...and none inside the HTML that the scripts build (template strings)
const bad = [];
for (const f of walk(path.join(PUB, 'js')).filter(x => x.endsWith('.js'))) {
    // comment-only lines may talk about javascript: links or onclick; real code and template strings may not
    const src = fs.readFileSync(f, 'utf8').split('\n').filter(l => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
    if (/<[a-z][^>]*\son[a-z]{3,14}=\\?["']/i.test(src) || /href=\\?["']\s*javascript:/i.test(src)) {
        bad.push(path.relative(PUB, f));
    }
}
ok(bad.length === 0, 'no inline handler inside script-built HTML: ' + bad.join(', '));

// 3) boot.js does what the two inline scripts and the font onload used to do
function boot({ stored, dark, links }) {
    const listeners = {};
    const sandbox = {
        localStorage: stored ? { theme: stored } : {},
        matchMedia: () => ({ matches: dark }),
        addEventListener: (t, fn) => { listeners[t] = fn; },
        document: { documentElement: { dataset: {} }, querySelectorAll: () => links }
    };
    vm.runInNewContext(read('boot.js'), sandbox);
    return { theme: sandbox.document.documentElement.dataset.theme, listeners, window: sandbox.window };
}
ok(boot({ stored: 'light', dark: true, links: [] }).theme === 'light', 'saved theme wins');
ok(boot({ dark: true, links: [] }).theme === 'dark' && boot({ dark: false, links: [] }).theme === 'light', 'system theme is the default');
const pending = { media: 'print', sheet: null, addEventListener(t, fn) { this.fire = fn; } };
const loaded = { media: 'print', sheet: {}, addEventListener() {} };
boot({ dark: false, links: [pending, loaded] });
ok(loaded.media === 'all', 'a font stylesheet that already loaded is switched on at once');
ok(pending.media === 'print' && (pending.fire(), pending.media === 'all'), 'a pending one is switched on when it loads');
ok(typeof boot({ dark: false, links: [] }).listeners.beforeinstallprompt === 'function', 'install prompt listener is registered');
ok(/data-async-css/.test(index) && !/onload=/.test(index), 'font link uses data-async-css instead of onload');

// 4) service worker shell and precache list
const pre = JSON.parse(read('precache.json'));
ok(!pre.some(f => f.startsWith('catalog/')), 'the 1.8 MB catalogs are not downloaded on first visit');
ok(pre.includes('boot.js') && pre.includes('css/app.css') && pre.includes('index.html'), 'boot.js, css and index are precached');
ok(/SHELL = \[[^\]]*'boot\.js'/.test(read('sw.js')), 'boot.js is in the service worker shell');
for (const f of pre) {
    ok(fs.existsSync(path.join(PUB, f)), 'precached file exists: ' + f);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
