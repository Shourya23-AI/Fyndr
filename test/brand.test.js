// Checks for the brand finder (logos, covers, colours), the safe downloader and the new job sources. No internet needed.  Run:  node test/brand.test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { isPrivateIp, get: realGet } = require('../server/jobs/net');
const B = require('../server/jobs/brand');
const J = require('../scripts/import-jobs');

let pass = 0;
let fail = 0;
const ok = (c, n) => {
    if (c) {
        pass++;
    } else {
        fail++;
        console.log('  FAIL', n);
    }
};
const rejects = async (f, n) => {
    try {
        await f();
        fail++;
        console.log('  FAIL (no error)', n);
    } catch {
        pass++;
    }
};

// ---- tiny image makers (just the headers; that is all the code reads)
const png = (w, h, pad = 0) => {
    const b = Buffer.alloc(33 + pad);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b);
    b.writeUInt32BE(13, 8);
    b.write('IHDR', 12, 'ascii');
    b.writeUInt32BE(w, 16);
    b.writeUInt32BE(h, 20);
    return b;
};
const jpeg = (w, h, pad = 0) => {
    const b = Buffer.alloc(30 + pad);
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0]).copy(b);
    Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08]).copy(b, 8);
    b.writeUInt16BE(h, 13);
    b.writeUInt16BE(w, 15);
    return b;
};
const webpX = (w, h) => {
    const b = Buffer.alloc(40);
    b.write('RIFF', 0, 'ascii');
    b.write('WEBP', 8, 'ascii');
    b.write('VP8X', 12, 'ascii');
    b.writeUIntLE(w - 1, 24, 3);
    b.writeUIntLE(h - 1, 27, 3);
    return b;
};
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';

