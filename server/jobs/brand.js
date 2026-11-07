// Brand finder: for each company it finds the OFFICIAL website, then that site's own logo, cover picture and brand colour. Nothing is hardcoded per company.
//
// How the official site is found (first hit that checks out wins):
//   1. "site" in config/companies.json, if you wrote one (your decision, used as is)
//   2. Wikidata (open data): the company's "official website" entry
//   3. educated guesses from the name (name.com, name.in, name.io ...)
//   Wikidata and guesses are only accepted when the page's own title / site name / schema.org name contains the company name
//   (and the page does not look like a parked "domain for sale" page).
// What is taken from that site (only pages and files its robots.txt allows):
//   logo   schema.org Organization logo > apple-touch-icon > SVG icon > manifest icons > other icons > /apple-touch-icon.png > /favicon.ico
//   cover  og:image / twitter:image, only when it is wide enough and shaped like a banner (a square logo makes a bad background)
//   colour theme-color / manifest theme_color (used to paint the card when there is no cover picture)
// Files are kept in DATA_DIR/brands and shown from our own server (/api/brand/<id>/logo|cover): visitors never contact the company's
// servers, and a company that changes its logo is picked up on the next refresh (every 30 days; failed lookups are retried after 3 days).
// config/import-settings.json: "brands": false turns this off, "brandBlocklist": ["example.com"] skips companies that asked not to be shown.
const fs = require('fs');
const path = require('path');
const netmod = require('./net');
const { robotsAllows } = require('../../scripts/import-jobs');

const DAY = 864e5;
const OK_DAYS = 30;
const RETRY_DAYS = 3;
const LIMITS = { logo: 300e3, cover: 400e3, html: 1.5e6 };
const MIME_OK = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon']);

// ---- names ----
const STOP = /\b(pvt|private|ltd|limited|inc|incorporated|llc|llp|corp|corporation|co|company|plc|gmbh|technologies|technology|software|solutions|services|india)\b/g;
const norm = s => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const core = s => norm(s).replace(STOP, ' ').replace(/\s+/g, ' ').trim() || norm(s);
const joined = s => norm(s).replace(/ /g, '');
const PARKED = /domain (is )?(for sale|parked|available)|buy this domain|this domain may be for sale|hugedomains|sedo\.com|godaddy\.com\/domains|parked free/i;
const TLDS = ['com', 'in', 'io', 'co', 'ai', 'org', 'co.in', 'net'];
const guessHosts = name => {
    const full = joined(name);
    const short = core(name).replace(/ /g, '');
    const hyph = core(name).replace(/ /g, '-');
    const slugs = [...new Set([full, short, hyph])].filter(s => s.length >= 3);
    const out = [];
    for (const t of TLDS) {
        for (const s of slugs) {
            out.push(`${s}.${t}`);
        }
    }
    return out.slice(0, 10);
};

