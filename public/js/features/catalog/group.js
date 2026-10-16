// Turns the compact catalog rows (public/catalog/*.json, see scripts/build-catalog.js) into ONE listing per course topic or job role.
//
// The rows are "topic x provider" and "role x job board x city" combinations: 23,778 and 8,657 of them. As cards they were near-duplicates
// (the same role once per board and once per city). Here every topic or role becomes a single listing that carries its provider / board
// links, so the page shows ~1,350 courses and ~1,700 role-in-city cards, each with buttons such as "Open on LinkedIn / Naukri / Indeed".
//
// HONEST NOTE: these listings are SEARCH LINKS. Each button opens the provider's or job board's own search page for the topic or role.
// Fyndr has not checked any single page behind them, so they carry no legitimacy score and never claim "verified" (see origin.js).
import { PROVIDERS, BOARDS, NATION, boardUrl, cleanQuery } from './meta.js';

const h32 = s => { let h = 2166136261; for (const c of String(s)) { h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; } return h; };
// Stable ids: the same role or topic always gets the same id, so saved items survive a rebuild of the catalog.
export const groupId = (kind, text) => 'cat_g' + kind + '_' + h32(String(text).toLowerCase()).toString(36);

// ---------------- providers ----------------
// What a provider's pay text means for the student.  free: costs nothing to learn (a paid certificate may exist)
// freemium: free to start or free courses among paid ones   search: only a search page   paid: paid or free trial
export function tierOf(pay) {
    const t = String(pay || '');
    if (/^free\s*·/i.test(t) || t === 'Free') {
        return 'free';
    }
    if (/^free to search/i.test(t)) {
        return 'search';
    }
    if (/^free/i.test(t)) {
        return 'freemium';
    }
    return 'paid';
}
const RANK = { free: 0, freemium: 1, paid: 2, search: 3 };
export const hasCertificate = pay => /certificate|badge/i.test(String(pay || ''));
const TIER_TEXT = { free: 'Free', freemium: 'Free to start', paid: 'Paid or trial', search: 'Search' };
export const tierText = t => TIER_TEXT[t] || '';

const AUD = { u: 'UG students (first to third year)', p: 'PG students and final-year UG', a: 'Anyone starting out' };
const joinNames = (names, show = 3) => names.slice(0, show).join(', ') + (names.length > show ? ` +${names.length - show}` : '');

// Builds one course listing from a topic and a list of provider indexes (into PROVIDERS).
function courseGroup({ id, topic, cat, flag, skills, provs, created }) {
    const links = provs.map(pi => {
        const P = PROVIDERS[pi];
        return { n: P[0], u: P[4](topic), tier: tierOf(P[2]), cert: hasCertificate(P[2]), pay: P[2], dur: P[3], what: P[5] };
    }).sort((a, b) => RANK[a.tier] - RANK[b.tier]); // stable: free ones first, otherwise the order of the catalog
    const free = links.some(x => x.tier === 'free' || x.tier === 'freemium');
    const allFree = links.length > 0 && links.every(x => x.tier === 'free');
    const cert = links.some(x => x.cert);
    const aud = flag === 'p' ? [AUD.p, 'Interns who need it for a project'] : flag === 'u' ? [AUD.u, 'Interns who need the basics'] : ['UG and PG students', 'Interns and fresh graduates'];
    const d = `Find ${topic} courses on ${links.length} learning sites. Each button below opens that site's own search for this topic, so you can compare courses and pick the level and teacher you like. Fyndr has not checked the individual courses there. Prices, free options and certificates change, so check them on the provider's page.\nBest for: ${aud.join('; ')}\nWhat you get: ${free ? 'Free learning material on several sites' : 'A structured paid or trial course'}; ${cert ? 'optional certificate on some sites' : 'a skill you can show in projects'}; learn at your own pace`;
    return {
        id, type: 'Course', title: topic, orgName: joinNames(links.map(x => x.n)), orgId: 'catalog', orgVerified: false,
        location: 'Online · Self-paced', pay: allFree ? 'Free (certificate may cost extra)' : free ? 'Free and paid options' : 'Paid · check current price', duration: 'Self-paced, varies by course',
        description: d, applyUrl: links[0].u, cat, skills: skills ? skills.split(',') : undefined, level: flag === 'u' || flag === 'p' ? flag : undefined,
        status: 'approved', source: 'import', origin: 'catalog', search: true, links, free, allFree, cert, created
    };
}

