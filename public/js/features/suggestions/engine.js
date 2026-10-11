// Suggestions engine: ranks listings for ONE candidate from what they typed on their profile.
// Pure functions: no DOM, no network, no AI. It runs in the browser, so nothing about the candidate leaves their device,
// and it never reads a resume (the plan: "matching uses skills the user types in").
//
// How a listing is scored (each part is 0 to 1):
//   relevance  = skills (does the person have what the listing asks for) blended with field (does the kind of work fit their study / past roles)
//   level      = does the seniority and degree it asks for fit their experience and qualification
//   practical  = job type they want (job / internship) and where it is (their cities, or remote)
//   match %    = relevance x (0.5 + 0.5 x practical) x (0.25 + 0.75 x level)
// Because these are multiplied, a listing that is irrelevant cannot be rescued by being in the right city,
// and a senior role cannot look like a good match for a fresher just because the skills overlap.
// Freshness and "similar to what you saved" only change the ORDER, never the match % people see.
//
// Listings may carry optional `skills: ['SQL', ...]` and `postedAt` (the importer in Part 2 fills them); everything works without them.
import { EXP } from '../profile/constants.js';
import { SKILLS, AMBIGUOUS, IMPLIES, FAMILIES, FIELD_DOMAINS, ROLE_DOMAINS, CITIES } from './taxonomy.js';

const DAY = 864e5;
export const MIN_SHOW = 35; // below this a listing is not suggested
const PRIOR = .8; // small-sample guard: one matching skill out of one is not "100%"
const SOFT_WEIGHT = .35; // soft skills (communication, teamwork) count for less
const FAMILY_CREDIT = .35; // credit for a skill in the same family (React for a JavaScript listing)
const EVIDENCE_CREDIT = .5; // a skill that shows up in the person's projects / past roles but not in their skill list
const LEVEL_CREDIT = [.55, .8, 1, 1, 1]; // skill level 1 to 5 as typed on the profile
const EXP_YEARS = [0, .5, 2, 4, 6]; // same order as EXP
const QUAL_RANK = { 'High School': 1, Diploma: 2, "Bachelor's": 3, "Master's": 4, PhD: 5, Other: 2.5 };
const QUAL_NAME = { 1: '12th-grade', 2: 'Diploma', 3: "Bachelor's", 4: "Master's", 5: 'PhD' };

