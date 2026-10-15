// Checks for personal search (public/js/features/suggestions/personal.js).  Run:  node test/personal.test.js
import { searchTerms, rankForMe } from '../public/js/features/suggestions/personal.js';
import { suggestFor, buildProfile } from '../public/js/features/suggestions/engine.js';

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const NOW = Date.parse('2026-10-11T00:00:00Z');
const ago = n => new Date(NOW - n * 864e5).toISOString();
let seq = 0;
const L = (title, type, location, description, o = {}) => ({ id: 'l' + ++seq, title, type, location, description, orgId: 'o' + seq, orgName: 'Org', created: ago(o.age ?? 3), ...o });
const fresher = { qualification: "Bachelor's", field: 'Computer Science', gradYear: 2027, skills: ['Python', 'SQL', 'Excel'], skillLevels: { Python: 5, SQL: 3, Excel: 2 }, experience: 'Student / Fresher', jobTypes: ['Internship'], locations: 'Bangalore, Remote', headline: 'Aspiring data analyst' };

// ---- search chips from the profile
const t = searchTerms(fresher);
ok(t[0] === 'Aspiring data analyst', 'headline first');
ok(t.includes('Python intern'), 'best-rated skill, as an internship search for a student');
ok(t.indexOf('Python intern') < t.indexOf('Excel intern') || !t.includes('Excel intern'), 'higher level skill comes first');
ok(t.includes('Computer Science internship'), 'field');
ok(t.length <= 6 && new Set(t.map(x => x.toLowerCase())).size === t.length, 'at most 6, no repeats');
ok(!searchTerms(fresher, 'python intern').includes('Python intern'), 'does not offer what is already typed');
ok(searchTerms({}).length === 0 && searchTerms(null).length === 0, 'empty profile gives no chips');
const exp = searchTerms({ ...fresher, gradYear: 2019, jobTypes: ['Job'], headline: '' });
ok(exp.includes('Python') && !exp.some(x => /intern/.test(x)), 'working people get plain job searches');
ok(searchTerms({ skills: ['<script>'] }).every(x => x.length <= 40), 'length capped');

// ---- ranking a search by fit
const rows = [
    L('Marketing Executive', 'Job', 'Mumbai', 'Run social media campaigns. SEO and Excel.'),
    L('Data Analyst Intern', 'Internship', 'Bangalore', 'SQL, Python and Excel for dashboards. Freshers welcome.'),
    L('Senior Data Engineer', 'Job', 'Pune', '8+ years of experience. Python, SQL, Spark.'),
    L('Python Course', 'Course', 'Online', 'Learn Python.', { orgId: 'catalog' })
];
const r = rankForMe(rows, fresher, 'data', NOW);
ok(r.rows[0].title === 'Data Analyst Intern', 'best fit first: ' + r.rows.map(x => x.title).join(' | '));
ok(r.rows.length === rows.length && new Set(r.rows.map(x => x.id)).size === rows.length, 'nothing lost or doubled');
ok(r.rows[r.rows.length - 1].type === 'Course', 'courses keep their place after the jobs');
ok(r.match[rows[1].id] && r.match[rows[1].id].score > r.match[rows[0].id].score, 'match info rides along, better fit scores higher');
ok(!(rows[3].id in r.match), 'no match info for courses');
const titleHit = rankForMe([L('Warehouse Associate', 'Job', 'Bangalore', 'Python SQL Excel data'), L('Data Entry Clerk', 'Job', 'Bangalore', 'Typing')], fresher, 'data entry', NOW);
ok(titleHit.rows[0].title === 'Data Entry Clerk', 'a search word in the title beats a deep description hit');
const same = rankForMe(rows, {}, 'data', NOW);
ok(same.rows === rows && Object.keys(same.match).length === 0, 'empty profile: list untouched');
ok(rankForMe([], fresher, 'x', NOW).rows.length === 0, 'empty list');

// ---- people with no skills yet still get picks from their field and headline
const noSkills = { qualification: "Bachelor's", field: 'Computer Science', gradYear: 2027, experience: 'Student / Fresher', jobTypes: ['Internship'], locations: 'Bangalore', headline: 'Aspiring software developer' };
ok(buildProfile(noSkills, NOW).ready, 'field and headline are enough to start');
ok(!buildProfile({}, NOW).ready, 'a blank profile is not ready');
const s = suggestFor(noSkills, [L('Software Developer Intern', 'Internship', 'Bangalore', 'Build features with Java and React. Freshers welcome.'), L('Chartered Accountant', 'Job', 'Delhi', 'Audit and tax. CA required.')], { now: NOW });
ok(s.ready && s.picks.length > 0 && s.picks[0].l.title === 'Software Developer Intern', 'picks come from field, level and place');
ok(!s.picks.some(x => x.l.title === 'Chartered Accountant'), 'unrelated work is left out');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
