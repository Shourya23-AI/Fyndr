// Career guide engine: reads a dream job typed in plain words, then compares it with what the person has.
// Pure functions: no DOM, no network, no AI service. It runs in the browser, so what people type stays on their device.
// It reuses the suggestions engine (buildProfile / skill dictionary), so "Python", "python3" and "py" all count as the same skill,
// and having React also covers part of JavaScript, exactly as it does when jobs are ranked for you.
import { buildProfile, extractSkills, skillLabel, tokens } from '../suggestions/engine.js';
import { FIELD_DOMAINS, ROLE_DOMAINS } from '../suggestions/taxonomy.js';
import { ROLES, AREAS, itemKeys, rolesIn } from './roles.js';

export const QUAL_NAME = { 1: '12th-grade', 2: 'Diploma', 3: 'Bachelor\u2019s', 4: 'Master\u2019s', 5: 'PhD' };
const HAVE_AT = .75; // coverage from this up counts as "you have it"
const PART_AT = .4; // from this up it counts as "partly covered" (a skill that includes it, or one only shown in a project). Just knowing a neighbouring skill (Python for machine learning) is not enough.
const NICE_WEIGHT = .4; // a nice-to-have counts for 40% of a core skill in the readiness number

// ---------- understanding the dream job ----------
// Words that only describe the sentence ("I want to become a ...") and never the job.
const FILLER = new Set(['i', 'want', 'wanna', 'to', 'be', 'become', 'a', 'an', 'the', 'my', 'dream', 'job', 'jobs', 'is', 'am', 'as', 'at', 'in', 'of', 'for', 'work', 'working', 'role', 'career', 'like', 'would', 'love', 'looking', 'aspire', 'aspiring', 'future', 'fresher', 'entry', 'level', 'junior', 'senior', 'intern', 'internship']);
// Job words shared by many titles: they help a little, but "developer" alone must not decide anything.
const GENERIC = new Set(['engineer', 'developer', 'executive', 'officer', 'manager', 'specialist', 'analyst', 'associate', 'designer', 'writer', 'editor']);
const phrase = s => tokens(s).join(' ');

const INDEX = ROLES.map(role => {
    const names = [role.title, ...role.aka];
    return {
        role,
        aliases: names.map(phrase).filter(Boolean),
        words: new Set(names.flatMap(n => tokens(n)).filter(w => w.length > 2)),
        keys: new Set(role.must.flatMap(itemKeys))
    };
});

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

// ---------- typos ----------
// Every word the job list knows. A typed word that is not one of them is replaced by the closest one ("sofware" -> "software"), or split in two
// ("datascientist" -> "data scientist"), and the corrected sentence is ranked again. A correction is only used when it matches a job better than the original.
const VOCAB = new Map();
for (const { role } of INDEX.map(x => x)) {
    for (const w of new Set([role.title, ...role.aka].flatMap(n => tokens(n)).filter(x => x.length > 2))) {
        VOCAB.set(w, (VOCAB.get(w) || 0) + 1);
    }
}
// edit distance where swapping two neighbouring letters counts as one mistake
export function editDistance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) {
        d[0][j] = j;
    }
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
            }
        }
    }
    return d[a.length][b.length];
}
const allowed = n => (n <= 3 ? 0 : n <= 6 ? 1 : 2);
// every word that is as close as it gets ("mechnical" is one mistake from both "mechanical" and "technical": the sentence decides which)
function fixWord(w) {
    if (VOCAB.has(w) || FILLER.has(w) || /\d/.test(w) || w.length <= 3) {
        return [[w]];
    }
    let best = 9;
    let near = [];
    for (const v of VOCAB.keys()) {
        const d = editDistance(w, v);
        if (d <= allowed(Math.max(w.length, v.length)) && d <= best) {
            d < best && (near = []);
            best = d;
            near.push([v]);
        }
    }
    if (near.length) {
        return near.slice(0, 4);
    }
    for (let i = 3; i <= w.length - 3; i++) {
        if (VOCAB.has(w.slice(0, i)) && VOCAB.has(w.slice(i))) {
            return [[w.slice(0, i), w.slice(i)]];
        }
    }
    return [[w]];
}
// the sentences with misspelt words fixed (usually one, a few when a word could mean two things); [] when nothing needed fixing
export function correctTypos(text) {
    const toks = tokens(text);
    let out = [[]];
    for (const t of toks) {
        out = out.flatMap(o => fixWord(t).map(c => [...o, ...c])).slice(0, 16);
    }
    return out.map(o => o.join(' ')).filter(x => x !== toks.join(' '));
}