// ---- html ----
const dec = s => String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const attrsOf = tag => {
    const o = {};
    for (const m of tag.matchAll(/([^\s=<>"'/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
        o[m[1].toLowerCase()] = dec(m[2] ?? m[3] ?? m[4] ?? '');
    }
    return o;
};
const absUrl = (href, base) => {
    try {
        const u = new URL(href, base);
        if (u.protocol === 'http:') {
            u.protocol = 'https:';
        }
        return u.protocol === 'https:' ? u.href : '';
    } catch {
        return '';
    }
};
const sizeOf = s => {
    const m = String(s || '').match(/(\d+)\s*x\s*(\d+)/i);
    return m ? Math.min(+m[1], +m[2]) : /any/i.test(s || '') ? 512 : 0;
};
const hex = v => {
    const m = String(v || '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) {
        return '';
    }
    const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
    return '#' + h.toLowerCase();
};
const lum = h => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
function parsePage(html, base) {
    const text = String(html || '').slice(0, LIMITS.html);
    const end = text.search(/<\/head>/i);
    const head = end > 0 ? text.slice(0, end) : text.slice(0, 300000);
    const metas = {};
    const links = [];
    for (const tag of head.match(/<(?:meta|link)\b[^>]*>/gi) || []) {
        const a = attrsOf(tag);
        if (/^<meta/i.test(tag)) {
            const k = String(a.property || a.name || '').toLowerCase();
            if (k && a.content !== undefined && !(k in metas)) {
                metas[k] = a.content;
            }
        } else if (a.href) {
            links.push({ rel: String(a.rel || '').toLowerCase().split(/\s+/), href: absUrl(a.href, base), sizes: a.sizes || '', type: (a.type || '').toLowerCase() });
        }
    }
    const title = dec(((head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim());
    const ld = { name: '', logo: '' };
    const walk = n => {
        if (Array.isArray(n)) {
            return n.forEach(walk);
        }
        if (n && typeof n === 'object') {
            const t = [].concat(n['@type'] || []).join(' ');
            if (/Organization|Corporation|LocalBusiness|EducationalOrganization/.test(t)) {
                ld.name = ld.name || (typeof n.name === 'string' ? n.name : '');
                const lg = n.logo && (typeof n.logo === 'string' ? n.logo : n.logo.url || n.logo.contentUrl);
                ld.logo = ld.logo || (lg ? absUrl(lg, base) : '');
            }
            walk(n['@graph'] || []);
        }
    };
    for (const m of text.slice(0, 400000).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
            walk(JSON.parse(m[1]));
        } catch { }
    }
    return { title, metas, links, ld, base };
}

// Does this page belong to the company we are looking for?
function belongs(name, page) {
    const seen = [page.title, page.metas['og:site_name'], page.metas['og:title'], page.metas['application-name'], page.ld.name].filter(Boolean).join(' ');
    if (PARKED.test(seen)) {
        return false;
    }
    const hay = joined(seen);
    return [joined(name), core(name).replace(/ /g, '')].some(n => n.length >= 3 && hay.includes(n));
}

// ---- images ----
function imageSize(b) {
    try {
        if (b.length > 24 && b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') {
            return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
        }
        if (b.toString('ascii', 0, 3) === 'GIF') {
            return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
        }
        if (b[0] === 0xFF && b[1] === 0xD8) {
            let i = 2;
            while (i + 9 < b.length) {
                if (b[i] !== 0xFF) {
                    i++;
                    continue;
                }
                const m = b[i + 1];
                if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) {
                    i += 2;
                    continue;
                }
                if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
                    return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
                }
                i += 2 + b.readUInt16BE(i + 2);
            }
            return null;
        }
        if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
            const t = b.toString('ascii', 12, 16);
            if (t === 'VP8X') {
                return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
            }
            if (t === 'VP8 ') {
                return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
            }
            if (t === 'VP8L') {
                const v = b.readUInt32LE(21);
                return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 };
            }
        }
    } catch { }
    return null;
}
// What kind of file is this really? Decided from the first bytes, never from the file name or the server's label.
function sniff(b) {
    if (!b || b.length < 8) {
        return '';
    }
    if (b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') {
        return 'image/png';
    }
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) {
        return 'image/jpeg';
    }
    if (b.toString('ascii', 0, 3) === 'GIF') {
        return 'image/gif';
    }
    if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
        return 'image/webp';
    }
    if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) {
        return 'image/x-icon';
    }
    const head = b.toString('utf8', 0, Math.min(b.length, 2048)).trimStart();
    if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)?(<!doctype svg[^>]*>\s*)?<svg[\s>]/i.test(head)) {
        const all = b.toString('utf8');
        if (/<script|<foreignObject|<iframe|<embed|<object|\son[a-z]+\s*=|javascript:|data:text\/html|(?:href|src)\s*=\s*["']\s*https?:/i.test(all)) {
            return '';
        }
        return 'image/svg+xml';
    }
    return '';
}

