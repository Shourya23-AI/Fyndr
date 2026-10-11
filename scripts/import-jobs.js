#!/usr/bin/env node
// Collects jobs and courses from the companies you list in config/companies.json and writes imports/jobs.json.
// Then open Dashboard > Listings > "Import jobs and courses" on the site and choose that file.
//
// Only rule-following sources are used:
//   greenhouse  public job board API of a company     { "type": "greenhouse", "board": "acme" }
//   lever       public postings API of a company      { "type": "lever", "board": "acme" }
//   page        a careers page that publishes schema.org JobPosting data (the same data Google Jobs reads)
//               { "type": "page", "url": "https://acme.com/careers/" }   (robots.txt is checked first; blocked pages are skipped)
//   catalog     a hand-picked list in config/ (courses.json): { "type": "catalog", "file": "courses.json" }
//   adzuna      Adzuna's official job search API for India (free key: env ADZUNA_APP_ID and ADZUNA_APP_KEY; skipped when missing)
//               { "type": "adzuna", "country": "in", "queries": ["intern", "fresher"], "where": "India", "pages": 1 }
// config/import-settings.json decides what is kept: student-friendly roles only (intern, fresher, entry level, 0-2 years),
// and only locations you list (India cities, remote). Courses from the catalog are never filtered.
// It never logs in, never submits forms and never reads pages a site's robots.txt disallows.
// Run:  node scripts/import-jobs.js [companies.json] [output.json]      (Node 18 or newer)
const fs = require('fs');
const path = require('path');
const UA = 'FyndrImporter/1.0 (+job listing aggregator; respects robots.txt)';
const strip = h => String(h || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<\/(p|div|li|h\d|br)>/gi, '\n').replace(/<li>/gi, '- ').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
const typeOf = t => /intern/i.test(t) ? 'Internship' : /course|bootcamp|training programme|certificate/i.test(t) ? 'Course' : 'Job';
const get = async (url, json) => {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: json ? 'application/json' : 'text/html' }, redirect: 'follow' });
    if (!r.ok) {
        throw new Error(r.status + ' ' + String(url).split('?')[0]); // never print the query string (it can hold an API key)
    }
    return json ? r.json() : r.text();
};
// Minimal robots.txt check: the rules for "*" (or our name), longest matching Allow/Disallow wins.
async function allowed(url) {
    const u = new URL(url);
    let txt = '';
    try {
        txt = await get(u.origin + '/robots.txt');
    } catch {
        return true; // no robots.txt = no restrictions stated
    }
    let applies = false;
    const rules = [];
    for (const line of txt.split(/\r?\n/)) {
        const [k, ...v] = line.split('#')[0].split(':');
        const key = (k || '').trim().toLowerCase();
        const val = v.join(':').trim();
        if (key === 'user-agent') {
            applies = val === '*' || /fyndr/i.test(val);
        } else if (applies && (key === 'allow' || key === 'disallow') && val) {
            rules.push([key, val]);
        }
    }
    let best = ['allow', ''];
    for (const [k, p] of rules) {
        const re = new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
        if (re.test(u.pathname + u.search) && p.length >= best[1].length) {
            best = [k, p];
        }
    }
    return best[0] === 'allow';
}
const jobPostings = html => {
    const out = [];
    const walk = n => {
        if (Array.isArray(n)) {
            return n.forEach(walk);
        }
        if (n && typeof n === 'object') {
            if ([].concat(n['@type'] || []).includes('JobPosting')) {
                out.push(n);
            }
            walk(n['@graph'] || []);
        }
    };
    for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
            walk(JSON.parse(m[1]));
        } catch { }
    }
    return out;
};
const place = j => {
    const l = [].concat(j.jobLocation || [])[0];
    const a = l && l.address;
    const s = a ? [a.addressLocality, a.addressRegion, a.addressCountry && (a.addressCountry.name || a.addressCountry)].filter(Boolean).join(', ') : '';
    return s || (j.jobLocationType === 'TELECOMMUTE' ? 'Remote' : '');
};
const pay = j => {
    const b = j.baseSalary;
    const v = b && b.value;
    if (!v) {
        return '';
    }
    const cur = b.currency || '';
    const unit = (v.unitText || '').toLowerCase();
    return v.minValue && v.maxValue ? `${cur} ${v.minValue}-${v.maxValue}${unit ? ' / ' + unit : ''}`.trim() : v.value ? `${cur} ${v.value}${unit ? ' / ' + unit : ''}`.trim() : '';
};
const SETTINGS = () => {
    try {
        return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'import-settings.json'), 'utf8'));
    } catch {
        return {};
    }
};
// ---- keep only what suits students (plain rules, no AI) ----
const SENIOR = /\b(senior|sr\.?|lead|principal|staff|manager|head\s+of|director|vp|architect)\b/i;
const ENTRY = /\b(intern|interns|internship|trainee|apprentice(?:ship)?|fresher|freshers|entry[- ]level|new\s+grad(?:uate)?s?|recent\s+graduates?|graduate\s+(?:programme|program|trainee)|campus|junior|early\s+career|associate)\b|\b0\s*[-\u2013to]+\s*[12]\s*years?/i;
const yearsMin = t => {
    const m = String(t).match(/(\d{1,2})\s*(?:\+|plus)?\s*(?:[-\u2013]|to)?\s*(?:\d{1,2})?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:of\s+)?(?:relevant\s+|professional\s+|work\s+|industry\s+|hands[- ]on\s+|prior\s+)?experience/i);
    return m ? +m[1] : null;
};
function studentFriendly(it) {
    if (it.source === 'catalog') {
        return true;
    }
    const title = String(it.title || '');
    const years = yearsMin(`${title} ${String(it.description || '').slice(0, 1500)}`);
    if (SENIOR.test(title) || (years !== null && years >= 3)) {
        return false;
    }
    return ENTRY.test(title) || ENTRY.test(String(it.description || '').slice(0, 700)) || (years !== null && years <= 1);
}
function placeOk(it, keep) {
    if (it.source === 'catalog' || !keep || !keep.length) {
        return true;
    }
    const loc = String(it.location || '').toLowerCase();
    return !loc || keep.some(k => loc.includes(k));
}
async function fromGreenhouse(c) {
    const d = await get(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(c.board)}/jobs?content=true`, true);
    return (d.jobs || []).map(j => ({
        orgName: c.name, title: j.title, type: typeOf(j.title), location: j.location && j.location.name, pay: '', description: strip(j.content), applyUrl: j.absolute_url, source: 'greenhouse'
    }));
}
async function fromLever(c) {
    const d = await get(`https://api.lever.co/v0/postings/${encodeURIComponent(c.board)}?mode=json`, true);
    return (Array.isArray(d) ? d : []).map(j => ({
        orgName: c.name, title: j.text, type: typeOf(j.text), location: j.categories && j.categories.location, pay: '', description: j.descriptionPlain || strip(j.description), applyUrl: j.hostedUrl || j.applyUrl, source: 'lever'
    }));
}
async function fromPage(c) {
    if (!(await allowed(c.url))) {
        console.log('  skipped (robots.txt disallows):', c.url);
        return [];
    }
    return jobPostings(await get(c.url)).map(j => ({
        orgName: (j.hiringOrganization && j.hiringOrganization.name) || c.name, title: j.title, type: typeOf(j.title + ' ' + (j.employmentType || '')), location: place(j), pay: pay(j), description: strip(j.description),
        applyUrl: j.url || (j.directApply && c.url) || c.url, source: 'page'
    }));
}
// Hand-picked list (config/courses.json). The text is written as "Best for:" / "What you get:" lines so the site shows them as written.
async function fromCatalog(c) {
    const list = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', c.file || 'courses.json'), 'utf8'));
    return list.map(x => ({
        orgName: x.orgName, title: x.title, type: 'Course', location: x.location || 'Online', pay: x.pay || '', duration: x.duration || '', applyUrl: x.url, source: 'catalog',
        description: [x.about, '', x.bestFor && x.bestFor.length ? 'Best for: ' + x.bestFor.join('; ') : '', x.provides && x.provides.length ? 'What you get: ' + x.provides.join('; ') : ''].filter((v, i, a) => v || (a[i - 1] && a[i + 1])).join('\n').trim()
    }));
}
// Adzuna's official API (https://developer.adzuna.com/, free key). Results are a moving sample, so they are never treated as a complete list.
async function fromAdzuna(c) {
    const id = process.env.ADZUNA_APP_ID;
    const key = process.env.ADZUNA_APP_KEY;
    if (!id || !key) {
        throw Object.assign(new Error('no ADZUNA_APP_ID / ADZUNA_APP_KEY set'), { skip: true });
    }
    const out = [];
    for (const q of c.queries || ['intern', 'fresher']) {
        for (let pg = 1; pg <= (c.pages || 1); pg++) {
            const u = `https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(c.country || 'in')}/search/${pg}?app_id=${encodeURIComponent(id)}&app_key=${encodeURIComponent(key)}&results_per_page=50&what=${encodeURIComponent(q)}${c.where ? '&where=' + encodeURIComponent(c.where) : ''}&sort_by=date&content-type=application/json`;
            const d = await get(u, true);
            for (const j of d.results || []) {
                const lo = j.salary_is_predicted === '1' || j.salary_is_predicted === 1 ? 0 : j.salary_min;
                const hi = j.salary_is_predicted === '1' || j.salary_is_predicted === 1 ? 0 : j.salary_max;
                out.push({
                    orgName: j.company && j.company.display_name, title: j.title, type: typeOf(j.title), location: j.location && j.location.display_name, pay: lo && hi ? `INR ${Math.round(lo)}-${Math.round(hi)} / year` : '', description: strip(j.description), applyUrl: j.redirect_url, source: 'adzuna'
                });
            }
            await new Promise(r => setTimeout(r, 600));
        }
    }
    return out;
}
const SOURCES = { greenhouse: fromGreenhouse, lever: fromLever, page: fromPage, catalog: fromCatalog, adzuna: fromAdzuna };
const COMPLETE = new Set(['greenhouse', 'lever', 'page', 'catalog']); // sources that return a company's WHOLE list (not a sample)
const keyOf = c => `${c.type}:${c.board || c.url || c.file || c.country || c.name}`;
// report.complete = keys of sources fetched fully this run (the scheduled importer closes listings that vanished from them);
// report.failed / report.skipped = names, for the summary at the end.
async function collect(list, log = console.log, report = { complete: new Set(), failed: [], skipped: [] }) {
    const cfg = SETTINGS();
    const all = [];
    for (const c of list) {
        try {
            const f = SOURCES[c.type];
            if (!f) {
                throw new Error('unknown type ' + c.type);
            }
            const raw = (await f(c)).filter(x => x.title && /^https:\/\//i.test(x.applyUrl || ''));
            let r = raw;
            if (cfg.studentFriendlyOnly !== false) {
                r = r.filter(studentFriendly);
            }
            r = r.filter(x => placeOk(x, cfg.keepLocations)).slice(0, cfg.maxPerSource || 60).map(x => ({ ...x, srcKey: keyOf(c) }));
            log(`${c.name}: ${raw.length} found, ${r.length} kept`);
            if (raw.length && COMPLETE.has(c.type)) {
                report.complete.add(keyOf(c));
            }
            all.push(...r);
        } catch (e) {
            if (e.skip) {
                log(`${c.name}: skipped (${e.message})`);
                report.skipped.push(c.name);
            } else {
                log(`${c.name}: failed (${e.message})`);
                report.failed.push(c.name);
            }
        }
        await new Promise(r => setTimeout(r, 800)); // be gentle with every site
    }
    return all;
}
async function main() {
    const cfg = path.resolve(process.argv[2] || path.join(__dirname, '..', 'config', 'companies.json'));
    const out = path.resolve(process.argv[3] || path.join(__dirname, '..', 'imports', 'jobs.json'));
    const all = await collect(JSON.parse(fs.readFileSync(cfg, 'utf8')));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(all, null, 1));
    console.log(`\nWrote ${all.length} listing(s) to ${out}\nNext: Dashboard > Listings > Import jobs and courses, then choose that file.`);
}
if (require.main === module) {
    main();
}
module.exports = { collect, jobPostings, allowed, strip, typeOf, studentFriendly, placeOk, fromCatalog };
