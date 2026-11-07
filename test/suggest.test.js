// Checks for the suggestions engine (public/js/features/suggestions). Pure code: no Firebase, no browser.  Run:  node test/suggest.test.js
import { SKILLS, IMPLIES, FAMILIES } from '../public/js/features/suggestions/taxonomy.js';
import * as E from '../public/js/features/suggestions/engine.js';

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const eq = (a, b, n) => ok(JSON.stringify(a) === JSON.stringify(b), n + ' -> ' + JSON.stringify(a));

const NOW = Date.parse('2026-10-11T00:00:00Z');
const ago = n => new Date(NOW - n * 864e5).toISOString();
let seq = 0;
const L = (title, type, location, description, o = {}) => ({ id: 'l' + ++seq, title, type, location, description, orgId: o.orgId || 'o' + seq, orgName: 'Org', created: ago(o.age ?? 3), ...o });
const fresher = { qualification: "Bachelor's", field: 'Computer Science', gradYear: 2026, skills: ['Python', 'SQL', 'Excel'], skillLevels: { Python: 4, SQL: 3, Excel: 3 }, experience: 'Student / Fresher', jobTypes: ['Internship', 'Job'], locations: 'Bangalore, Remote', headline: 'Aspiring data analyst' };
const score = (p, l) => E.scoreListing(E.buildProfile(p, NOW), l, undefined, { now: NOW });

// ---- the skill dictionary itself
eq(E.CLASHES, [], 'no two skills claim the same wording');
const keys = new Set(SKILLS.map(s => s[0]));
ok(keys.size === SKILLS.length, 'skill keys are unique');
ok(IMPLIES.every(([a, b, w]) => keys.has(a) && keys.has(b) && w > 0 && w <= 1), 'every IMPLIES row names real skills');
ok(FAMILIES.flat().every(k => keys.has(k)), 'every FAMILIES entry names a real skill');
ok(SKILLS.every(([k, label, cat]) => label && ['tech', 'data', 'design', 'marketing', 'writing', 'business', 'finance', 'engineering', 'education', 'soft'].includes(cat)), 'every skill has a label and a known category');

// ---- finding skills in text: whole words only
eq(E.extractSkills('Strong JavaScript and TypeScript'), ['javascript', 'typescript'], 'javascript is not java');
eq(E.extractSkills('Core Java developer'), ['java'], 'java alone');
eq(E.extractSkills('C/C++ and C# for embedded work').sort(), ['c', 'cpp', 'csharp'], 'c, c++ and c# are told apart');
ok(!E.extractSkills('We go to market fast. R&D team. Go getters welcome.').some(k => k === 'go' || k === 'r'), '"go" and "R" in plain sentences are not skills');
ok(E.extractSkills('Backend in Golang').includes('go'), 'golang is Go');
ok(E.extractSkills('Node.js, React.js and .NET').join() === 'node.js,react,dotnet', 'dots and plus signs inside names');
ok(E.extractSkills('Build REST APIs and use Machine Learning, MS Excel, Power BI').join() === 'rest api,machine learning,excel,power bi', 'phrases of several words, plurals');
ok(E.extractSkills('visit https://careers.example.net/jobs for details').length === 0, 'links are ignored');
ok(!E.extractSkills('Spring 2027 internship, express interest, testing the waters').length, 'ordinary words are not skills');
eq(E.canon('C').key, 'c', 'typing "C" as a skill works');
eq(E.canon('ReactJS').key, 'react', 'ReactJS is React');
ok(E.canon('Public Speaking').custom === true && E.canon('Public Speaking').label === 'Public Speaking', 'unknown skills are kept as custom skills');
ok(E.canon('   ') === null, 'blank skill ignored');