(async () => {
    // ---- internal addresses are refused
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.9', '172.20.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '224.0.0.1']) {
        ok(isPrivateIp(ip), 'private: ' + ip);
    }
    for (const ip of ['8.8.8.8', '1.1.1.1', '151.101.1.1', '2606:4700:4700::1111']) {
        ok(!isPrivateIp(ip), 'public: ' + ip);
    }
    for (const u of ['http://example.com/', 'https://127.0.0.1/x', 'https://localhost/x', 'https://[::1]/x', 'https://169.254.169.254/latest/meta-data', 'https://example.com:8443/', 'https://user:pw@example.com/', 'ftp://example.com/', 'not a url']) {
        await rejects(() => realGet(u, { timeout: 2000 }), 'downloader refuses ' + u);
    }

    // ---- reading a company page
    const html = `<html><head><title>Acme Robotics | Build &amp; ship</title>
<meta property="og:site_name" content="Acme Robotics"><meta property="og:image" content="/img/hero.jpg"><meta name="theme-color" content="#FF5500">
<link rel="icon" href="/f.ico"><link rel="apple-touch-icon" sizes="180x180" href="/touch.png"><link rel="manifest" href="/site.webmanifest">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Acme Robotics","logo":{"@type":"ImageObject","url":"https://acme.com/logo.svg"}}]}</script></head><body></body></html>`;
    const pg = B.parsePage(html, 'https://acme.com/');
    ok(pg.title === 'Acme Robotics | Build & ship', 'page title decoded');
    ok(pg.metas['og:image'] === '/img/hero.jpg' && pg.metas['theme-color'] === '#FF5500', 'meta tags read');
    ok(pg.links.some(l => l.rel.includes('apple-touch-icon') && l.href === 'https://acme.com/touch.png' && l.sizes === '180x180'), 'icon links read and made absolute');
    ok(pg.ld.logo === 'https://acme.com/logo.svg' && pg.ld.name === 'Acme Robotics', 'schema.org logo read');
    ok(B.belongs('Acme Robotics Pvt Ltd', pg), 'company suffixes like Pvt Ltd do not stop a match');
    ok(B.belongs('Acme Robotics', pg), 'page belongs to the company');
    ok(!B.belongs('Globex', pg), 'page of another company is not accepted');
    ok(!B.belongs('Acme', B.parsePage('<title>acme.com - this domain is for sale</title>', 'https://acme.com/')), 'parked page is not accepted');
    ok(B.hex('#F50') === '#ff5500' && B.hex('red') === '' && B.hex('#12345') === '', 'colours are checked');

    // ---- image checks
    ok(JSON.stringify(B.imageSize(png(180, 90))) === '{"w":180,"h":90}', 'png size');
    ok(JSON.stringify(B.imageSize(jpeg(1200, 630))) === '{"h":630,"w":1200}' || (B.imageSize(jpeg(1200, 630)).w === 1200 && B.imageSize(jpeg(1200, 630)).h === 630), 'jpeg size');
    ok(B.imageSize(webpX(800, 400)).w === 800 && B.imageSize(webpX(800, 400)).h === 400, 'webp size');
    ok(B.sniff(png(10, 10)) === 'image/png' && B.sniff(jpeg(10, 10)) === 'image/jpeg' && B.sniff(Buffer.from(svg)) === 'image/svg+xml', 'real file types are recognised from the bytes');
    ok(B.sniff(Buffer.from('<html><body>hi</body></html>')) === '' && B.sniff(Buffer.from('MZ' + 'x'.repeat(50))) === '', 'a web page or program is not an image');
    ok(B.sniff(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')) === '', 'svg with a script is refused');
    ok(B.sniff(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>')) === '', 'svg with an event handler is refused');
    ok(B.guessHosts('Razorpay Software Pvt Ltd').includes('razorpay.com'), 'domain guesses include name.com');

    // ---- the whole finder with a pretend internet
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brands-'));
    const db = {};
    let saves = 0;
    const calls = [];
    const net = {
        'https://www.wikidata.org/w/api.php?action=wbsearchentities': () => JSON.stringify({ search: [{ id: 'Q1', label: 'Acme Robotics', description: 'American robotics company' }, { id: 'Q2', label: 'Acme', description: 'cartoon brand of the Coyote' }] }),
        'https://www.wikidata.org/w/api.php?action=wbgetentities': () => JSON.stringify({ entities: { Q1: { claims: { P856: [{ rank: 'normal', mainsnak: { datavalue: { value: 'https://www.acme.com/' } } }] } } } }),
        'https://www.acme.com/robots.txt': () => 'User-agent: *\nDisallow: /private/\nDisallow: /img/blocked',
        'https://www.acme.com/': () => html.replace('https://acme.com/logo.svg', 'https://www.acme.com/logo.svg'),
        'https://www.acme.com/site.webmanifest': () => JSON.stringify({ theme_color: '#112233', icons: [{ src: '/m512.png', sizes: '512x512' }] }),
        'https://www.acme.com/logo.svg': () => Buffer.from(svg),
        'https://www.acme.com/touch.png': () => png(180, 180, 500),
        'https://www.acme.com/img/hero.jpg': () => jpeg(1200, 630, 30000)
    };
    const fake = async (url, o) => {
        calls.push(url);
        const key = net[url] ? url : Object.keys(net).find(k => k.includes('wikidata') && url.startsWith(k));
        if (!key) {
            return { url, status: 404, headers: {}, body: Buffer.alloc(0) };
        }
        const v = net[key]();
        return { url, status: 200, headers: {}, body: Buffer.isBuffer(v) ? v : Buffer.from(v) };
    };
    const svc = B.create({ db, save: () => { saves++; }, dir, get: fake, settings: {} });
    const id = await svc.ensure('Acme Robotics');
    ok(id === 'acme-com' && db.brands[id].site === 'https://www.acme.com/', 'official website found through Wikidata and confirmed on the page');
    ok(db.brands[id].logo === 'image/svg+xml' && fs.existsSync(path.join(dir, id + '.logo')), 'logo taken from the site (schema.org logo wins) and stored');
    ok(db.brands[id].cover === 'image/jpeg' && svc.asset(id, 'cover').body.length > 30000, 'cover picture (og:image) stored');
    ok(db.brands[id].color === '#ff5500', 'brand colour read from the page');
    ok(svc.asset(id, 'logo').mime === 'image/svg+xml' && svc.asset('../etc/passwd', 'logo') === null && svc.asset(id, 'x') === null && svc.asset('nope', 'logo') === null, 'files are served only for known brands and kinds');
    const n1 = calls.length;
    ok((await svc.ensure('Acme Robotics Pvt Ltd')) === id && calls.length === n1, 'the same company is not looked up again');
    const f = B.brandFields(db, { brand: id, logo: '', image: '' });
    ok(f.logo === `/api/brand/${id}/logo` && f.image === `/api/brand/${id}/cover` && f.brandColor === '#ff5500', 'listings get picture addresses and colour');
    ok(B.brandFields(db, { brand: id, logo: 'data:image/png;base64,AA', image: 'data:image/png;base64,AA' }).logo === undefined, 'a picture the organization uploaded itself is never replaced');
    ok(Object.keys(B.brandFields(db, { brand: 'missing' })).length === 0 && Object.keys(B.brandFields(db, {})).length === 0, 'no brand = nothing added');
    ok(B.BRAND_URL.test('/api/brand/acme-com/logo') && !B.BRAND_URL.test('/api/brand/../x/logo'), 'picture route pattern is strict');

    // nothing found -> remembered, retried later
    const none = await svc.ensure('Totally Unknown Co');
    const n2 = calls.length;
    ok(none === '' && (await svc.ensure('Totally Unknown Co')) === '' && calls.length === n2, 'a company with no official site found is remembered and not retried at once');

    // robots.txt blocks the cover picture
    net['https://www.acme.com/robots.txt'] = () => 'User-agent: *\nDisallow: /img/';
    const db2 = {};
    const svc2 = B.create({ db: db2, save() { }, dir: fs.mkdtempSync(path.join(os.tmpdir(), 'brands-')), get: fake, settings: {} });
    const id2 = await svc2.ensure('Acme Robotics');
    ok(id2 && db2.brands[id2].logo && !db2.brands[id2].cover, 'a picture the site\'s robots.txt disallows is not downloaded');

    // square og:image (a logo) is not used as a background; blocklist; explicit site
    net['https://www.acme.com/robots.txt'] = () => '';
    net['https://www.acme.com/img/hero.jpg'] = () => jpeg(600, 600, 30000);
    const svc3 = B.create({ db: {}, save() { }, dir: fs.mkdtempSync(path.join(os.tmpdir(), 'brands-')), get: fake, settings: {} });
    const id3 = await svc3.ensure('Acme Robotics');
    ok(id3 && !svc3.asset(id3, 'cover'), 'a square picture is not used as a cover');
    const svc4 = B.create({ db: {}, save() { }, dir: fs.mkdtempSync(path.join(os.tmpdir(), 'brands-')), get: fake, settings: { brandBlocklist: ['acme.com'] } });
    ok((await svc4.ensure('Acme Robotics')) === '', 'a blocklisted company gets no pictures');
    const svc5 = B.create({ db: {}, save() { }, dir: fs.mkdtempSync(path.join(os.tmpdir(), 'brands-')), get: fake, settings: {} });
    ok((await svc5.ensure('Some Other Name', { site: 'https://www.acme.com' })) === 'acme-com', 'a "site" written in the config is used as given');

    // ---- new job sources, with a pretend internet
    const realFetch = globalThis.fetch;
    const hits = [];
    globalThis.fetch = async u => {
        u = String(u);
        hits.push(u);
        const j = d => ({ ok: true, status: 200, json: async () => d, text: async () => JSON.stringify(d) });
        const miss = { ok: false, status: 404, json: async () => ({}), text: async () => '' };
        if (u === 'https://boards-api.greenhouse.io/v1/boards/stripe') {
            return j({ name: 'Stripe', content: '' });
        }
        if (u.startsWith('https://boards-api.greenhouse.io/v1/boards/stripe/jobs')) {
            return j({ jobs: [{ title: 'Software Engineer Intern', location: { name: 'Bengaluru' }, content: 'Intern role', absolute_url: 'https://stripe.com/jobs/1' }, { title: 'Staff Engineer', location: { name: 'Bengaluru' }, content: '', absolute_url: 'https://stripe.com/jobs/2' }] });
        }
        if (u.startsWith('https://api.ashbyhq.com/posting-api/job-board/ashbyco')) {
            return j({ jobs: [{ title: 'Product Intern', location: 'Remote', isListed: true, descriptionPlain: 'Welcome to AshbyCo. Internship.', jobUrl: 'https://jobs.ashbyhq.com/ashbyco/1' }, { title: 'Hidden', isListed: false, jobUrl: 'https://jobs.ashbyhq.com/ashbyco/2' }] });
        }
        if (u.startsWith('https://api.smartrecruiters.com/v1/companies/BigCo/postings')) {
            return j({ totalFound: 1, content: [{ id: '77', name: 'Graduate Trainee', company: { name: 'BigCo', identifier: 'BigCo' }, location: { city: 'Pune', country: 'in' }, experienceLevel: { label: 'Entry Level' } }] });
        }
        return miss;
    };
    try {
        const cache = {};
        const logs = [];
        const rep = { complete: new Set(), failed: [], skipped: [] };
        const items = await J.collect([{ name: 'Stripe', type: 'auto', site: 'stripe.com' }, { name: 'AshbyCo', type: 'ashby', board: 'ashbyco' }, { name: 'BigCo', type: 'smartrecruiters', board: 'BigCo' }, { name: 'Nobody Inc', type: 'auto' }], m => logs.push(m), rep, { atsCache: cache });
        ok(cache.Stripe && cache.Stripe.type === 'greenhouse' && cache.Stripe.board === 'stripe', 'auto: Stripe\'s Greenhouse board found from the name alone and remembered');
        ok(items.some(x => x.orgName === 'Stripe' && x.title === 'Software Engineer Intern' && x.site === 'stripe.com') && !items.some(x => x.title === 'Staff Engineer'), 'auto: jobs fetched and senior ones filtered out');
        ok(rep.complete.has('greenhouse:stripe'), 'auto: the board counts as a complete list (so gone jobs can be closed)');
        ok(items.some(x => x.orgName === 'AshbyCo' && x.source === 'ashby' && x.applyUrl === 'https://jobs.ashbyhq.com/ashbyco/1') && !items.some(x => x.title === 'Hidden'), 'ashby: listed jobs only');
        ok(items.some(x => x.orgName === 'BigCo' && x.source === 'smartrecruiters' && x.applyUrl === 'https://jobs.smartrecruiters.com/BigCo/77' && x.location === 'Pune, India'), 'smartrecruiters: job, place and link');
        ok(rep.skipped.includes('Nobody Inc') && cache['Nobody Inc'] && cache['Nobody Inc'].none, 'auto: a company with no public job board is skipped quietly and remembered');
        const before = hits.length;
        await J.collect([{ name: 'Nobody Inc', type: 'auto' }], () => { }, undefined, { atsCache: cache });
        ok(hits.length === before, 'auto: the "no board" answer is not asked again for a week');
    } finally {
        globalThis.fetch = realFetch;
    }

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => {
    console.error(e);
    process.exit(1);
});
