// Opens every careers link in public/js/features/browse/careers.js and reports the ones that fail.
// Run now and then (needs internet):  node scripts/check-careers-links.js
// A 403 or 429 usually just means the company blocks scripts; open that link in a browser to be sure. Fix real failures in careers.js.
const path = require('path');
const { pathToFileURL } = require('url');
(async () => {
    const { COMPANIES } = await import(pathToFileURL(path.join(__dirname, '..', 'public', 'js', 'features', 'browse', 'careers.js')).href);
    let bad = 0;
    for (const [name, , url] of COMPANIES) {
        try {
            const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0 (Fyndr link check)' } });
            const ok = r.status < 400;
            if (!ok) { bad++; }
            console.log((ok ? 'ok    ' : 'CHECK ') + r.status + '  ' + name + '  ' + url + (r.url !== url ? '  ->  ' + r.url : ''));
        } catch (e) {
            bad++;
            console.log('FAIL   ' + name + '  ' + url + '  (' + (e.cause?.code || e.message) + ')');
        }
    }
    console.log('\n' + (bad ? bad + ' link(s) to look at' : 'all links open'));
    process.exit(bad ? 1 : 0);
})();