// ---- scoring: good fit, wrong level, wrong field
const intern = L('Data Analyst Intern', 'Internship', 'Bengaluru, KA', 'Work with SQL, Python and Excel to build dashboards in Power BI. Freshers welcome.');
const senior = L('Senior Java Architect', 'Job', 'New York, NY', "Needs 8+ years of experience with Java, Spring Boot, Kubernetes and AWS. Master's degree preferred.");
const front = L('Frontend Developer', 'Job', 'Remote · Worldwide', 'Build UI with React, JavaScript and TypeScript. 1-3 years of experience.');
const reception = L('Receptionist', 'Job', 'Pune', 'Front desk, phone calls and visitors. Communication skills.');
const m1 = score(fresher, intern);
ok(m1.score >= 65 && m1.band === 'strong' || m1.band === 'good', 'fresher with the right skills in the right city: ' + m1.score);
ok(m1.matched.join() === 'SQL,Python,Excel' && m1.related.includes('Power BI') && m1.missing.length === 0, 'matched skills are listed; Power BI is related to Excel, so it is not "missing"');
const m1b = score({ ...fresher, skills: ['Python'], skillLevels: {} }, L('Data Analyst Intern', 'Internship', 'Bengaluru', 'SQL, Python and Tableau. Freshers welcome.'));
ok(m1b.matched.join() === 'Python' && m1b.missing.slice().sort().join() === 'SQL,Tableau', 'a truly absent skill is listed as missing: ' + m1b.missing);
ok(m1.reasons.some(r => /Open to freshers/.test(r)) && m1.reasons.some(r => /Bangalore/.test(r)), 'reasons mention fresher-friendly and the preferred city (Bengaluru = Bangalore)');
ok(score(fresher, senior).score < 20, 'a senior role is not a match for a fresher: ' + score(fresher, senior).score);
ok(score(fresher, senior).cautions.length > 0, 'senior role comes with a caution');
ok(score(fresher, front).score < E.MIN_SHOW, 'no overlapping skills means not suggested: ' + score(fresher, front).score);
ok(score(fresher, reception).score < E.MIN_SHOW, 'different field is not suggested: ' + score(fresher, reception).score);
ok(m1.score > score(fresher, L('Data Analyst Intern', 'Internship', 'Chennai', intern.description)).score, 'the same listing in a city they did not choose scores lower');
ok(score({ ...fresher, locations: 'Remote' }, L('Data Analyst Intern', 'Internship', 'Remote', intern.description)).score >= m1.score - 2, 'remote works for someone who wants remote');

// seniority and years
const yrs = (t, d) => E.analyseListing(L(t, 'Job', 'Pune', d)).level;
eq(yrs('Analyst', 'Founded 15 years ago. We are a friendly team.'), { years: null, label: '' }, 'company age is not a years-of-experience ask');
eq(yrs('Analyst', 'Needs 2-4 years of experience in SQL.').years, 2, 'lowest years in a range');
eq(yrs('Lead Generation Executive', 'Cold calling').years, null, '"Lead Generation" is not a lead role');
eq(yrs('Marketing Manager Trainee', '').years, 0, 'trainee wins over manager');
ok(score({ ...fresher, experience: '5+ years' }, intern).score < m1.score, 'a very experienced person is a weaker match for an internship');
ok(score({ ...fresher, experience: '1–3 years' }, L('Analyst', 'Job', 'Bengaluru', 'SQL, Python, Excel. 3 years of experience.')).score < score({ ...fresher, experience: '3–5 years' }, L('Analyst', 'Job', 'Bengaluru', 'SQL, Python, Excel. 3 years of experience.')).score, 'experience closer to the ask scores higher');
// degree
const phd = L('Research Analyst', 'Job', 'Bengaluru', 'SQL, Python, Excel. PhD required.');
ok(score({ ...fresher, qualification: 'PhD' }, phd).score > score(fresher, phd).score, 'asked-for degree counts');

