// Guided first-run setup (Part 3): the rules, the draft, the screens' markup, and the real save on both backends.  Run:  node test/setup-flow.test.js
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const store0 = {};
globalThis.document = { querySelector: () => null };
globalThis.localStorage = { getItem: k => store0[k] ?? (k.startsWith('fyndr-fbcfg') ? JSON.stringify({ cfg: { apiKey: 'YOUR_KEY' }, local: true }) : null), setItem: (k, v) => { store0[k] = v; }, removeItem: k => delete store0[k] };
globalThis.fetch = async () => { throw new Error('offline'); };
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };

const R = await import('../public/js/features/onboarding/setup.rules.js');
const V = await import('../public/js/features/onboarding/setup.view.js');
const { completion } = await import('../public/js/services/firestore-api/helpers.js');

// ---- 1. a draft from anything is a clean draft
let d = R.cleanDraft(null);
ok(d.step === 0 && d.skills.length === 0 && d.qualification === '' && d.jobTypes.length === 0, 'empty draft');
d = R.cleanDraft({ qualification: 'Wizard', experience: 'lots', jobTypes: ['Job', 'Spy'], skills: ['  js ', 'js', '', 'x'.repeat(99)], skillLevels: { js: 9, nothing: 2 }, gradYear: '20x27y', step: 99, field: '<b>CS</b>', summary: 'a\r\n\r\n\r\n\r\nb' });
ok(d.qualification === '' && d.experience === '', 'unknown choices are dropped');
ok(d.jobTypes.join() === 'Job', 'only known job types stay');
ok(d.skills.length === 2 && d.skills[0] === 'js' && d.skills[1].length === 30, 'skills trimmed, de-duplicated, limited to 30 characters');
ok(d.skillLevels.js === 3 && !('nothing' in d.skillLevels), 'bad skill level becomes 3, levels only for listed skills');
ok(d.gradYear === '2027' && d.step === 0 && d.field === 'b CS /b' && !/[<>]/.test(d.field), 'year keeps digits only, step out of range goes to 0, angle brackets removed');
ok(d.summary === 'a\n\nb', 'about keeps line breaks');
ok(R.cleanDraft({ programme: 'UG', studyYear: 2, semester: 4 }).semester === 4 && R.cleanDraft({ programme: 'UG', studyYear: 2, semester: 7 }).programme === '', 'study choice kept only when year and semester agree');
ok(R.cleanDraft({ step: '2' }).step === 2, 'step as text works');

// ---- 2. each step says what is missing
const yr = 2026;
let e = R.stepErrors('education', {}, yr);
ok(['qualification', 'field', 'institution', 'gradYear'].every(k => e[k]), 'education: four missing fields found');
ok(!Object.keys(R.stepErrors('education', { qualification: "Bachelor's", field: 'CS', institution: 'BMSIT', gradYear: '2027' }, yr)).length, 'education: complete is fine');
ok(R.stepErrors('education', { qualification: "Bachelor's", field: 'CS', institution: 'BMSIT', gradYear: '1950' }, yr).gradYear && R.stepErrors('education', { qualification: "Bachelor's", field: 'CS', institution: 'BMSIT', gradYear: '2040' }, yr).gradYear && R.stepErrors('education', { qualification: "Bachelor's", field: 'CS', institution: 'BMSIT', gradYear: '27' }, yr).gradYear, 'graduation year must be 4 digits between 1970 and this year + 8');
e = R.stepErrors('skills', {});
ok(e.experience && e.skills, 'skills: experience and a skill are required');
ok(!Object.keys(R.stepErrors('skills', { experience: 'Student / Fresher', skills: ['js'] })).length, 'skills: complete is fine');
ok(!Object.keys(R.stepErrors('goals', {})).length && !Object.keys(R.stepErrors('intro', {})).length, 'goals and intro are optional');
ok(R.firstBadStep({}) === 0 && R.firstBadStep({ qualification: "Bachelor's", field: 'CS', institution: 'B', gradYear: '2027' }) === 1, 'first step with a problem');
const full = { qualification: "Bachelor's", field: 'Computer Science', institution: 'BMSIT', gradYear: '2027', programme: 'UG', studyYear: 3, semester: 6, experience: 'Student / Fresher', skills: ['Python', 'SQL'], skillLevels: { Python: 4 }, jobTypes: ['Internship'], locations: 'Bengaluru', headline: 'CS student', summary: 'Hello' };
ok(R.firstBadStep(full) === -1, 'a full draft has no bad step');
ok(R.firstError({ a: 'x', b: 'y' }) === 'x' && R.firstError({}) === '', 'firstError');