// text -> every job that fits, best first: [{ role, score, exact }]
export function rankRoles(text) {
    const toks = tokens(text).filter(t => !FILLER.has(t));
    if (!toks.length) {
        return [];
    }
    const g = grams(toks);
    const set = new Set(toks);
    const skills = new Set(extractSkills(text));
    return INDEX.map(({ role, aliases, words, keys }) => {
        let exact = 0;
        for (const a of aliases) {
            if (g.has(a)) {
                exact = Math.max(exact, 10 + a.split(' ').length);
            }
        }
        let overlap = 0;
        for (const w of words) {
            if (set.has(w)) {
                overlap += GENERIC.has(w) ? .5 : 1;
            }
        }
        let hint = 0;
        for (const k of skills) {
            if (keys.has(k)) {
                hint += 1.5;
            }
        }
        return { role, exact: exact > 0, score: Math.max(exact, overlap * 2) + Math.min(hint, 3) };
    }).filter(x => x.score >= 1).sort((a, b) => b.score - a.score);
}

// The area a text sounds like ("tax", "banking" ...), or '' when it does not sound like any.
export function areaOf(text) {
    const t = String(text || '').toLowerCase();
    for (const [re, cats] of ROLE_DOMAINS) {
        const hit = cats.map(c => c[0]).find(c => AREAS.some(a => a[0] === c));
        if (hit && re.test(t)) {
            return hit;
        }
    }
    return '';
}

// text -> { kind: 'role', role } the job is clear
//       | { kind: 'choose', roles: [...] } a few jobs fit, ask which one
//       | { kind: 'area', area, roles } no job named, but the area is clear
//       | { kind: 'none' }
export function understand(text) {
    let r = rankRoles(text);
    let fuzzy = '';
    for (const fixed of correctTypos(text)) {
        const r2 = rankRoles(fixed);
        if (r2.length && r2[0].score > (r[0] ? r[0].score : 0)) {
            r = r2;
            fuzzy = fixed;
        }
    }
    const [a, b] = r;
    if (a && ((a.exact && (!b || b.score <= a.score - 2)) || (a.score >= 5 && (!b || b.score <= a.score - 2)))) {
        return { kind: 'role', role: a.role, ...(fuzzy ? { fuzzy } : {}) };
    }
    if (a) {
        const top = r.filter(x => x.score >= a.score * .5).slice(0, 3).map(x => x.role);
        return top.length === 1 ? { kind: 'role', role: top[0], ...(fuzzy ? { fuzzy } : {}) } : { kind: 'choose', roles: top };
    }
    const area = areaOf(text);
    return area ? { kind: 'area', area, roles: rolesIn(area) } : { kind: 'none' };
}

// ---------- reading what the person typed ----------
const NONE = /^(none|no|nil|nothing|not yet|nope|n\/?a|zero|no skills?( yet)?|-+)$/i;
// "python, sql and excel" -> ['Python', 'SQL', 'Excel'] (known skills get their proper name, unknown ones are kept as typed)
export function parseSkills(text) {
    const t = String(text || '').trim();
    if (!t || NONE.test(t)) {
        return [];
    }
    const out = [];
    const add = s => {
        if (s && !out.some(x => x.toLowerCase() === s.toLowerCase()) && out.length < 30) {
            out.push(s);
        }
    };
    for (const part of t.split(/[,;\n|]+|\band\b|\s\/\s|&/i).map(x => x.trim()).filter(Boolean)) {
        const known = extractSkills(part);
        if (known.length) {
            known.forEach(k => add(skillLabel(k)));
        } else if (part.length <= 40 && !NONE.test(part)) {
            add(part);
        }
    }
    return out;
}

export function matchQual(text) {
    const t = String(text || '').toLowerCase();
    if (/ph\.?d|doctorate/.test(t)) {
        return 'PhD';
    }
    if (/master|m\.?tech|\bmba\b|m\.?sc|\bmca\b|\bpg\b|post.?grad|m\.?com/.test(t)) {
        return 'Master\'s';
    }
    if (/diploma|polytechnic|\biti\b/.test(t)) {
        return 'Diploma';
    }
    if (/bachelor|b\.?tech|\bb\.?e\b|b\.?sc|\bbca\b|b\.?com|\bbba\b|\bb\.?a\b|degree|graduat|\bug\b/.test(t)) {
        return 'Bachelor\'s';
    }
    if (/\b12(th)?\b|\b10(th)?\b|school|hsc|ssc|intermediate/.test(t)) {
        return 'High School';
    }
    return /other/.test(t) ? 'Other' : '';
}

