// Part 3 of the career guide: puts the course plan (Part 2) and the books (guide.books.js) into three phases.
//   1 Foundations: the first half of the plan, the skills everything else rests on (the plan is already in foundations-first order).
//   2 Tools: the rest of the plan.
//   3 Projects: one project that uses what was learned, plus the next moves (profile, applications).
// Pure functions plus a small browser-only save (localStorage): no network, nothing typed leaves the device.
// A roadmap is plain JSON so it can be saved and shared:
//   { v: 1, at, role: { id, title }, phases: [{ id, title, weeks, items: [...], ideas: [...] }] }
import { pickBooks } from './guide.books.js';

export const WEEKS_PER_STEP = 3; // same rough pace as Part 2: 2 to 4 weeks per step at about 5 hours a week
export const PROJECT_WEEKS = 4;
const IDEAS = {
    tech: ['Build one small app that solves a problem you really have (a notes app, a budget tracker, a quiz site). Put the code on GitHub with a clear README.', 'Add tests and a one-page write-up of how it works and what you would improve.'],
    engineering: ['Design one small system end to end (a circuit, a mechanism or a structure): requirements, calculations, drawings and a short report.', 'Simulate it in the tool you learned and note where the result differs from your hand calculations.'],
    data: ['Pick a public dataset you care about, clean it, find three insights and show them in a short dashboard or notebook.', 'Write a one-page summary that a non-technical person could act on.'],
    design: ['Redesign one real app, poster or video you use and show the before and after with your reasons.', 'Make a portfolio page with three finished pieces, each with the problem it solved.'],
    marketing: ['Plan and run a small real campaign for a local shop or a college club for two weeks, and track the numbers.', 'Write a one-page result: what worked, what did not, what you would change.'],
    writing: ['Write three samples in different styles (a how-to, a short explainer, a product page) and edit each one twice.', 'Publish them on a simple page and ask two people for honest feedback.'],
    business: ['Pick a real process (an admission desk, a shop, an event) and map how it works today, where it breaks and how you would fix it.', 'Present it in five slides with numbers.'],
    finance: ['Take one listed company\u2019s public annual report and write a one-page analysis: revenue, profit, debt and your view.', 'Rebuild the numbers in a spreadsheet so anyone can check them.'],
    education: ['Plan and teach one 20-minute lesson to a small group, then collect feedback.', 'Write the lesson plan: goals, activities and a quick check of understanding.']
};
const GENERIC = IDEAS.business;
export const ideasFor = domain => IDEAS[domain] || GENERIC;

const course = c => {
    const l = (c.links || []).find(x => x && x.u) || {};
    return { t: String(c.title).slice(0, 140), u: l.u || '', n: l.n || '', free: !!(c.allFree || c.free) };
};
const mk = st => ({
    label: st.item.label, tier: st.item.tier, partial: st.item.status === 'partial',
    courses: st.courses.map(course), search: st.search || [], books: pickBooks(st.item), skill: st.item.label
});

// assessment (assess()) + course plan (buildPlan()) -> roadmap
export function buildRoadmap(a, plan, now = Date.now()) {
    const steps = plan.steps.map(mk);
    const cut = steps.length <= 2 ? Math.min(1, steps.length) : Math.ceil(steps.length / 2);
    const first = steps.slice(0, cut);
    const next = steps.slice(cut);
    return {
        v: 1, at: now, role: { id: a.role.id, title: a.role.title },
        phases: [
            { id: 'foundations', title: 'Foundations', weeks: first.length * WEEKS_PER_STEP, items: first, ideas: [] },
            { id: 'tools', title: 'Tools', weeks: next.length * WEEKS_PER_STEP, items: next, ideas: [] },
            { id: 'projects', title: 'Projects', weeks: PROJECT_WEEKS, items: [], ideas: ideasFor(a.role.domain), uses: steps.slice(0, 3).map(s => s.label) }
        ],
        more: plan.more || 0
    };
}

export const totalWeeks = r => r.phases.reduce((n, p) => n + (p.weeks || 0), 0);

// A plain-text copy for sharing in a message or note.
export function roadmapText(r, url = '') {
    const out = [`My career roadmap for ${r.role.title} (Fyndr career guide)`, `About ${totalWeeks(r)} weeks at roughly 5 hours a week`, ''];
    r.phases.forEach((p, i) => {
        out.push(`Phase ${i + 1}: ${p.title} (about ${p.weeks} weeks)`);
        p.items.forEach((it, n) => {
            out.push(`  ${n + 1}. ${it.label}`);
            it.courses.forEach(c => out.push(`     Course: ${c.t}${c.n ? ' on ' + c.n : ''}${c.u ? ' - ' + c.u : ''}`));
            it.books.forEach(b => out.push(`     Book: ${b.t}, ${b.a}${b.free ? ' (free online: ' + b.free + ')' : ''}`));
        });
        p.ideas.forEach(x => out.push('  - ' + x));
        out.push('');
    });
    url && out.push('Made with Fyndr: ' + url);
    return out.join('\n').trim();
}

// ---------- saving (this browser only) ----------
const KEY = 'fyRoadmap';
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
// Anything read back from storage is checked and rebuilt, so a damaged or edited record can never break the page.
export function cleanRoadmap(v) {
    if (!v || typeof v !== 'object' || v.v !== 1 || !v.role || !Array.isArray(v.phases) || v.phases.length !== 3) {
        return null;
    }
    return {
        v: 1, at: +v.at || 0, role: { id: str(v.role.id, 60), title: str(v.role.title, 80) }, more: +v.more || 0,
        phases: v.phases.map(p => ({
            id: str(p.id, 20), title: str(p.title, 40), weeks: +p.weeks || 0, uses: (Array.isArray(p.uses) ? p.uses : []).slice(0, 3).map(x => str(x, 80)),
            ideas: (Array.isArray(p.ideas) ? p.ideas : []).slice(0, 4).map(x => str(x, 300)),
            items: (Array.isArray(p.items) ? p.items : []).slice(0, 6).map(it => ({
                label: str(it.label, 100), tier: it.tier === 'nice' ? 'nice' : 'must', partial: !!it.partial, skill: str(it.label, 100),
                courses: (Array.isArray(it.courses) ? it.courses : []).slice(0, 2).map(c => ({ t: str(c.t, 140), u: str(c.u, 600), n: str(c.n, 60), free: !!c.free })),
                search: (Array.isArray(it.search) ? it.search : []).slice(0, 4).map(l => ({ n: str(l.n, 60), u: str(l.u, 600), kind: str(l.kind, 20) })),
                books: (Array.isArray(it.books) ? it.books : []).slice(0, 3).map(b => ({ t: str(b.t, 140), a: str(b.a, 120), ...(b.free ? { free: str(b.free, 600) } : {}) }))
            }))
        }))
    };
}
export function saveRoadmap(r) {
    try {
        localStorage.setItem(KEY, JSON.stringify(r));
        return true;
    } catch {
        return false;
    }
}
export function loadRoadmap() {
    try {
        return cleanRoadmap(JSON.parse(localStorage.getItem(KEY) || 'null'));
    } catch {
        return null;
    }
}
export function forgetRoadmap() {
    try {
        localStorage.removeItem(KEY);
    } catch { }
}