// ---- 3. numbers shown while filling in match the server's number
ok(R.stepPercent(0) === 25 && R.stepPercent(3) === 100 && R.stepPercent(-4) === 25 && R.stepPercent(40) === 100, 'step progress 25..100');
for (const [draft, resume] of [[{}, false], [full, false], [full, true], [{ ...full, locations: '' }, false], [{ qualification: "Master's", skills: ['a'] }, false]]) {
    const c = R.cleanDraft(draft);
    const asUser = { profile: { qualification: c.qualification, field: c.field, institution: c.institution, gradYear: c.gradYear && +c.gradYear, skills: c.skills, experience: c.experience, jobTypes: c.jobTypes, locations: c.locations }, resume: resume ? { name: 'r.pdf' } : undefined };
    ok(R.previewCompletion(draft, resume) === completion(asUser), 'preview equals the server completion for ' + JSON.stringify(draft).slice(0, 50) + ' resume=' + resume);
}

// ---- 4. the draft survives a reload, per account, and is cleared after saving
const mem = { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = v; }, removeItem(k) { delete this.m[k]; } };
R.saveDraft(mem, 'u1', { ...full, step: 2 });
ok(R.loadDraft(mem, 'u1').step === 2 && R.loadDraft(mem, 'u1').field === 'Computer Science', 'draft comes back');
ok(R.loadDraft(mem, 'u2') === null, 'another account does not see it');
mem.m['fyndr-setup:u3'] = '{not json';
ok(R.loadDraft(mem, 'u3') === null, 'a broken saved draft is ignored');
mem.m['fyndr-setup:u4'] = JSON.stringify({ qualification: 'Evil', skills: 'x', step: 'z' });
ok(R.loadDraft(mem, 'u4').skills.length === 0 && R.loadDraft(mem, 'u4').qualification === '', 'a tampered draft is cleaned');
R.clearDraft(mem, 'u1');
ok(R.loadDraft(mem, 'u1') === null, 'cleared');
ok((() => { try { R.saveDraft({ setItem() { throw new Error('full'); } }, 'x', full); return true; } catch { return false; } })(), 'a full or blocked storage never breaks setup');
ok(R.draftFrom({ field: 'Law', headline: 'Hi', gradYear: 2025, jobTypes: ['Job'] }, { programme: 'PG', studyYear: 1, semester: 2 }).programme === 'PG' && R.draftFrom({ field: 'Law', gradYear: 2025 }, null).gradYear === '2025', 'draft from a saved profile and the studies remembered at sign-up');

// ---- 5. the screens
for (const [i, s] of R.STEPS.entries()) {
    const h = V.setupHtml(R.cleanDraft(full), i);
    ok(h.includes(`Step ${i + 1} of 4`) && h.includes(`aria-valuenow="${R.stepPercent(i)}"`) && h.includes('role="progressbar"'), 'step ' + s.id + ': progress shown (text and aria)');
    ok(h.includes('aria-current="step"') && h.includes('data-form="sustep"') && /Profile \d+% complete/.test(h), 'step ' + s.id + ': current step marked, form wired, strength shown');
    ok(!/\son[a-z]+\s*=/i.test(h) && !/<script/i.test(h) && !/javascript:/i.test(h), 'step ' + s.id + ': no inline handlers or scripts (CSP)');
    ok(i === 0 ? !h.includes('data-act="su-back"') : h.includes('data-act="su-back"'), 'step ' + s.id + ': Back button only after the first step');
    ok(i === 3 ? h.includes('Finish and see my profile') : h.includes('>Continue<'), 'step ' + s.id + ': button label');
}
ok(V.setupHtml(R.cleanDraft({ field: 'x" onfocus="alert(1)' }), 0).includes('value="x&quot; onfocus=&quot;alert(1)"'), 'values are escaped');
const bad = V.setupHtml(R.cleanDraft({}), 0, R.stepErrors('education', {}, yr));
ok(bad.includes('su-err') && bad.includes('Choose your highest qualification') && bad.includes('Please fix the highlighted fields') && bad.includes('aria-live="assertive"'), 'refused step shows each problem and a summary');
const sk = V.setupHtml(R.cleanDraft({ skills: ['Python'] }), 1);
ok(sk.includes('id="chips"') && sk.includes('id="skillin"') && !sk.includes('data-id="Python"') && sk.includes('data-id="SQL"'), 'skills step: chips box, input, quick-add hides skills already added');
ok(V.setupHtml(R.cleanDraft({ jobTypes: ['Job'] }), 2).includes('value="Job" checked'), 'goals step: saved choice is ticked');
ok(V.setupHtml(R.cleanDraft({}), 3).includes('id="photo"'), 'intro step: photo box');