// ---- skills: related credit, levels, custom, importer-provided skills
const reactJob = L('JavaScript Developer', 'Job', 'Remote', 'Build with JavaScript. Fresher friendly.');
ok(score({ ...fresher, skills: ['React'], skillLevels: {} }, reactJob).matched.length === 0 && score({ ...fresher, skills: ['React'], skillLevels: {} }, reactJob).related.join() === 'JavaScript', 'React counts as related to JavaScript');
ok(score({ ...fresher, skills: ['Python'], skillLevels: { Python: 5 } }, intern).score > score({ ...fresher, skills: ['Python'], skillLevels: { Python: 1 } }, intern).score, 'a higher skill level scores higher');
const talk = L('Community Intern', 'Internship', 'Pune', 'You will run events. Public speaking is a plus.');
ok(score({ ...fresher, skills: ['Public Speaking'], locations: 'Pune', field: 'Mass Communication' }, talk).matched.join() === 'Public Speaking', 'a skill we do not know is still matched by its words');
ok(score({ ...fresher, skills: ['C'] }, L('Customer Care Executive', 'Job', 'Pune', 'Handle customer calls and emails in English.')).score < E.MIN_SHOW, 'skill "C" does not match listings that merely contain the letter c');
ok(score({ ...fresher, skills: ['Java'] }, L('JavaScript Developer', 'Job', 'Pune', 'JavaScript and React')).matched.length === 0, 'Java does not match JavaScript listings');
ok(E.analyseListing(L('Intern', 'Internship', 'Pune', 'Join us', { skills: ['Figma', 'Storytelling'] })).skills.has('figma'), 'skills supplied by the importer are used');
const proj = L('Backend Intern', 'Internship', 'Pune', 'Use Django and PostgreSQL.');
ok(score({ ...fresher, skills: ['HTML'], projects: 'Built a blog with Django and PostgreSQL', locations: 'Pune' }, proj).related.length > 0, 'skills seen only in projects earn partial credit');

// ---- whole-list behaviour
const pool = [intern, senior, front, reception,
    L('Junior Data Scientist', 'Job', 'Hyderabad', 'Machine learning with Python, pandas and SQL. 0-2 years experience. Docker is a plus.'),
    L('Docker for Beginners', 'Course', 'Online', 'Containers with Docker and Kubernetes.'),
    L('SQL Basics', 'Course', 'Online', 'Learn SQL and PostgreSQL.')];
const run = (o = {}, p = fresher, ls = pool) => E.suggestFor(p, ls, { now: NOW, ...o });
const r = run();
ok(r.ready && r.picks[0].l.id === intern.id, 'the best fit is first');
ok(r.picks.every(x => x.m.score >= E.MIN_SHOW) && !r.picks.some(x => x.l.id === senior.id || x.l.id === front.id), 'weak matches are left out');
ok(r.picks.every(x => x.l.type !== 'Course') && r.courses.every(x => x.l.type === 'Course'), 'courses are kept apart from jobs');
ok(r.unlock.some(u => u.key === 'docker') && r.courses[0].l.title === 'Docker for Beginners' && r.courses[0].m.fills.includes('Docker'), 'a missing skill leads to a course that teaches it');
ok(r.unlock.find(u => u.key === 'docker').courses[0].l.title === 'Docker for Beginners', 'each skill gap lists its courses');
ok(!run({ applied: [intern.id] }).picks.some(x => x.l.id === intern.id), 'jobs already applied to are not suggested');
eq(E.suggestFor({}, pool, { now: NOW }).picks, [], 'a profile without skills gets nothing (and no error)');
eq(E.suggestFor(null, null, { now: NOW }).picks, [], 'missing profile and listings do not throw');

