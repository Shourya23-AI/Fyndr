// Filters (stipend, duration, price, certificate, source) and facts read from posting text.  Run:  node test/refine.test.js
import { createRequire } from 'module';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const { monthlyPay, monthsOf, refine, refineNote, isActive, EMPTY_RF, isRemoteListing } = await import('../public/js/features/listings/refine.js');
const { staleDays } = await import('../public/js/features/listings/origin.js');
const { groupCourses, groupJobs } = await import('../public/js/features/catalog/group.js');
const f = createRequire(import.meta.url)('../scripts/lib/facts.js');
const fs = await import('fs');

ok(monthlyPay('INR 15000-25000 / month') === 15000 && monthlyPay('Rs 20,000 per month') === 20000, 'monthly pay parsed');
ok(Math.round(monthlyPay('INR 120000 / year')) === 10000 && monthlyPay('INR 6 LPA') === 50000, 'yearly and LPA turned into monthly');
ok(monthlyPay('See listing') === null && monthlyPay('') === null && monthlyPay('USD 5000 / month') === null, 'unstated or non-rupee pay is null');
ok(monthsOf('3 months').max === 3 && monthsOf('2-6 months').min === 2 && Math.round(monthsOf('12 weeks').max) === 3, 'durations parsed');
ok(monthsOf('Self-paced') === null && monthsOf('') === null, 'self-paced has no length');

const direct = { id: 'a', type: 'Internship', source: 'import', origin: 'greenhouse', pay: 'INR 20000 / month', duration: '3 months', location: 'Bengaluru', lastSeen: '2026-10-10T00:00:00Z' };
const posted = { id: 'b', type: 'Job', pay: 'See listing', duration: '', location: 'Remote' };
const search = { id: 'cat_gj_1', type: 'Job', search: true, pay: 'Salary varies · check listing', duration: '', location: 'India', links: [{}] };
const rows = [direct, posted, search];
ok(refine(rows, EMPTY_RF) === rows && !isActive(EMPTY_RF), 'no filter = same rows');
ok(refine(rows, { ...EMPTY_RF, src: 'direct' }).map(x => x.id).join() === 'a', 'Direct from company keeps only direct openings');
ok(refine(rows, { ...EMPTY_RF, pay: 'any' }).map(x => x.id).join() === 'a', 'stipend filter hides listings that state none (and search cards)');
ok(refine(rows, { ...EMPTY_RF, pay: '25' }).length === 0 && refine(rows, { ...EMPTY_RF, pay: '10' }).length === 1, 'stipend thresholds');
ok(refine(rows, { ...EMPTY_RF, dur: 'mid' }).length === 1 && refine(rows, { ...EMPTY_RF, dur: 'long' }).length === 0, 'duration buckets');
ok(refine(rows, { ...EMPTY_RF, remote: true }).map(x => x.id).join() === 'b' && isRemoteListing({ remote: true, location: 'X' }), 'remote filter');
ok(/Search-link cards are hidden/.test(refineNote({ ...EMPTY_RF, pay: 'any' }, 3, 1)) && refineNote(EMPTY_RF, 3, 3) === '', 'note explains hidden search cards');

const courses = groupCourses(JSON.parse(fs.readFileSync(new URL('../public/catalog/catalog-courses.json', import.meta.url))).rows).list;
const freeC = refine(courses, { ...EMPTY_RF, price: 'free' }), allFree = refine(courses, { ...EMPTY_RF, price: 'allfree' }), cert = refine(courses, { ...EMPTY_RF, cert: true });
ok(freeC.length > 0 && allFree.length <= freeC.length && allFree.every(c => c.allFree), 'free filters on courses');
ok(cert.length > 0 && cert.every(c => c.cert), 'certificate filter on courses');
const jobs = groupJobs(JSON.parse(fs.readFileSync(new URL('../public/catalog/catalog-jobs.json', import.meta.url))).rows).list;
ok(refine(jobs, { ...EMPTY_RF, pay: 'any' }).length === 0, 'no search-link role is ever shown under a stipend filter');

ok(staleDays({ lastSeen: '2026-10-10T00:00:00Z' }, Date.parse('2026-10-16T00:00:00Z')) === 6 && staleDays({}) === 0, 'staleDays');
ok(f.durationFrom('This is a 6-month internship') === '6 months' && f.durationFrom('Duration: 2 to 3 months') === '2-3 months' && f.durationFrom('We have 40 years of history') === '', 'duration read from text');
ok(f.stipendFrom('Stipend: Rs. 15,000 per month') === 'INR 15000 / month' && f.stipendFrom('Competitive salary') === '', 'stipend read from text only when stated');
ok(f.remoteFrom('Pune', 'Fully remote role') && !f.remoteFrom('Pune', 'in office'), 'remote read from text');
ok(f.payFromLever({ salaryRange: { min: 500000, max: 800000, currency: 'inr', interval: 'per-year-salary' } }) === 'INR 500000-800000 / year' && f.payFromLever({}) === '', 'Lever pay');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
