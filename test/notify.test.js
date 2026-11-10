// Notifications (Part 3, step 2): rules, inbox storage, markup. Run:  node test/notify.test.js
const store0 = {};
globalThis.document = { querySelector: () => null };
globalThis.localStorage = { getItem: k => store0[k] ?? (k.startsWith('fyndr-fbcfg') ? JSON.stringify({ cfg: { apiKey: 'YOUR_KEY' }, local: true }) : null), setItem: (k, v) => { store0[k] = v; }, removeItem: k => delete store0[k] };
globalThis.fetch = async () => { throw new Error('offline'); };
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const R = await import('../public/js/features/notifications/notify.rules.js');
const V = await import('../public/js/features/notifications/notify.view.js');
const B = await import('../public/js/features/notifications/notify.bell.js');
const { suggestFor } = await import('../public/js/features/suggestions/engine.js');
const now = Date.parse('2026-11-10T10:00:00Z');
const app = (id, status, title = 'Data Intern', orgName = 'Acme') => ({ id, status, listing: { title, orgName } });

// 1. status changes
let r = R.statusEvents([app('a1', 'applied'), app('a2', 'reviewing')], null, now);
ok(r.events.length === 0 && r.seen.a1 === 'applied' && r.seen.a2 === 'reviewing', 'first run only records where things stand');
r = R.statusEvents([app('a1', 'interview'), app('a2', 'reviewing')], { a1: 'applied', a2: 'reviewing' }, now);
ok(r.events.length === 1 && r.events[0].id === 'st:a1:interview' && /Data Intern at Acme moved to interview/.test(r.events[0].title), 'a status change makes one notice');
ok(R.statusEvents([app('a1', 'applied')], { a1: 'reviewing' }, now).events.length === 0, 'going back to applied is not news');
ok(R.statusEvents([app('a3', 'rejected')], { a1: 'applied' }, now).events[0].text.includes('Your other applications'), 'new application already decided still tells');
ok(!('a1' in R.statusEvents([app('a2', 'applied')], { a1: 'applied', a2: 'applied' }, now).seen), 'a withdrawn application leaves seen');
ok(R.statusEvents(null, {}, now).events.length === 0 && R.statusEvents([{ id: 1 }, null, { id: 'x', status: 'weird' }], {}, now).events.length === 0, 'junk input is ignored');
ok(['reviewing', 'interview', 'accepted', 'rejected'].every(s => R.statusEvents([app('z', s)], { z: 'applied' }, now).events.length === 1), 'every status has wording');

// 2. match notices (real engine)
const profile = { qualification: "Bachelor's", field: 'Computer Science', institution: 'BMSIT', gradYear: 2027, experience: 'Student / Fresher', skills: ['Python', 'SQL', 'Machine Learning'], skillLevels: {}, jobTypes: ['Internship'], locations: 'Bengaluru' };
const L = (id, title, created, type = 'Internship') => ({ id, orgId: 'o' + id, orgName: 'Org ' + id, title, type, location: 'Bengaluru', pay: '10000', description: 'Python, SQL and machine learning for data analysis. Freshers welcome.', status: 'approved', created });
const old = new Date(now - 10 * 864e5).toISOString(), fresh = new Date(now - 3600e3).toISOString();
const since = now - 864e5;
const res = suggestFor(profile, [L('1', 'Data Analyst Intern', fresh), L('2', 'ML Intern', old), { ...L('3', 'Gardening Helper', fresh), description: 'Water plants and mow lawns. No experience needed.' }], { lastSeen: since, limit: 200, now });
let ev = R.matchEvents(res.picks, now, since);
ok(ev.length === 1 && ev[0].id === 'ls:1' && ev[0].go === 'foryou' && /% match/.test(ev[0].text), 'only the new, fitting listing is announced: ' + JSON.stringify(ev.map(e => e.id)));
const many = Array.from({ length: 7 }, (_, i) => ({ l: { id: 'm' + i, title: 'T' + i, orgName: 'O' }, m: { isNew: true, score: 90 - i } }));
ev = R.matchEvents(many, now, since);
ok(ev.length === 4 && ev[3].title === '4 more new matches for you' && ev[0].id === 'ls:m0', 'three single notices and one roll-up');
ok(R.matchEvents([{ l: { id: 'q', title: 'x' }, m: { isNew: true, score: 49 } }, { l: { id: 'q2', title: 'x' }, m: { isNew: false, score: 99 } }], now).length === 0, 'below good, or not new: silent');
ok(R.matchEvents(null).length === 0, 'null is fine');