// newness, freshness, saved: order changes, match % does not
const old = L('Data Analyst Trainee', 'Internship', 'Bengaluru', intern.description, { age: 60, orgId: 'oa' });
const young = L('Data Analyst Trainee', 'Internship', 'Bengaluru', intern.description, { age: 0, orgId: 'ob' });
const fr = run({}, fresher, [old, young]);
ok(fr.picks[0].l.id === young.id && fr.picks[0].m.score === fr.picks[1].m.score, 'newer listing first, same match %');
ok(run({ lastSeen: NOW - 5 * 864e5 }, fresher, [old, young]).newCount === 1 && run({}, fresher, [old, young]).newCount === 0, 'new since the last visit is counted only when there was a last visit');
const twinA = L('Data Analyst Intern', 'Internship', 'Bengaluru', intern.description, { age: 5, orgId: 'oa' });
const twinB = L('Data Analyst Intern', 'Internship', 'Bengaluru', intern.description, { age: 5, orgId: 'ob' });
const saves = run({ saved: [twinB.id] }, fresher, [twinA, twinB]);
ok(saves.picks[0].l.id === twinB.id && saves.picks[0].m.reasons.some(x => /saved/.test(x)), 'listings from an organization you saved come first');
ok(run({}, fresher, [twinA, twinB]).picks[0].m.score === saves.picks[0].m.score, 'saving never changes the match %');
const many = Array.from({ length: 6 }, (_, i) => L('Data Analyst Intern ' + i, 'Internship', 'Bengaluru', intern.description, { orgId: i < 4 ? 'big' : 'o' + i, age: i }));
const div = run({ limit: 4 }, fresher, many).picks;
ok(div.filter(x => x.l.orgId === 'big').length === 2, 'no more than 2 from one organization while others are available: ' + div.map(x => x.l.orgId));

// ---- safety: odd data never breaks it and scores stay in range
const words = 'python sql excel java react senior intern data analyst remote pune delhi bengaluru fresher manager 5+ years experience degree master phd design seo marketing sales account tally gst kubernetes docker'.split(' ');
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const pick = () => words[Math.floor(rnd() * words.length)];
const junk = Array.from({ length: 300 }, (_, i) => ({ id: 'j' + i, type: ['Job', 'Internship', 'Course'][i % 3], title: Array.from({ length: 1 + (i % 4) }, pick).join(' '), description: i % 5 ? Array.from({ length: i % 40 }, pick).join(' ') : undefined, location: i % 7 ? pick() : undefined, created: i % 9 ? ago(i % 50) : 'not a date', orgId: 'o' + (i % 8) }));
const cj = E.buildProfile({ ...fresher, locations: 'Pune, Delhi', jobTypes: [] }, NOW);
const all = junk.map(l => (l.type === 'Course' ? E.scoreCourse(cj, l, undefined, { now: NOW }) : E.scoreListing(cj, l, undefined, { now: NOW })));
ok(all.every(m => Number.isInteger(m.score) && m.score >= 0 && m.score <= 99 && Number.isFinite(m.rank)), 'every score is a whole number from 0 to 99');
ok(E.suggestFor(fresher, junk, { now: NOW }).picks.length > 0, 'a messy list still yields suggestions');
const evil = E.suggestFor({ ...fresher, skills: ['<img src=x onerror=alert(1)>', 'Python'], field: '<b>CS</b>' }, pool, { now: NOW });
ok(evil.ready && evil.picks.length > 0, 'odd skill text is accepted as data (the page escapes it when drawing)');

// ---- speed: a thousand listings should be instant
const big = Array.from({ length: 1000 }, (_, i) => ({ ...junk[i % 300], id: 'b' + i, description: (junk[i % 300].description || '') + ' ' + intern.description }));
const t0 = Date.now();
E.suggestFor(fresher, big, { now: NOW });
const ms = Date.now() - t0;
ok(ms < 1500, `1000 listings in ${ms} ms`);

// ---- drawing: the card and the details block escape everything
globalThis.document = { querySelector: () => null };
const { card, whyBlock } = await import('../public/js/features/browse/card.js');
const bad = { kind: 'job', score: 80, band: 'strong', isNew: true, reasons: ['<img src=x onerror=alert(1)>'], matched: ['<b>x</b>'], missing: ['"><script>'], cautions: ["<i>no</i>"] };
const html = card({ id: 'z1', title: '<u>T</u>', orgName: 'O', type: 'Job', location: 'L', pay: 'P' }, bad) + whyBlock(bad);
ok(!/<img src=x|<script|<b>x|<u>T|<i>no/.test(html) && /80% match/.test(html) && />New</.test(html), 'card and why-block escape text and show the badge');
ok(!/lc-flags|lc-why/.test(card({ id: 'z2', title: 'T', orgName: 'O', type: 'Job', location: 'L', pay: 'P' })), 'a card without match info looks as before');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
