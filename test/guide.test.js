import assert from 'node:assert';
const E = await import('../public/js/features/guide/guide.engine.js');
const R = await import('../public/js/features/guide/roles.js');
const { LABEL } = await import('../public/js/features/suggestions/engine.js');
let n = 0; const ok = (c, msg) => { assert(c, msg); n++; };
// every skill a role names exists in the skill dictionary, and ids are unique
const ids = new Set();
for (const r of R.ROLES) {
    ok(!ids.has(r.id), 'unique id ' + r.id); ids.add(r.id);
    ok(r.must.length >= 2 && r.summary && r.minQual >= 1 && r.minQual <= 5, r.id + ' is complete');
    for (const x of [...r.must, ...r.nice]) { for (const k of R.itemKeys(x)) { ok(LABEL.has(k), r.id + ' uses unknown skill ' + k); } }
}
ok(R.AREAS.every(a => R.rolesIn(a[0]).length), 'every area has jobs');
// understanding the dream job
const id = t => { const u = E.understand(t); return u.kind === 'role' ? u.role.id : u.kind; };
ok(id('data scientist') === 'data-scientist', 'exact title');
ok(id('I want to be a software engineer at Google') === 'software-developer', 'sentence around the title');
ok(id('UX designer') === 'ux-designer', 'ux');
ok(id('developer') === 'choose', 'a bare "developer" asks which one');
ok(id('doctor') === 'none' && id('') === 'none', 'unknown job is not guessed');
ok(id('tax') === 'area', 'area guess');
ok(id('python developer') === 'backend-developer', 'skill + title');
// reading answers
ok(E.parseSkills('python, SQL and ms excel').join() === 'Python,SQL,Excel', 'skills named properly');
ok(E.parseSkills('none').length === 0 && E.parseSkills('').length === 0, 'no skills');
ok(E.matchQual('B.Tech') === "Bachelor's" && E.matchQual('diploma in engineering') === 'Diploma' && E.matchQual('MBA') === "Master's" && E.matchQual('zzz') === '', 'qualification words');
ok(E.matchExperience('2 years', ['a', 'b', 'c', 'd', 'e']) === 'c' && E.matchExperience('fresher', ['a', 'b', 'c', 'd', 'e']) === 'a', 'experience words');
// comparing
const da = R.roleById('data-analyst');
const none = E.assess(da, {});
ok(none.readiness === 0 && none.level === 'start' && none.qual.status === 'unknown', 'empty profile');
const some = E.assess(da, { qualification: "Bachelor's", field: 'Statistics', experience: 'Student / Fresher', skills: ['Excel', 'SQL', 'Statistics', 'Power BI', 'data analysis'] });
ok(some.readiness >= 75 && some.level === 'close' && some.qual.status === 'met' && some.field.kind === 'direct', 'strong profile');
ok(E.assess(da, { qualification: 'High School', skills: ['Excel'] }).qual.status === 'gap', 'qualification gap');
const py = E.assess(R.roleById('data-scientist'), { skills: ['Python'] });
ok(py.items.find(i => i.key === 'machine learning').status === 'missing', 'knowing Python alone is not "partly" machine learning');
ok(E.assess(R.roleById('frontend-developer'), { skills: ['React'] }).items.find(i => i.key === 'javascript').status === 'partial', 'React partly covers JavaScript');
ok(E.learnOrder(none)[0].tier === 'must' && E.learnOrder(some).every(i => i.status !== 'have'), 'learning order');
// course plan (Part 2): real catalog rows
const fs = await import('node:fs');
const { groupCourses } = await import('../public/js/features/catalog/group.js');
const C = await import('../public/js/features/guide/guide.courses.js');
const rows = JSON.parse(fs.readFileSync(new URL('../public/catalog/catalog-courses.json', import.meta.url))).rows;
const index = C.indexCourses(groupCourses(rows).list);
ok(index.length > 1000, 'courses indexed');
for (const r of R.ROLES) { for (const x of [...r.must, ...r.nice]) { const keys = R.itemKeys(x); ok(C.pickCourses(index, { keys, key: keys[0] }).length > 0, r.id + ': a catalog course for ' + keys[0]); } }
const plan = C.buildPlan(index, E.assess(da, { skills: ['Excel'] }));
ok(plan.steps.length === C.MAX_STEPS && plan.steps.every(s => s.courses.length) && plan.more >= 0, 'plan has steps with courses');
ok(plan.steps[0].item.tier === 'must' && new Set(plan.steps.flatMap(s => s.courses.map(c => c.id))).size === plan.steps.flatMap(s => s.courses).length, 'core first, no course repeated');
ok(C.searchLinks('Python').length === 4 && C.searchLinks('Python').every(l => /^https:\/\//.test(l.u)), 'fallback search links');
// books and the 3-phase roadmap (Part 3)
const K = await import('../public/js/features/guide/guide.books.js');
const M = await import('../public/js/features/guide/guide.roadmap.js');
ok(Object.keys(K.BOOKS).every(k => LABEL.has(k)), 'every book row is for a real skill key');
ok(Object.values(K.BOOKS).every(l => l.length && l.every(b => b[0] && b[1] && (!b[2] || /^https:\/\//.test(b[2])))), 'every book has a title, author and a safe free link if any');
const gaps = new Set();
for (const r of R.ROLES) { for (const x of [...r.must, ...r.nice]) { const keys = R.itemKeys(x); K.pickBooks({ keys, key: keys[0] }).length || gaps.add(keys[0]); } }
ok(gaps.size < 25, 'most skills have a book pick (' + gaps.size + ' without)');
ok(K.pickBooks({ key: 'zzz', keys: ['zzz', 'python'] })[0].t === 'Automate the Boring Stuff with Python' && K.pickBooks({ key: 'zzz', keys: ['zzz'] }).length === 0, 'book fallback order');
const bl = K.bookLinks({ t: 'Clean Code', a: 'Robert C. Martin' });
ok(bl[0].app && bl[0].u === '#/library?q=Clean+Code&free=1' && bl.slice(1).every(l => /^https:\/\//.test(l.u)) && bl.length === 4, 'book links: Library first, then 3 outside');
const road = M.buildRoadmap(E.assess(da, { skills: ['Excel'] }), plan, 1700000000000);
ok(road.phases.map(p => p.id).join() === 'foundations,tools,projects', 'three phases in order');
ok(road.phases[0].items.length + road.phases[1].items.length === plan.steps.length && road.phases[0].items.length === Math.ceil(plan.steps.length / 2), 'steps split between foundations and tools');
ok(road.phases[0].items[0].tier === 'must' && road.phases[0].items.every(i => i.courses.length), 'foundations start with core skills that have courses');
ok(road.phases[2].ideas.length === 2 && road.phases[2].uses.length === 3 && M.totalWeeks(road) === plan.steps.length * M.WEEKS_PER_STEP + M.PROJECT_WEEKS, 'projects phase and total weeks');
const tiny = M.buildRoadmap(E.assess(da, { skills: ['Excel', 'SQL', 'Statistics', 'Power BI', 'data analysis'] }), C.buildPlan(index, { items: [] }));
ok(tiny.phases.length === 3 && tiny.phases[0].items.length === 0 && tiny.phases[1].weeks === 0, 'an empty plan still gives three phases');
const txt = M.roadmapText(road, 'https://x.test/');
ok(/Phase 1: Foundations/.test(txt) && /Phase 3: Projects/.test(txt) && /Book: /.test(txt) && /Made with Fyndr: https:\/\/x.test\//.test(txt), 'share text');
ok(JSON.stringify(M.cleanRoadmap(JSON.parse(JSON.stringify(road)))) === JSON.stringify(M.cleanRoadmap(road)) && M.cleanRoadmap(JSON.parse(JSON.stringify(road))).phases[0].items[0].label === road.phases[0].items[0].label, 'a saved roadmap reads back the same');
ok(M.cleanRoadmap(null) === null && M.cleanRoadmap({ v: 1, role: {}, phases: [] }) === null && M.cleanRoadmap({ v: 2 }) === null, 'damaged saves are ignored');
const evil = JSON.parse(JSON.stringify(road)); evil.phases[0].items[0].label = 'x'.repeat(500); evil.phases[0].items[0].courses[0].u = 'javascript:alert(1)'; evil.phases[0].items = evil.phases[0].items.concat(Array(20).fill(evil.phases[0].items[0]));
const cl = M.cleanRoadmap(evil);
ok(cl.phases[0].items.length === 6 && cl.phases[0].items[0].label.length === 100, 'saved data is size-limited');
// typos in the dream job
const fz = t => { const u = E.understand(t); return (u.kind === 'role' ? u.role.id : u.kind) + (u.fuzzy ? '*' : ''); };
for (const [t, want] of [['sofware enginer', 'software-developer'], ['data scintist', 'data-scientist'], ['mechnical engineer', 'mechanical-engineer'], ['datascientist', 'data-scientist'], ['ux desiner', 'ux-designer'], ['buisness analyst', 'business-analyst'], ['machin learning enginer', 'ml-engineer'], ['accountent', 'accountant'], ['civl engineer', 'civil-engineer'], ['teachr', 'teacher']]) {
    ok(fz(t) === want + '*', `typo "${t}" -> ${want} (got ${fz(t)})`);
}
ok(fz('data analyst') === 'data-analyst' && fz('doctor') === 'none' && fz('xyzzy') === 'none' && fz('tax') === 'area', 'correct input is not flagged, unknown stays unknown');
ok(E.editDistance('sofware', 'software') === 1 && E.editDistance('teh', 'the') === 1 && E.correctTypos('data analyst').length === 0, 'edit distance counts a swap as one mistake');
// live book copies
const mk = (title, access, extra = {}) => ({ title, authors: ['x'], access, src: 'Open Library', info: 'https://openlibrary.org/works/OL1W', read: null, ...extra });
const c1 = K.bestCopy('Clean Code', [mk('Clean Code: A Handbook', 'borrow'), mk('Clean Coder', 'free', { read: { kind: 'gutenberg', id: '12' } }), mk('Clean Code', 'free', { src: 'Project Gutenberg', read: { kind: 'gutenberg', id: '12' } })]);
ok(c1 && c1.access === 'free' && /^https:\/\/www\.gutenberg\.org\//.test(c1.u) && c1.label === 'Read free on Project Gutenberg', 'best copy: free beats borrow, similar titles only');
ok(K.bestCopy('Clean Code', [mk('Cooking for Beginners', 'free', { read: { kind: 'gutenberg', id: '1' } })]) === null && K.bestCopy('Clean Code', []) === null, 'no copy when nothing matches');
ok(K.bestCopy('Clean Code', [mk('Clean Code', 'borrow', { info: 'http://evil.test/x' })]) === null, 'only https links are used');
console.log(`\n${n} passed, 0 failed`);