// ---- 6. the profile page's progress card and "what next" list
const head = V.profileHead({ completion: 78, phone: null, resume: null, photo: null, profile: {} }, true);
ok(head.includes('Profile 78% complete') && head.includes('4 things left') && head.includes('aria-valuenow="78"') && head.includes('You’re all set'), 'progress card: number, count, bar, welcome');
ok(head.includes('href="#/phone"') && head.includes('data-act="pf-goto" data-id="resume"') && head.includes('data-act="pf-goto" data-id="photo"') && head.includes('data-act="pf-goto" data-id="intro"') && head.includes('href="#/jobs"'), 'progress card: every item has a button, plus "See jobs"');
const done = V.profileHead({ completion: 100, phone: '+9198', resume: { name: 'r.pdf' }, photo: 'data:image/png;base64,AA', profile: { headline: 'hi' } }, false);
ok(done.includes('Everything here is done') && !done.includes('You’re all set') && !done.includes('left to do'), 'progress card: nothing left');
const half = V.profileHead({ completion: 90, phone: '+9198', resume: null, photo: null, profile: { summary: 'x' } }, false);
ok(half.includes('2 things left') && half.includes('Done') && !half.includes('data-id="intro"'), 'progress card: finished items are marked, only open ones get buttons');
ok(R.pending({ phone: true, resume: true, photo: true, profile: { headline: 'x' } }).length === 0 && R.nextSteps({}).length === 4, 'pending / nextSteps');

// ---- 7. the real save, Firestore backend: a finished draft is accepted and marks setup as done
const { useFs } = await import('../public/js/services/firestore-api/fire.js');
const { createMock } = await import('./mock-firestore.js');
const fire = await import('../public/js/services/firestore-api/fire-api.js');
fire.tuning.selfTtl = 0;
useFs(createMock());
const U = { cand: { uid: 'c1', email: 'sam@gmail.com', displayName: 'Sam' } };
const api = (u, p, m = 'GET', b) => fire.fireApi(p, m, b, U[u]);
await api('cand', '/init', 'POST', { role: 'user', agree: true });
ok(!(await api('cand', '/me')).onboarded, 'new account is not set up yet');
const res = await api('cand', '/profile', 'PUT', R.toProfileBody(full));
const me = await api('cand', '/me');
ok(me.onboarded && me.completion === res.completion && res.completion === R.previewCompletion(full, false), 'saved draft: setup done, and the % equals the preview (' + res.completion + ')');
const g = await api('cand', '/profile');
ok(g.profile.field === 'Computer Science' && g.profile.skills.join() === 'Python,SQL' && g.profile.skillLevels.Python === 4 && g.profile.skillLevels.SQL === 3 && g.profile.programme === 'UG' && g.profile.studyYear === 3 && g.profile.headline === 'CS student' && g.profile.jobTypes[0] === 'Internship', 'saved draft: every answer arrived');
ok(R.toProfileBody({ ...full, programme: '' }).programme === undefined, 'no studies chosen: nothing sent');

// ---- 8. the real save, Node server
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fyndr-su-'));
const require = createRequire(import.meta.url);
const { routes } = require('../server/lib/router.js');
require('../server/routes/profile.routes.js');
const whole = routes.find(x => x.m === 'PUT' && x.re.test('/api/profile'));
const user = { id: 'u9', name: 'Sam', email: 's@x.com', role: 'user' };
const out = await whole.fn({ user, body: R.toProfileBody(full) });
ok(user.profile.done && out.completion === R.previewCompletion(full, false) && user.profile.skills.length === 2 && user.profile.headline === 'CS student', 'server accepts the same body and gives the same %');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