export function matchExperience(text, levels) {
    const t = String(text || '').toLowerCase().trim();
    const exact = levels.find(l => l.toLowerCase() === t);
    if (exact) {
        return exact;
    }
    if (!t || /fresher|student|none|no |nil|zero|learning|beginner/.test(t)) {
        return /\d/.test(t) ? '' : levels[0];
    }
    const n = parseFloat((t.match(/\d+(\.\d+)?/) || [])[0]);
    if (!Number.isFinite(n)) {
        return '';
    }
    return n < 1 ? levels[1] : n < 3 ? levels[2] : n < 5 ? levels[3] : levels[4];
}

// ---------- comparing with the person ----------
const coverOf = (me, keys) => {
    let best = 0;
    let key = keys[0];
    for (const k of keys) {
        const c = me.cover.get(k) || 0;
        if (c > best) {
            best = c;
            key = k;
        }
    }
    return { best, key };
};

function fieldFit(role, p) {
    const text = [p.field, p.headline, ...(Array.isArray(p.education) ? p.education.map(e => e && e.degree) : [])].filter(Boolean).join(' ').toLowerCase();
    if (!text.trim()) {
        return { kind: 'unknown', field: '' };
    }
    const w = new Map();
    for (const [re, cats] of FIELD_DOMAINS) {
        if (re.test(text)) {
            cats.forEach(([c, x]) => w.set(c, (w.get(c) || 0) + x));
        }
    }
    const x = w.get(role.domain) || 0;
    return { kind: x >= 1.5 ? 'direct' : x > 0 ? 'related' : 'different', field: String(p.field || '').trim() };
}

function qualCheck(role, me, p) {
    const known = !!(p.qualification && String(p.qualification).trim());
    const need = role.minQual;
    const have = me.qual;
    let status = 'unknown';
    if (known) {
        status = have >= need ? (me.studying ? 'on-track' : 'met') : (me.studying && have + 1 >= need ? 'on-track' : 'gap');
    }
    return { status, have: known ? (QUAL_NAME[Math.round(have)] || String(p.qualification)) : '', need: QUAL_NAME[need], note: role.qualNote, studying: me.studying };
}

// role + person -> everything the guide says about where the person stands.
//   readiness 0-100 | items [{ tier: 'must'|'nice', label, key, keys, cover, status: 'have'|'partial'|'missing' }]
//   qual { status: 'met'|'on-track'|'gap'|'unknown', ... } | field { kind } | years | level 'start'|'base'|'solid'|'close'
export function assess(role, profile) {
    const p = profile || {};
    const me = buildProfile(p);
    const items = [...role.must.map(x => ['must', x]), ...role.nice.map(x => ['nice', x])].map(([tier, x]) => {
        const keys = itemKeys(x);
        const { best, key } = coverOf(me, keys);
        return {
            tier, keys, key, cover: best, label: typeof x === 'string' ? skillLabel(x) : x.label,
            status: best >= HAVE_AT ? 'have' : best >= PART_AT ? 'partial' : 'missing'
        };
    });
    let got = 0;
    let all = 0;
    for (const it of items) {
        const w = it.tier === 'must' ? 1 : NICE_WEIGHT;
        got += w * Math.min(1, it.cover);
        all += w;
    }
    const readiness = all ? Math.round(100 * got / all) : 0;
    const coreMissing = items.filter(i => i.tier === 'must' && i.status !== 'have').length;
    return {
        role, me, items, readiness,
        level: readiness >= 75 ? 'close' : readiness >= 45 ? 'solid' : readiness >= 20 ? 'base' : 'start',
        coreMissing,
        qual: qualCheck(role, me, p), field: fieldFit(role, p), years: me.years, studying: me.studying,
        otherSkills: [...me.have].filter(([k]) => !items.some(i => i.keys.includes(k))).map(([, l]) => l)
    };
}

// The skills still worth learning, in the order to learn them: core before nice-to-have, foundations first (as listed in roles.js),
// and skills the person only half has before skills they have not touched.
export function learnOrder(a) {
    const rank = i => (i.tier === 'must' ? 0 : 10) + (i.status === 'partial' ? 0 : 5);
    return a.items.filter(i => i.status !== 'have').map((i, n) => ({ ...i, n })).sort((x, y) => rank(x) - rank(y) || x.n - y.n);
}