// ---------- text helpers ----------
const stem = t => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us') ? t.slice(0, -1) : t);
// "Node.js, React/Redux & C++" -> ['node.js', 'react', 'redux', 'c++']  (lower-case, links removed, plural "s" dropped)
export const tokens = text => (String(text ?? '').toLowerCase()
    .replace(/https?:\/\/\S+|www\.\S+/g, ' ')
    .replace(/\.net\b/g, ' dotnet ')
    .match(/[a-z0-9][a-z0-9+#.]*/g) || []).map(t => stem(t.replace(/\.+$/, '')));
// Every run of 1 to 4 neighbouring words, so "machine learning" can be found inside a sentence.
const grams = toks => {
    const out = new Set();
    for (let i = 0; i < toks.length; i++) {
        let g = '';
        for (let n = 0; n < 4 && i + n < toks.length; n++) {
            g = n ? g + ' ' + toks[i + n] : toks[i];
            out.add(g);
        }
    }
    return out;
};
const list = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const STOP = new Set();
['the', 'and', 'for', 'with', 'our', 'you', 'your', 'are', 'job', 'jobs', 'intern', 'internship', 'junior', 'senior', 'trainee', 'associate', 'executive', 'fresher', 'fresh', 'remote', 'hybrid', 'full', 'time', 'part', 'new', 'aspiring', 'looking', 'seeking', 'student', 'graduate', 'experienced', 'professional', 'passionate', 'motivated', 'opening', 'hiring', 'urgent', 'required', 'wanted', 'engineer', 'manager', 'assistant', 'lead', 'head'].forEach(w => {
    STOP.add(w);
    STOP.add(stem(w));
});
const roleWords = s => tokens(s).filter(t => t.length > 2 && !STOP.has(t));

// ---------- the skill dictionary, built once ----------
export const LABEL = new Map();
export const CATEGORY = new Map();
export const CLASHES = []; // two skills claiming the same wording (the tests keep this empty)
const ALIAS = new Map(); // wording found in a listing -> skill key
const TYPED = new Map(); // wording a person types as a skill -> skill key (also accepts "C", "R", "Go")
const SOFT = new Set();
const claim = (map, phrase, key, report) => {
    const had = map.get(phrase);
    if (had === undefined) {
        map.set(phrase, key);
    } else if (had !== key && report) {
        CLASHES.push([phrase, had, key]);
    }
};
for (const [key, label, cat, aliases] of SKILLS) {
    LABEL.set(key, label);
    CATEGORY.set(key, cat);
    if (cat === 'soft') {
        SOFT.add(key);
    }
    for (const a of [key, ...aliases]) {
        const p = tokens(a).join(' ');
        if (!p) {
            continue;
        }
        if (!(AMBIGUOUS.has(key) && a === key)) {
            claim(ALIAS, p, key, true);
        }
        claim(TYPED, p, key, false);
    }
}
const IMPL = new Map();
for (const [from, to, w] of IMPLIES) {
    IMPL.set(from, [...(IMPL.get(from) || []), [to, w]]);
}
const FAM = new Map();
for (const fam of FAMILIES) {
    for (const k of fam) {
        FAM.set(k, new Set([...(FAM.get(k) || []), ...fam.filter(x => x !== k)]));
    }
}
export const isSoft = k => SOFT.has(k);
export const skillLabel = k => LABEL.get(k) || k;

// A skill as typed by a person (or listed by an importer): known skill -> its key, anything else -> a "custom" skill matched by its words.
export function canon(name) {
    const phrase = tokens(name).join(' ');
    if (!phrase) {
        return null;
    }
    const key = TYPED.get(phrase);
    return key ? { key, label: LABEL.get(key), custom: false } : { key: 'x:' + phrase, label: String(name).trim().slice(0, 40), custom: true, phrase };
}
// Which known skills does this text mention? (used by the tests and by the profile evidence below)
export const extractSkills = text => [...new Set([...grams(tokens(text))].map(g => ALIAS.get(g)).filter(Boolean))];

// ---------- reading a listing ----------
const ENTRY_RE = /\b(interns?|internship|trainee|apprentice|freshers?|entry[- ]level|campus)\b/;
const JUNIOR_RE = /\b(junior|jr|associate|assistant)\b/;
const SENIOR_RE = /\b(senior|sr|lead|principal|staff|head|director|architect|vp|chief)\b/;
const YEARS_A = /(?:experience|exp)\b[^.\n]{0,30}?(\d{1,2})\s*(?:\+|plus|-|–|to)?\s*(\d{1,2})?\s*\+?\s*(?:years?|yrs?)/g;
const YEARS_B = /(\d{1,2})\s*(?:\+|plus|-|–|to)?\s*(\d{1,2})?\s*\+?\s*(?:years?|yrs?)(?:\s+of)?[^.\n]{0,25}?(?:experience|exp)\b/g;
const REQ = [
    [5, /\b(phd|ph\.d|doctorate)\b/],
    [4, /\b(master'?s? (?:degree|in |of )|masters? degree|m\.?tech|mba|m\.?sc|pgdm|post[- ]?graduate)/],
    [3, /\b(bachelor'?s?|b\.?tech|b\.e|b\.?sc|bca|b\.?com|bba|graduat(?:e|es|ion)|degree|undergraduate)\b/],
    [2, /\bdiploma\b/],
    [1, /\b(12th|hsc|high school|10\+2)\b/]
];
const REMOTE_RE = /\b(remote|work from home|wfh|anywhere|online|virtual)\b/;
const FREELANCE_RE = /\b(freelance|contract|part[- ]?time|gig)\b/;

function yearsAsked(text) {
    let min = null;
    for (const re of [YEARS_A, YEARS_B]) {
        for (const m of text.matchAll(re)) {
            const y = +m[1];
            if (y <= 20 && (min === null || y < min)) {
                min = y;
            }
        }
    }
    return min;
}
function seniorityOf(l, rawTitle, text) {
    const title = rawTitle.replace(/lead gen(?:eration)?|staff nurse/g, ' '); // "Lead Generation Executive" is not a lead role
    if (ENTRY_RE.test(title)) {
        return { years: 0, label: 'entry' };
    }
    if (SENIOR_RE.test(title)) {
        return { years: 5, label: 'senior' };
    }
    if (/\bmanager\b/.test(title)) {
        return { years: 4, label: 'senior' };
    }
    if (JUNIOR_RE.test(title)) {
        return { years: .5, label: 'junior' };
    }
    const y = yearsAsked(text);
    if (y !== null) {
        return { years: y, label: 'years' };
    }
    if (l.type === 'Internship') {
        return { years: 0, label: 'entry' };
    }
    if (/\b(freshers?|entry[- ]level)\b/.test(text)) {
        return { years: .5, label: 'entry' };
    }
    return { years: null, label: '' };
}
const domainsOf = (text, table, base = new Map()) => {
    for (const [re, cats] of table) {
        if (re.test(text)) {
            for (const [c, w] of cats) {
                base.set(c, (base.get(c) || 0) + w);
            }
        }
    }
    return base;
};
const cosine = (x, y) => {
    if (!x.size || !y.size) {
        return null;
    }
    let dot = 0, nx = 0, ny = 0;
    for (const [k, v] of x) {
        nx += v * v;
        if (y.has(k)) {
            dot += v * y.get(k);
        }
    }
    for (const v of y.values()) {
        ny += v * v;
    }
    return dot / Math.sqrt(nx * ny);
};
const CITY_GROUPS = CITIES.map(([id, ...names]) => ({ id, names: names.map(n => tokens(n).join(' ')) }));
const cityGroup = phrase => (CITY_GROUPS.find(g => g.names.includes(phrase)) || {}).id || null;

export function analyseListing(l) {
    const title = String(l.title ?? '').toLowerCase();
    const text = title + ' ' + String(l.description ?? '').toLowerCase();
    const tg = grams(tokens(l.title));
    const bg = grams(tokens(l.description));
    const skills = new Map(); // key -> weight (2 when it is in the title)
    const labels = new Map();
    const put = (key, w, label) => {
        if (w > (skills.get(key) || 0)) {
            skills.set(key, w);
        }
        if (label && !labels.has(key)) {
            labels.set(key, label);
        }
    };
    for (const g of bg) {
        if (ALIAS.has(g)) {
            put(ALIAS.get(g), 1);
        }
    }
    for (const g of tg) {
        if (ALIAS.has(g)) {
            put(ALIAS.get(g), 2);
        }
    }
    if (Array.isArray(l.skills)) {
        for (const s of l.skills) {
            const c = canon(s);
            if (c) {
                put(c.key, 1.5, c.label);
            }
        }
    }
    for (const [k, w] of skills) {
        if (SOFT.has(k)) {
            skills.set(k, w * SOFT_WEIGHT);
        }
    }
    const domains = new Map();
    for (const [k, w] of skills) {
        const cat = CATEGORY.get(k);
        if (cat && cat !== 'soft') {
            domains.set(cat, (domains.get(cat) || 0) + w);
        }
    }
    domainsOf(title, ROLE_DOMAINS, domains);
    let req = null;
    for (const [rank, re] of REQ) {
        if (re.test(text) && (req === null || rank < req)) {
            req = rank;
        }
    }
    const locText = String(l.location ?? '').toLowerCase();
    const locGrams = grams(tokens(locText));
    return {
        skills, labels, domains, req, grams: new Set([...tg, ...bg]), titleWords: roleWords(l.title),
        level: seniorityOf(l, title, text), remote: REMOTE_RE.test(locText) || REMOTE_RE.test(title), freelance: FREELANCE_RE.test(text),
        locGrams, locGroups: new Set(CITY_GROUPS.filter(g => g.names.some(n => locGrams.has(n))).map(g => g.id))
    };
}

// ---------- reading a candidate ----------
export function buildProfile(p, now = Date.now()) {
    p = p || {};
    const lv = p.skillLevels && typeof p.skillLevels === 'object' ? p.skillLevels : {};
    const cover = new Map(); // skill key -> how well the person covers it (0 to 1)
    const have = new Map(); // skills they typed -> label
    const custom = []; // typed skills Fyndr does not know: matched by their words
    const bump = (k, v) => {
        if (v > (cover.get(k) || 0)) {
            cover.set(k, v);
        }
    };
    const spread = (k, f) => {
        bump(k, f);
        for (const [to, w] of IMPL.get(k) || []) {
            bump(to, w * f);
        }
        for (const m of FAM.get(k) || []) {
            bump(m, FAMILY_CREDIT * f);
        }
    };
    for (const name of Array.isArray(p.skills) ? p.skills : []) {
        const c = canon(name);
        if (!c) {
            continue;
        }
        const level = Math.min(5, Math.max(1, Math.round(+lv[name] || 3)));
        have.set(c.key, c.label);
        if (c.custom) {
            custom.push(c);
        }
        spread(c.key, LEVEL_CREDIT[level - 1]);
    }
    // Skills that only show up in projects or past roles count for half.
    const pastText = [p.projects, ...(Array.isArray(p.jobs) ? p.jobs.flatMap(j => [j && j.role, j && j.points]) : [])].join(' . ');
    for (const k of extractSkills(pastText)) {
        if (!cover.has(k)) {
            spread(k, EVIDENCE_CREDIT);
        }
    }
    const roles = [p.headline, ...(Array.isArray(p.jobs) ? p.jobs.map(j => j && j.role) : [])].filter(Boolean).join(' ');
    const fieldText = [p.field, p.headline, roles, ...(Array.isArray(p.education) ? p.education.map(e => e && e.degree) : [])].join(' ').toLowerCase();
    const domains = domainsOf(fieldText, FIELD_DOMAINS);
    for (const k of have.keys()) {
        const cat = CATEGORY.get(k);
        if (cat && cat !== 'soft') {
            domains.set(cat, (domains.get(cat) || 0) + .6);
        }
    }
    const places = [];
    let remoteOk = false;
    for (const raw of String(p.locations ?? '').split(/[,;/|·\n]+|\band\b/i)) {
        const label = raw.trim();
        if (label.length < 2) {
            continue;
        }
        if (REMOTE_RE.test(label.toLowerCase())) {
            remoteOk = true;
            continue;
        }
        const phrase = tokens(label).join(' ');
        if (phrase) {
            places.push({ label, phrase, group: cityGroup(phrase) });
        }
    }
    const xi = EXP.indexOf(p.experience);
    const now_ = new Date(now);
    return {
        ready: cover.size > 0 || domains.size > 0 || roleWords(roles).length > 0, skilled: cover.size > 0, cover, have, custom, domains, places, remoteOk, roleWords: new Set(roleWords(roles)),
        years: xi >= 0 ? EXP_YEARS[xi] : 0, qual: QUAL_RANK[p.qualification] ?? 2.5, field: String(p.field ?? '').trim(),
        studying: +p.gradYear > now_.getFullYear(), jobTypes: Array.isArray(p.jobTypes) ? p.jobTypes : []
    };
}

// ---------- scoring ----------
export const bandOf = s => (s >= 70 ? 'strong' : s >= 50 ? 'good' : 'possible');
export const BAND_LABEL = { strong: 'Strong match', good: 'Good match', possible: 'Possible match' };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const daysOld = (l, now) => {
    const t = Date.parse(l.postedAt || l.created);
    return Number.isFinite(t) ? Math.max(0, (now - t) / DAY) : null;
};

function levelFit(c, a, l) {
    if (l.type === 'Course') {
        return { fit: .8, seniority: .8, qual: 1 };
    }
    const ly = a.level.years;
    let seniority = .7;
    if (ly !== null) {
        const gap = ly - c.years;
        if (gap <= 0) {
            const over = c.years - ly;
            seniority = ly <= 1 && over >= 4 ? .5 : ly <= 1 && over >= 2.5 ? .85 : 1;
        } else {
            seniority = gap <= 1 ? .8 : gap <= 2 ? .5 : gap <= 3.5 ? .25 : .08;
        }
    }
    let qual = 1;
    if (a.req !== null) {
        const have = l.type === 'Internship' ? c.qual + 1 : c.qual;
        qual = have >= a.req ? 1 : have >= a.req - 1 ? .45 : .1;
    }
    return { fit: a.req === null ? seniority : .7 * seniority + .3 * qual, seniority, qual };
}
function typeFit(c, a, l) {
    if (!c.jobTypes.length) {
        return .7;
    }
    if (c.jobTypes.includes(l.type)) {
        return clamp(1 + (c.studying && l.type === 'Internship' ? .15 : 0));
    }
    return c.jobTypes.includes('Freelance') && a.freelance ? .9 : .2;
}
function placeFit(c, a) {
    if (!c.places.length && !c.remoteOk) {
        return { fit: a.remote ? .9 : .7, kind: a.remote ? 'remote' : 'neutral' };
    }
    if (a.remote) {
        return { fit: c.remoteOk ? 1 : .75, kind: 'remote' };
    }
    if (!a.locGrams.size) {
        return { fit: .7, kind: 'neutral' };
    }
    const hit = c.places.find(p => a.locGrams.has(p.phrase) || (p.group && a.locGroups.has(p.group)));
    return hit ? { fit: 1, kind: 'city', city: hit.label } : { fit: c.remoteOk ? .25 : .12, kind: 'far' };
}
function fieldFit(c, a) {
    const f = cosine(c.domains, a.domains);
    const hits = a.titleWords.filter(w => c.roleWords.has(w)).length; // "Frontend Developer" vs a headline that says "frontend developer"
    return clamp((f === null ? .5 : f) + Math.min(.3, .15 * hits));
}
const ago = d => (d < 1 ? 'Posted today' : d < 2 ? 'Posted yesterday' : d <= 7 ? `Posted ${Math.floor(d)} days ago` : '');

// One job or internship for one candidate -> { score (0-99), band, rank, matched, related, missing, reasons, cautions, ... }
export function scoreListing(c, l, a = analyseListing(l), o = {}) {
    const now = o.now ?? Date.now();
    const need = new Map(a.skills);
    const labels = new Map(a.labels);
    for (const cs of c.custom) { // a skill Fyndr does not know, but the listing says it in so many words
        if (a.grams.has(cs.phrase)) {
            need.set(cs.key, Math.max(need.get(cs.key) || 0, 1));
            labels.set(cs.key, cs.label);
        }
    }
    let num = 0, den = 0;
    const matched = [], related = [], missing = [];
    for (const [k, w] of need) {
        const cr = c.cover.get(k) || 0;
        num += w * cr;
        den += w;
        const item = { key: k, label: labels.get(k) || LABEL.get(k) || k, w };
        if (c.have.has(k) || cr >= .9) {
            matched.push(item);
        } else if (cr >= .3) {
            related.push(item);
        } else if (!SOFT.has(k)) {
            missing.push(item);
        }
    }
    [matched, related, missing].forEach(x => x.sort((p, q) => q.w - p.w));
    // A person who listed no skills is matched on field, level, type and place only (no skill score, so nothing is penalised for it).
    const S = den > 0 && c.skilled ? (num + PRIOR * .5) / (den + PRIOR) : null;
    const F = fieldFit(c, a);
    const relevance = S === null ? F * .85 : (.7 * S + .3 * F) * (.6 + .4 * F);
    const L = levelFit(c, a, l);
    const T = typeFit(c, a, l);
    const P = placeFit(c, a);
    const practical = .35 * T + .65 * P.fit;
    const score = Math.round(clamp(relevance * (.5 + .5 * practical) * (.25 + .75 * L.fit), 0, .99) * 100);

    // order only: freshness, "like what you saved"
    const days = daysOld(l, now);
    const fresh = days === null ? .4 : Math.exp(-days / 21);
    const it = o.interest;
    let boost = 0;
    if (it) {
        const real = [...a.skills.keys()].filter(k => !SOFT.has(k));
        boost = Math.min(6, 4 * (real.length ? real.filter(k => it.skills.has(k)).length / real.length : 0) + (l.orgId && it.orgs.has(l.orgId) ? 1.5 : 0) + ((it.types.get(l.type) || 0) >= 2 ? .5 : 0));
    }
    const isNew = !!o.lastSeen && Date.parse(l.postedAt || l.created) > o.lastSeen;

    const reasons = [], cautions = [];
    if (matched.length) {
        const total = matched.length + related.length + missing.length;
        reasons.push(total === 1 ? `Asks for ${matched[0].label}, which you have` : `You have ${matched.length} of the ${total} skills it asks for: ${list(matched.slice(0, 4).map(x => x.label))}`);
    } else if (related.length) {
        reasons.push(`Related skills: ${list(related.slice(0, 3).map(x => x.label))}`);
    }
    if (it && l.orgId && it.orgs.has(l.orgId)) { // listed early: it is the most personal reason and must survive the cut to 4
        reasons.push('From an organization you saved');
    }
    if (F >= .6) {
        reasons.push(c.field ? `Fits your ${c.field} background` : 'Fits your field');
    }
    if (a.level.years === 0 && L.seniority >= .8 && c.years <= 1) {
        reasons.push('Open to freshers');
    } else if (a.level.years !== null && L.seniority >= .8 && l.type !== 'Course') {
        reasons.push('Right level for your experience');
    }
    if (P.kind === 'remote') {
        reasons.push('Remote, so you can work from anywhere');
    } else if (P.kind === 'city') {
        reasons.push(`In ${P.city}, one of your preferred places`);
    }
    if (boost >= 2) {
        reasons.push('Similar to listings you saved');
    }
    if (days !== null && ago(days)) {
        reasons.push(ago(days));
    }
    if (a.level.years !== null && L.seniority < .5) {
        cautions.push(a.level.label === 'years' ? `Asks for ${a.level.years}+ years of experience` : 'Senior role: asks for more experience than you have');
    }
    if (a.req !== null && L.qual < .5) {
        cautions.push(`Asks for a ${QUAL_NAME[a.req]} qualification`);
    }
    if (P.kind === 'far') {
        cautions.push(`On-site in ${String(l.location).trim()}, away from your preferred places`);
    }
    return {
        kind: 'job', score, band: bandOf(score), rank: score + boost + 6 * fresh + (isNew ? 2 : 0),
        matched: matched.map(x => x.label), related: related.map(x => x.label), missing: missing.map(x => x.label), missingKeys: missing.map(x => x.key), missingW: missing.map(x => x.w),
        reasons: reasons.slice(0, 4), cautions: cautions.slice(0, 2), days, isNew
    };
}

// One course for one candidate. A course is worth more when it teaches skills the person's best-matching jobs ask for and they lack.
export function scoreCourse(c, l, a = analyseListing(l), o = {}) {
    const now = o.now ?? Date.now();
    const gap = o.gap || new Map(); // missing skill key -> how many of the best jobs ask for it
    const teaches = [...a.skills.keys()].filter(k => !SOFT.has(k));
    const fresh = teaches.filter(k => (c.cover.get(k) || 0) < .9);
    const hits = fresh.filter(k => gap.has(k));
    const F = fieldFit(c, a);
    const gapScore = clamp(hits.reduce((s, k) => s + gap.get(k), 0) / 3);
    const novelty = teaches.length ? fresh.length / teaches.length : .5;
    let total = .4 * F + .45 * gapScore + .15 * novelty;
    if (teaches.length && !fresh.length) {
        total *= .4; // nothing new for this person
    }
    const score = Math.round(clamp(total, 0, .99) * 100);
    const days = daysOld(l, now);
    const reasons = [];
    if (hits.length) {
        const n = Math.max(...hits.map(k => gap.get(k)));
        reasons.push(`Teaches ${list(hits.slice(0, 3).map(skillLabel))}, which ${n === 1 ? 'a job' : n + ' jobs'} matched to you ask${n === 1 ? 's' : ''} for`);
    }
    if (fresh.length && !hits.length) {
        reasons.push(`New to you: ${list(fresh.slice(0, 3).map(skillLabel))}`);
    }
    if (F >= .6) {
        reasons.push(c.field ? `Fits your ${c.field} background` : 'Fits your field');
    }
    if (days !== null && ago(days)) {
        reasons.push(ago(days));
    }
    return {
        kind: 'course', score, band: bandOf(score), rank: score + (hits.length ? 10 : 0) + 4 * (days === null ? .4 : Math.exp(-days / 21)),
        teaches: fresh, fills: hits.map(skillLabel), reasons: reasons.slice(0, 3), cautions: [], matched: [], related: [], missing: [], days,
        isNew: !!o.lastSeen && Date.parse(l.postedAt || l.created) > o.lastSeen
    };
}

// Best first, but never more than `perOrg` from one organization until the list would run short.
function diverse(rows, n, perOrg) {
    const seen = new Map(), out = [], rest = [];
    for (const r of rows) {
        const k = r.l.orgId || r.l.orgName || r.l.id;
        if ((seen.get(k) || 0) < perOrg) {
            seen.set(k, (seen.get(k) || 0) + 1);
            out.push(r);
        } else {
            rest.push(r);
        }
        if (out.length >= n) {
            return out;
        }
    }
    return out.concat(rest).slice(0, n);
}

// profile (as saved by PUT /profile) + approved listings -> everything the page needs.
//   o.applied / o.saved  listing ids (applied ones are never suggested; both nudge the order)
//   o.lastSeen           ms timestamp of the last visit (listings posted after it are marked new)
export function suggestFor(profile, listings, o = {}) {
    const now = o.now ?? Date.now();
    const c = buildProfile(profile, now);
    const out = { ready: c.ready, picks: [], courses: [], unlock: [], total: 0, newCount: 0 };
    if (!c.ready) {
        return out;
    }
    const applied = new Set(o.applied || []), saved = new Set(o.saved || []);
    const memo = new Map();
    const analyse = l => {
        if (!memo.has(l.id)) {
            memo.set(l.id, analyseListing(l));
        }
        return memo.get(l.id);
    };
    const all = (Array.isArray(listings) ? listings : []).filter(l => l && l.id && l.status !== 'closed' && l.status !== 'rejected');
    const interest = { skills: new Set(), orgs: new Set(), types: new Map() };
    for (const l of all) {
        if (saved.has(l.id) || applied.has(l.id)) {
            analyse(l).skills.forEach((w, k) => !SOFT.has(k) && interest.skills.add(k));
            l.orgId && interest.orgs.add(l.orgId);
            interest.types.set(l.type, (interest.types.get(l.type) || 0) + 1);
        }
    }
    const open = all.filter(l => !applied.has(l.id));
    const scored = open.filter(l => l.type !== 'Course').map(l => ({ l, m: scoreListing(c, l, analyse(l), { now, interest, lastSeen: o.lastSeen }) }))
        .filter(x => x.m.score >= MIN_SHOW).sort((x, y) => y.m.rank - x.m.rank);
    out.total = scored.length;
    out.picks = diverse(scored, o.limit ?? 12, o.perOrg ?? 2);
    out.newCount = scored.filter(x => x.m.isNew && x.m.score >= 50).length;
    // Skills that would unlock more: asked for by several of the jobs they almost qualify for.
    const gap = new Map(), gapLabel = new Map();
    for (const { m } of scored.slice(0, 15)) {
        if (m.score < 40) {
            continue;
        }
        m.missingKeys.forEach((k, i) => {
            gap.set(k, (gap.get(k) || 0) + 1);
            gapLabel.set(k, m.missing[i]);
        });
    }
    out.unlock = [...gap].map(([key, count]) => ({ key, label: gapLabel.get(key), count, courses: [] })).sort((x, y) => y.count - x.count || x.label.localeCompare(y.label)).slice(0, 5);
    const courses = open.filter(l => l.type === 'Course').map(l => ({ l, m: scoreCourse(c, l, analyse(l), { now, gap, lastSeen: o.lastSeen }) }))
        .filter(x => x.m.score >= MIN_SHOW).sort((x, y) => y.m.rank - x.m.rank);
    out.courses = courses.slice(0, o.courseLimit ?? 6);
    for (const u of out.unlock) {
        u.courses = courses.filter(x => analyse(x.l).skills.has(u.key)).slice(0, 2); // [{ l, m }]
    }
    return out;
}
