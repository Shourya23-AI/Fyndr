// Personal search: makes the search box use what the person told us on their profile.
//   searchTerms(profile)      a few ready-made searches ("Python intern", "Data Analyst") shown as chips under the search box
//   rankForMe(rows, profile)  puts the results of a search in the order that fits THIS person best, with a match % on each card
// Pure functions: no DOM, no network, no AI. They run in the browser on the profile the person typed, same as the rest of suggestions/.
import { buildProfile, scoreListing, analyseListing, canon } from './engine.js';

const MAX_RANK = 500; // rows scored per search (the catalog is thousands of rows; a search rarely returns more than this that matter)
const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const lc = s => clean(s).toLowerCase();

// Up to 6 searches taken from the profile. Skills the person rates highest come first; students are pointed at internships.
export function searchTerms(profile, current = '') {
    const p = profile || {};
    const types = Array.isArray(p.jobTypes) ? p.jobTypes : [];
    const wantsIntern = types.includes('Internship') && (!types.includes('Job') || +p.gradYear > new Date().getFullYear() - 1);
    const out = [];
    const add = t => {
        t = clean(t).slice(0, 40);
        if (t.length >= 2 && !out.some(x => lc(x) === lc(t)) && lc(t) !== lc(current)) {
            out.push(t);
        }
    };
    const headline = clean(p.headline);
    if (headline && headline.length <= 40) {
        add(headline);
    }
    const lv = p.skillLevels && typeof p.skillLevels === 'object' ? p.skillLevels : {};
    const skills = (Array.isArray(p.skills) ? p.skills : []).map(x => (typeof x === 'string' ? x : x?.name || '')).filter(Boolean);
    skills.map((name, i) => ({ name, i, v: +lv[name] || 3 })).sort((a, b) => b.v - a.v || a.i - b.i).slice(0, 3).forEach(({ name }) => {
        const c = canon(name);
        add((c && c.label ? c.label : name) + (wantsIntern ? ' intern' : ''));
    });
    if (p.field) {
        add(clean(p.field) + (wantsIntern ? ' internship' : ''));
    }
    const city = clean(String(p.locations ?? '').split(/[,;/|\n]+/)[0]);
    if (city && !/remote|anywhere|work from home|wfh/i.test(city) && out[0]) {
        add(out[0] + ' ' + city);
    }
    return out.slice(0, 6);
}

// rows from a search -> { rows: best fit first, match: { id: match info for the card badge } }. Returns the rows untouched when the
// profile has nothing to match on, or when there are no job rows to rank.
export function rankForMe(rows, profile, query = '', now = Date.now()) {
    const c = buildProfile(profile, now);
    if (!c.ready || !Array.isArray(rows) || !rows.length) {
        return { rows, match: {} };
    }
    const q = lc(query);
    const match = {};
    const scored = rows.slice(0, MAX_RANK).map((l, i) => {
        if (l.type === 'Course') {
            return { l, i, r: -1 };
        }
        const m = scoreListing(c, l, analyseListing(l), { now });
        match[l.id] = m;
        // a search for a word in the title always beats a word that only appears deep in the description
        return { l, i, r: m.rank + (q && lc(l.title).includes(q) ? 30 : 0) + (q && lc(l.orgName).includes(q) ? 30 : 0) };
    });
    // Courses and the rows past the cap keep their old order, after the ranked jobs.
    const ranked = scored.filter(x => x.r >= 0).sort((a, b) => b.r - a.r || a.i - b.i).map(x => x.l);
    const rest = scored.filter(x => x.r < 0).map(x => x.l).concat(rows.slice(MAX_RANK));
    return { rows: ranked.concat(rest), match };
}