// 3. merge, unread, due
let box = R.newBox(now);
box = R.merge(box, [{ id: 'x', kind: 'status', title: 't', text: 't', at: now, read: false, go: 'apps' }], now);
box = R.merge(box, [{ id: 'x', kind: 'status', title: 't', text: 't', at: now + 1, read: false, go: 'apps' }], now);
ok(box.items.length === 1 && R.unread(box) === 1, 'same notice is never added twice');
ok(R.unread(R.markAllRead(box)) === 0, 'mark all read');
const manyEv = Array.from({ length: 80 }, (_, i) => ({ id: 'e' + i, kind: 'match', title: 't', text: 't', at: now + i, read: false, go: 'foryou' }));
ok(R.merge(R.newBox(now), manyEv, now).items.length === R.MAX_ITEMS && R.merge(R.newBox(now), manyEv, now).items[0].id === 'e79', 'inbox capped, newest first');
ok(R.checkDue(null, now) && !R.checkDue({ checked: now - 60e3 }, now) && R.checkDue({ checked: now - 11 * 60e3 }, now), 'check at most every 10 minutes');

// 4. storage is per account and distrusts what it reads
const mem = { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = v; } };
R.saveBox(mem, 'u1', box);
ok(R.loadBox(mem, 'u1', now).items.length === 1 && R.loadBox(mem, 'u2', now) === null, 'per account');
mem.m['fyndr-inbox:u3'] = '{nope';
ok(R.loadBox(mem, 'u3') === null, 'broken data ignored');
mem.m['fyndr-inbox:u4'] = JSON.stringify({ since: 'x', prefs: { match: false }, seen: { a: 5, b: 'applied' }, items: [{ id: 'k', title: '<img onerror=x>', kind: 'zzz', go: 'evil', at: 'no' }, { nope: 1 }, null] });
const c = R.loadBox(mem, 'u4', now);
ok(c.prefs.match === false && c.items.length === 1 && c.items[0].kind === 'status' && c.items[0].go === 'apps' && c.items[0].at === 0 && Object.keys(c.seen).join() === 'b' && c.since === now, 'stored data is rebuilt field by field');
ok(R.loadBox({ getItem() { throw new Error('blocked'); } }, 'u') === null && R.saveBox({ setItem() { throw new Error('full'); } }, 'u', box) === false, 'blocked storage does not break anything');

// 5. markup
ok(R.ago(now - 5e3, now) === 'just now' && R.ago(now - 5 * 60e3, now) === '5 minutes ago' && R.ago(now - 3600e3, now) === '1 hour ago' && R.ago(now - 2 * 864e5, now) === '2 days ago' && /^\d{4}-/.test(R.ago(now - 30 * 864e5, now)), 'time in plain words');
const evil = { id: 'e', kind: 'status', title: '<script>alert(1)</script>', text: '"><img src=x onerror=1>', at: now, read: false, go: 'apps' };
const html = V.pageHtml({ items: [evil], prefs: { match: true } }, 100, now);
ok(!/<script|<img/.test(html) && /&lt;script&gt;/.test(html), 'notice text is escaped');
ok(!/\son\w+=/i.test(V.pageHtml({ items: [{ ...evil, title: 'Hi', text: 'There' }], prefs: { match: true } }, 100, now)), 'no inline handlers (CSP)');
ok(/data-act="nt-open"/.test(html) && /data-act="nt-check"/.test(html) && /data-act="nt-clear"/.test(html) && /aria-checked="true"/.test(html) && /class="nt-item new"/.test(html), 'buttons, switch and unread state');
const empty = V.pageHtml({ items: [], prefs: { match: false } }, 40, now);
ok(/Nothing new yet/.test(empty) && /Finish your profile/.test(empty) && !/nt-clear/.test(empty) && /aria-checked="false"/.test(empty), 'empty state says what to do next');
ok(!/Finish your profile/.test(V.pageHtml({ items: [], prefs: { match: true } }, 100, now)), 'complete profile: no nag');
const { S } = await import('../public/js/core/state.js');
S.me = { id: 'u1', role: 'user' };
store0['fyndr-inbox:u1'] = JSON.stringify(box);
ok(/nt-count[^>]*>1</.test(B.bellHtml()) && /1 unread/.test(B.bellHtml()), 'bell shows the unread count');
store0['fyndr-inbox:u1'] = JSON.stringify(R.markAllRead(box));
ok(!/nt-count/.test(B.bellHtml()), 'no badge when all read');
S.me = { id: 'o1', role: 'org' };
ok(B.bellHtml() === '', 'organizations and staff get no bell');
S.me = null;
ok(B.bellHtml() === '', 'signed out: no bell');

// 6. wired in
const fs = await import('node:fs');
const rd = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
ok(/notify\.actions/.test(rd('public/js/core/events.js')) && /notifications: notifyView/.test(rd('public/js/core/router.js')) && /bellHtml/.test(rd('public/js/features/layout/nav.js')), 'events, router and header use it');
ok(/pages\/notify\.css/.test(rd('scripts/bundle-css.js')) && /\.nt-bell/.test(rd('public/css/app.css')), 'styles are bundled');
ok(/notifications\/notify\.rules\.js/.test(rd('public/precache.json')), 'files are precached');
console.log(`notify: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