// ---------------- jobs ----------------
// The words typed into a job board for a role: "Data Analyst Intern" -> "Data Analyst intern", "Data Analyst (Fresher)" -> "Data Analyst fresher".
export const searchFor = (title, intern) => (intern ? String(title).replace(/ Intern$/, '') + ' intern' : String(title).replace(/ \(Fresher\)$/, '') + ' fresher');
// Boards we always offer for a role, best first (the first three are the buttons shown on the card).
const MAIN = { intern: [3, 0, 2, 1, 4, 5, 15], job: [0, 2, 1, 4, 5, 8, 7] }; // indexes into BOARDS
const jobLocation = cities => (cities.length ? cities.join(', ') + ' · Remote' : 'India · many cities and remote');

function jobGroup({ id, title, intern, cat, skills, boards, cities, created }) {
    const q2 = searchFor(title, intern);
    const bi = [...new Set([...MAIN[intern ? 'intern' : 'job'], ...boards])];
    const home = cities[0] || NATION; // one card is one role in one city (or remote / all India when it has no city)
    const links = bi.map(i => ({ n: BOARDS[i][0], bi: i, u: boardUrl(i, q2, home) }));
    const d = `${title} openings across ${links.length} job boards. Each button opens that board's own live search for this role, because openings change every day. Fyndr has not checked the individual postings there. ${intern ? 'Check the stipend, duration and whether it is on-site before you apply.' : 'Check the salary, location and experience asked for before you apply.'} Never pay money to get a job or internship.\nBest for: ${intern ? 'UG students looking for their first internship; PG students; final-year students' : 'Final-year students; fresh graduates; PG students'}\nWhat you get: ${intern ? 'Hands-on experience; a certificate or letter in many cases; a possible full-time offer' : 'A first full-time role; on-the-job training'}`;
    return {
        id, type: intern ? 'Internship' : 'Job', title, orgName: joinNames(links.map(x => x.n)), orgId: 'catalog', orgVerified: false,
        location: jobLocation(cities), cities, remote: true, pay: intern ? 'Stipend varies · check listing' : 'Salary varies · check listing', duration: intern ? '1 to 6 months, usually' : '',
        description: d, applyUrl: links[0].u, cat, skills: skills ? skills.split(',') : undefined, status: 'approved', source: 'import', origin: 'catalog',
        search: true, q: q2, home: cities[0] || '', links, created
    };
}
// The links of a job listing for one place: a city name, '' (remote) or NATION (all of India).
export const linksFor = (l, place = NATION) => (l.links || []).map(x => (x.bi === undefined ? x : { ...x, u: boardUrl(x.bi, l.q, place) }));

// ---------------- the catalog ----------------
const fakeDate = (i, k) => new Date(Date.UTC(2026, 0, 1) + ((i * k) % 2592000) * 1000).toISOString(); // only used to order the catalog, never shown (see detail.js)
const unique = (m, id) => { while (m.has(id)) { id += 'x'; } return id; };

// rows: the "rows" of catalog-courses.json ([topic, provider#, category, flag, skills]). -> { list, legacy }
// legacy maps the old per-row ids ("cat_c123") to the new id of their topic, so courses saved before grouping are still found.
export function groupCourses(rows) {
    const by = new Map();
    rows.forEach((r, i) => {
        const g = by.get(r[0]) || { topic: r[0], cat: r[2], flag: r[3] || 'a', skills: r[4] || '', provs: new Set(), first: i, rows: [] };
        g.provs.add(r[1]);
        g.rows.push(i);
        by.set(r[0], g);
    });
    const ids = new Map();
    const legacy = new Map();
    const list = [...by.values()].map(g => {
        const id = unique(ids, groupId('c', g.topic));
        ids.set(id, 1);
        g.rows.forEach(i => legacy.set('cat_c' + i, id));
        return courseGroup({ id, topic: g.topic, cat: g.cat, flag: g.flag, skills: g.skills, provs: [...g.provs], created: fakeDate(g.first, 2654435761) });
    });
    return { list, legacy };
}

// rows: the "rows" of catalog-jobs.json ([title, 'i'|'j', board#, city, category, skills]). -> { list, legacy }
export function groupJobs(rows) {
    const by = new Map();
    rows.forEach((r, i) => {
        const key = r[0] + '|' + (r[3] || '');
        const g = by.get(key) || { title: r[0], intern: r[1] === 'i', cat: r[4], skills: r[5] || '', boards: new Set(), cities: r[3] ? [r[3]] : [], first: i, rows: [] };
        g.boards.add(r[2]);
        g.rows.push(i);
        by.set(key, g);
    });
    const ids = new Map();
    const legacy = new Map();
    const list = [...by.values()].map(g => {
        const id = unique(ids, groupId('j', g.title + '|' + (g.cities[0] || '')));
        ids.set(id, 1);
        g.rows.forEach(i => legacy.set('cat_j' + i, id));
        return jobGroup({ id, title: g.title, intern: g.intern, cat: g.cat, skills: g.skills, boards: [...g.boards], cities: g.cities, created: fakeDate(g.first, 40503) });
    });
    return { list, legacy };
}
