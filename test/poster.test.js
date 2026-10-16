// Poster covers: real brand lookups, variety between cards, safe output.  Run: node test/poster.test.js
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
globalThis.document = { querySelector: () => null, querySelectorAll: () => [], createElement: () => ({}), addEventListener() {} };
globalThis.location = { hash: '' };
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = globalThis.localStorage;
(async () => {
    const P = await import('../public/js/features/browse/poster.js');
    const M = await import('../public/js/features/catalog/meta.js');
    // every course provider and job board has a website and a colour, so every catalog card gets a real logo
    const names = [...M.PROVIDERS.map(p => p[0]), ...M.BOARDS.map(b => b[0])];
    const missing = names.filter(n => !P.BRANDS[n]);
    ok(missing.length === 0, 'brand missing for: ' + missing.join(', '));
    ok(Object.values(P.BRANDS).every(([d, c]) => /^[a-z0-9.-]+$/i.test(d) && /^#[0-9a-f]{6}$/i.test(c)), 'brand table shape');
    ok(P.siteOf({ orgName: 'Coursera' }) === 'coursera.org', 'siteOf provider');
    ok(P.siteOf({ orgName: 'Microsoft' }) === 'microsoft.com', 'siteOf careers company');
    ok(P.siteOf({ orgName: 'Tiny Shop', website: 'https://www.tinyshop.in/about' }) === 'tinyshop.in', 'siteOf listing website');
    ok(P.siteOf({ orgName: 'Tiny Shop', website: 'javascript:alert(1)' }) === '', 'unsafe website ignored');
    // variety: 60 jobs from one board still differ in layout and pattern
    const rows = Array.from({ length: 60 }, (_, i) => M.expandJob(['Role ' + i, 'j', 0, 'Pune', 'code', ''], i));
    const looks = new Set(rows.map(l => { const h = P.posterOf(l); return h.match(/data-v="(\d)" data-p="(\d)"/).slice(1).join('-'); }));
    ok(looks.size >= 10, 'posters vary (' + looks.size + ' distinct layout/pattern combos)');
    // escaping
    const evil = P.posterOf({ id: 'x', title: '<img src=x onerror=1>', orgName: '"><script>', type: 'Job' });
    ok(!/<img src=x|<script>/.test(evil), 'title and name are escaped');
    ok(/Coursera/.test(P.posterOf(M.expandCourse(['Python', 0, 'code', 'u', ''], 1))), 'org name on poster');
    console.log(`${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