// ---- the service ----
function create({ db, save, dir, get = netmod.get, now = Date.now, log = () => { }, settings = {} }) {
    fs.mkdirSync(dir, { recursive: true });
    db.brands = db.brands || {};
    db.brandMap = db.brandMap || {};
    const blocked = new Set((settings.brandBlocklist || []).map(s => String(s).toLowerCase().replace(/^www\./, '')));
    const robots = new Map();
    let lastCall = 0;
    const pace = async () => {
        const wait = lastCall + 250 - Date.now();
        lastCall = Date.now() + Math.max(wait, 0);
        if (wait > 0) {
            await new Promise(r => setTimeout(r, wait));
        }
    };
    const fetchIt = async (url, o) => {
        await pace();
        return get(url, o);
    };
    const robotsOk = async url => {
        let u;
        try {
            u = new URL(url);
        } catch {
            return false;
        }
        if (!robots.has(u.origin)) {
            let txt = '';
            try {
                const r = await fetchIt(u.origin + '/robots.txt', { maxBytes: 300e3, accept: 'text/plain' });
                txt = r.status === 200 ? r.body.toString('utf8') : '';
            } catch { }
            robots.set(u.origin, txt);
        }
        return robotsAllows(robots.get(u.origin), u.pathname + u.search);
    };
    const text = async url => {
        if (!(await robotsOk(url))) {
            throw new Error('robots.txt');
        }
        const r = await fetchIt(url, { maxBytes: LIMITS.html, accept: 'text/html,application/json' });
        if (r.status !== 200) {
            throw new Error('status ' + r.status);
        }
        return { url: r.url, text: r.body.toString('utf8') };
    };
    const image = async (url, kind) => {
        if (!(await robotsOk(url))) {
            return null;
        }
        const r = await fetchIt(url, { maxBytes: LIMITS[kind], accept: 'image/*' });
        const mime = r.status === 200 ? sniff(r.body) : '';
        return MIME_OK.has(mime) ? { mime, body: r.body, size: imageSize(r.body) } : null;
    };

    async function loadHome(site, name, verify) {
        const r = await text(site);
        const page = parsePage(r.text, r.url);
        if (verify && !belongs(name, page)) {
            return null;
        }
        return page;
    }
    async function viaWikidata(name) {
        const q = u => get(u, { maxBytes: 400e3, accept: 'application/json' }).then(r => JSON.parse(r.body.toString('utf8')));
        const s = await q(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&type=item&limit=7&format=json`);
        const want = core(name);
        const items = (s.search || []).filter(x => /compan|corporat|business|startup|enterprise|bank|retail|brand|firm|organi[sz]ation|platform|software|technology|fintech|e-commerce|conglomerate|manufactur/i.test(x.description || '')
            && [core(x.label), norm(x.label)].some(l => l.length >= 2 && (l === want || l.includes(want) || want.includes(l)))).slice(0, 4);
        if (!items.length) {
            return [];
        }
        const e = await q(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${items.map(i => i.id).join('|')}&props=claims&format=json`);
        const urls = [];
        for (const i of items) {
            const c = (((e.entities || {})[i.id] || {}).claims || {}).P856 || [];
            const best = c.find(x => x.rank === 'preferred') || c[0];
            const v = best && best.mainsnak && best.mainsnak.datavalue && best.mainsnak.datavalue.value;
            const a = v && absUrl(v, 'https://x.invalid/');
            if (a) {
                urls.push(a);
            }
        }
        return urls;
    }
    async function findSite(name, hints) {
        if (hints.site) {
            const u = absUrl(/^https?:/i.test(hints.site) ? hints.site : 'https://' + hints.site, 'https://x.invalid/');
            return u ? { page: await loadHome(u, name, false) } : null;
        }
        let wiki = [];
        try {
            wiki = await viaWikidata(name);
        } catch (e) {
            log(`  brand ${name}: wikidata lookup failed (${e.message})`);
        }
        for (const u of [...wiki, ...guessHosts(name).map(h => 'https://' + h + '/')]) {
            try {
                const page = await loadHome(u, name, true);
                if (page) {
                    return { page };
                }
            } catch { }
        }
        return null;
    }

    async function discover(name, hints) {
        const found = await findSite(name, hints);
        if (!found) {
            return null;
        }
        const { page } = found;
        const origin = new URL(page.base).origin;
        const host = new URL(page.base).hostname.replace(/^www\./, '');
        if (blocked.has(host)) {
            return null;
        }
        // manifest: more icons + theme colour
        let man = null;
        const ml = page.links.find(l => l.rel.includes('manifest') && l.href);
        if (ml) {
            try {
                man = JSON.parse((await text(ml.href)).text);
            } catch { }
        }
        const cands = [];
        if (page.ld.logo) {
            cands.push({ url: page.ld.logo, score: 90 });
        }
        for (const l of page.links) {
            if (l.rel.some(r => r.startsWith('apple-touch-icon'))) {
                cands.push({ url: l.href, score: 80 + Math.min(sizeOf(l.sizes), 512) / 100 });
            } else if (l.rel.includes('icon') || l.rel.includes('shortcut')) {
                const svg = /svg/.test(l.type) || /\.svg(\?|$)/i.test(l.href);
                cands.push({ url: l.href, score: svg ? 75 : 50 + Math.min(sizeOf(l.sizes), 256) / 20 });
            }
        }
        for (const i of (man && man.icons) || []) {
            const u = i.src && absUrl(i.src, ml.href);
            if (u) {
                cands.push({ url: u, score: 70 + Math.min(sizeOf(i.sizes), 512) / 100 });
            }
        }
        cands.push({ url: origin + '/apple-touch-icon.png', score: 40 }, { url: origin + '/favicon.ico', score: 10 });
        const seenUrl = new Set();
        let logo = null;
        let spare = null;
        for (const c of cands.filter(x => x.url).sort((a, b) => b.score - a.score)) {
            if (seenUrl.has(c.url)) {
                continue;
            }
            seenUrl.add(c.url);
            try {
                const im = await image(c.url, 'logo');
                if (!im) {
                    continue;
                }
                if (im.size && Math.min(im.size.w, im.size.h) < 48) {
                    spare = spare || im; // too small: keep only as a last resort
                    continue;
                }
                logo = im;
                break;
            } catch { }
        }
        logo = logo || spare;
        let cover = null;
        for (const k of ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']) {
            const u = page.metas[k] && absUrl(page.metas[k], page.base);
            if (!u || seenUrl.has('c:' + u)) {
                continue;
            }
            seenUrl.add('c:' + u);
            try {
                const im = await image(u, 'cover');
                if (!im || im.mime === 'image/svg+xml' || im.mime === 'image/x-icon') {
                    continue;
                }
                const ratio = im.size ? im.size.w / im.size.h : 0;
                const wide = im.size ? im.size.w >= 480 && ratio >= 1.3 && ratio <= 2.6 : im.body.length >= 20e3;
                if (wide) {
                    cover = im;
                    break;
                }
            } catch { }
        }
        const color = [page.metas['theme-color'], man && man.theme_color, page.metas['msapplication-tilecolor']].map(hex).find(c => c && lum(c) < 0.92) || '';
        if (!logo && !cover && !color) {
            return null;
        }
        return { host, site: origin + '/', logo, cover, color };
    }

    const idOf = host => host.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    // Returns the brand id for a company name ('' when nothing trustworthy was found). Results are remembered in db.
    async function ensure(name, hints = {}) {
        const key = core(name).replace(/ /g, '-').slice(0, 80);
        if (!key) {
            return '';
        }
        const t = now();
        const rec = db.brandMap[key];
        if (rec && t - rec.at < (rec.id ? OK_DAYS : RETRY_DAYS) * DAY && (!rec.id || db.brands[rec.id])) {
            return rec.id;
        }
        let r = null;
        try {
            r = await discover(name, hints);
        } catch (e) {
            log(`  brand ${name}: ${e.message}`);
        }
        if (!r) {
            db.brandMap[key] = { id: rec && rec.id && db.brands[rec.id] ? rec.id : '', at: t - (rec && rec.id ? (OK_DAYS - RETRY_DAYS) * DAY : 0) };
            save();
            return db.brandMap[key].id;
        }
        const id = idOf(r.host);
        const old = db.brands[id] || {};
        const meta = { id, name, site: r.site, logo: old.logo || '', cover: old.cover || '', color: r.color || old.color || '', at: new Date(t).toISOString() };
        for (const k of ['logo', 'cover']) {
            if (r[k]) {
                fs.writeFileSync(path.join(dir, `${id}.${k}`), r[k].body);
                meta[k] = r[k].mime;
            }
        }
        db.brands[id] = meta;
        db.brandMap[key] = { id, at: t };
        save();
        log(`  brand ${name}: ${r.host} (${meta.logo ? 'logo' : 'no logo'}, ${meta.cover ? 'cover' : 'no cover'}${meta.color ? ', colour ' + meta.color : ''})`);
        return id;
    }
    // names: [{ name, site? }] in priority order. At most `max` lookups that need the network per call (the rest are done on the next run).
    async function ensureMany(names, max = 40) {
        const out = new Map();
        let net = 0;
        for (const n of names) {
            const key = core(n.name).replace(/ /g, '-');
            const rec = db.brandMap[key];
            const fresh = rec && now() - rec.at < (rec.id ? OK_DAYS : RETRY_DAYS) * DAY && (!rec.id || db.brands[rec.id]);
            if (!fresh && net >= max) {
                out.set(n.name, rec && rec.id && db.brands[rec.id] ? rec.id : '');
                continue;
            }
            net += fresh ? 0 : 1;
            out.set(n.name, await ensure(n.name, { site: n.site }));
        }
        return out;
    }
    const asset = (id, kind) => {
        const m = /^[a-z0-9-]{1,60}$/.test(id) && (kind === 'logo' || kind === 'cover') && db.brands[id];
        if (!m || !MIME_OK.has(m[kind])) {
            return null;
        }
        try {
            return { mime: m[kind], body: fs.readFileSync(path.join(dir, `${id}.${kind}`)) };
        } catch {
            return null;
        }
    };
    return { ensure, ensureMany, asset };
}

// Picture addresses and colour to put on a listing that has a brand (used when the API sends listings out).
const brandFields = (db, l) => {
    const b = l && l.brand && db.brands && db.brands[l.brand];
    if (!b) {
        return {};
    }
    const out = {};
    if (!l.logo && b.logo) {
        out.logo = `/api/brand/${b.id}/logo`;
    }
    if (!l.image && b.cover) {
        out.image = `/api/brand/${b.id}/cover`;
    }
    if (b.color) {
        out.brandColor = b.color;
    }
    return out;
};
const BRAND_URL = /^\/api\/brand\/([a-z0-9-]{1,60})\/(logo|cover)$/;

module.exports = { create, brandFields, BRAND_URL, parsePage, belongs, sniff, imageSize, guessHosts, core, hex };
