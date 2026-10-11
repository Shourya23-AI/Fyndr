#!/usr/bin/env node
// Collects jobs and courses from the companies you list in config/companies.json and writes imports/jobs.json.
// Then open Dashboard > Listings > "Import jobs and courses" on the site and choose that file.
//
// Only rule-following sources are used:
//   greenhouse  public job board API of a company     { "type": "greenhouse", "board": "acme" }
//   lever       public postings API of a company      { "type": "lever", "board": "acme" }
//   page        a careers page that publishes schema.org JobPosting data (the same data Google Jobs reads)
//               { "type": "page", "url": "https://acme.com/careers/" }   (robots.txt is checked first; blocked pages are skipped)
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
        throw new Error(r.status + ' ' + url);
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
async function main() {
    const cfg = path.resolve(process.argv[2] || path.join(__dirname, '..', 'config', 'companies.json'));
    const out = path.resolve(process.argv[3] || path.join(__dirname, '..', 'imports', 'jobs.json'));
    const list = JSON.parse(fs.readFileSync(cfg, 'utf8'));
    const all = [];
    for (const c of list) {
        try {
            const f = { greenhouse: fromGreenhouse, lever: fromLever, page: fromPage }[c.type];
            if (!f) {
                throw new Error('unknown type ' + c.type);
            }
            const r = (await f(c)).filter(x => x.title && /^https:\/\//i.test(x.applyUrl || ''));
            console.log(`${c.name}: ${r.length} listing(s)`);
            all.push(...r);
        } catch (e) {
            console.log(`${c.name}: failed (${e.message})`);
        }
        await new Promise(r => setTimeout(r, 800)); // be gentle with every site
    }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(all, null, 1));
    console.log(`\nWrote ${all.length} listing(s) to ${out}\nNext: Dashboard > Listings > Import jobs and courses, then choose that file.`);
}
if (require.main === module) {
    main();
}
module.exports = { jobPostings, allowed, strip, typeOf };
