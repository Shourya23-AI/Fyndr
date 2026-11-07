// "Edit your profile": the Basic info rules, the Firestore backend (PUT /profile/basic) and the Node server route.  Run:  node test/profile-edit.test.js
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
const throws = async (f, re, n) => { try { await f(); fail++; console.log('  FAIL (no error)', n); } catch (e) { ok(re.test(e.code || e.message), n + ' -> ' + (e.code || e.message)); } };

// ---- 1. rules (shared by browser and server)
const { cleanBasics, NAME_MAX, HEADLINE_MAX, ABOUT_MAX } = await import('../public/js/features/profile/basics.rules.js');
let r = cleanBasics({ name: '  Asha   K  ', headline: ' CS  student ', summary: 'Hello\r\n\r\n\r\n\r\nthere\u0000 ' });
ok(r.ok && r.name === 'Asha K' && r.headline === 'CS student', 'trims and collapses spaces');
ok(r.about === 'Hello\n\nthere', 'about keeps line breaks, limits blank lines, drops control characters: ' + JSON.stringify(r.about));
ok(cleanBasics({ name: 'Zoë <b>O’Neil</b>' }).name === 'Zoë b O’Neil /b', 'angle brackets never reach the name');
ok(!cleanBasics({ name: '' }).ok && !cleanBasics({ name: 'A' }).ok && !cleanBasics({ name: '1234' }).ok && !cleanBasics({ name: '!!' }).ok && !cleanBasics({}).ok && !cleanBasics(null).ok, 'name needs 2+ characters with letters');
ok(/name/i.test(cleanBasics({ name: 'x' }).error), 'error text mentions the name');
ok(cleanBasics({ name: 'अनन्या शर्मा' }).ok && cleanBasics({ name: '李 雷' }).ok, 'non-Latin names are fine');
r = cleanBasics({ name: 'n'.repeat(200), headline: 'h'.repeat(300), summary: 's'.repeat(900) });
ok(r.name.length === NAME_MAX && r.headline.length === HEADLINE_MAX && r.about.length === ABOUT_MAX, 'lengths are limited');
ok(cleanBasics({ name: 'Sam', headline: 5, summary: { a: 1 } }).ok, 'odd value types do not crash');

// ---- 2. Firestore backend
const { useFs } = await import('../public/js/services/firestore-api/fire.js');
const { createMock } = await import('./mock-firestore.js');
const fire = await import('../public/js/services/firestore-api/fire-api.js');
fire.tuning.selfTtl = 0;
useFs(createMock());
const U = { cand: { uid: 'c1', email: 'sam@gmail.com', displayName: 'Sam' }, org: { uid: 'o1', email: 'hr@acme.com', displayName: 'Acme HR' } };
const api = (u, p, m = 'GET', b) => fire.fireApi(p, m, b, U[u]);
await api('cand', '/init', 'POST', { role: 'user', agree: true });
await api('org', '/init', 'POST', { role: 'org', orgName: 'Acme', orgType: 'small', agree: true });
let out = await api('cand', '/profile/basic', 'PUT', { name: '  Samira  Rao ', headline: 'Final-year student', summary: 'I like data.' });
ok(out.name === 'Samira Rao' && out.headline === 'Final-year student' && out.summary === 'I like data.', 'saves before the main form is filled in');
let g = await api('cand', '/profile');
ok(g.name === 'Samira Rao' && g.profile.headline === 'Final-year student' && g.profile.summary === 'I like data.' && !g.profile.done, 'GET /profile shows it; setup is still not marked done');
ok((await api('cand', '/me')).name === 'Samira Rao', 'GET /me shows the new name');
const prof = { qualification: "Bachelor's", field: 'CS', institution: 'BMSIT', gradYear: 2026, skills: ['js'], experience: 'Student / Fresher', jobTypes: ['Job'], locations: 'Bengaluru' };
await api('cand', '/profile', 'PUT', prof); // the big form no longer sends headline/summary once the Basic info card exists
g = await api('cand', '/profile');
ok(g.profile.done && g.profile.headline === 'Final-year student' && g.profile.summary === 'I like data.' && g.name === 'Samira Rao', 'saving the big form keeps headline, about and name');
await api('cand', '/profile', 'PUT', { ...prof, headline: 'New title', summary: '' }); // first-time setup still sends them
g = await api('cand', '/profile');
ok(g.profile.headline === 'New title' && g.profile.summary === '', 'setup form can still set or clear headline and about');
await api('cand', '/profile/basic', 'PUT', { name: 'Samira R', headline: '', summary: '' });
g = await api('cand', '/profile');
ok(g.profile.done && g.profile.field === 'CS' && g.profile.skills[0] === 'js' && g.profile.headline === '' && g.name === 'Samira R', 'Basic info save leaves education and skills alone, and can clear the intro');
await throws(() => api('cand', '/profile/basic', 'PUT', { name: 'x' }), /name/i, 'bad name refused');
ok((await api('cand', '/profile')).name === 'Samira R', 'a refused save changes nothing');
await throws(() => api('org', '/profile/basic', 'PUT', { name: 'Acme HR' }), /Forbidden/, 'organizations use their own page, not this route');

// ---- 3. Node server route (same rules file, own database in a temp folder)
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fyndr-pe-'));
const require = createRequire(import.meta.url);
const { routes } = require('../server/lib/router.js');
require('../server/routes/profile.routes.js');
const find = (m, p) => routes.find(x => x.m === m && x.re.test(p));
const basic = find('PUT', '/api/profile/basic');
const whole = find('PUT', '/api/profile');
ok(basic && basic.roles.includes('user') && !basic.roles.includes('org'), 'server route exists and is for candidates only');
const user = { id: 'u1', name: 'Old Name', email: 'a@b.com', role: 'user', profile: { field: 'Law', done: true, headline: 'keep me', summary: 'and me' } };
out = await basic.fn({ user, body: { name: ' New  Name ', headline: 'Lawyer', summary: 'Hi' } });
ok(user.name === 'New Name' && user.profile.headline === 'Lawyer' && user.profile.summary === 'Hi' && user.profile.field === 'Law' && user.profile.done, 'server saves name, headline, about and keeps the rest');
ok(out.name === 'New Name', 'server answers with the cleaned values');
let err; try { await basic.fn({ user, body: { name: '' } }); } catch (e) { err = e; }
ok(err && err.c === 400 && /name/i.test(err.m) && user.name === 'New Name', 'server refuses a bad name and changes nothing');
await whole.fn({ user, body: { ...prof, skills: ['js'] } });
ok(user.profile.headline === 'Lawyer' && user.profile.summary === 'Hi' && user.profile.field === 'CS', 'server: big form keeps headline and about when they are not sent');
await whole.fn({ user, body: { ...prof, skills: ['js'], headline: '', summary: 'Setup text' } });
ok(user.profile.headline === '' && user.profile.summary === 'Setup text', 'server: big form can still set them');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
