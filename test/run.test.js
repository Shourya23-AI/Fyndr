// End-to-end check of the Firestore backend logic against the in-memory stand-in.  Run:  node test/run.test.js
const store0 = {};
globalThis.document = { querySelector: () => null };
globalThis.localStorage = { getItem: k => store0[k] ?? (k.startsWith('fyndr-fbcfg') ? JSON.stringify({ cfg: { apiKey: 'YOUR_KEY' }, local: true }) : null), setItem: (k, v) => { store0[k] = v; }, removeItem: k => delete store0[k] };
const phones = { tokA: ['91', '9876543210'], tokB: ['91', '9123456780'] };
globalThis.fetch = async (u, o) => {
    u = String(u);
    if (u.includes('config/phone-email.json')) return { ok: true, json: async () => ({ clientId: 'abc' }) };
    if (u.includes('eapi.phone.email')) { const [cc, no] = phones[o.body.get('access_token')] || []; return { json: async () => (no ? { status: 200, country_code: '+' + cc, phone_no: no } : { status: 400 }) }; }
    throw new Error('offline');
};
const { useFs } = await import('../public/js/services/firestore-api/fire.js');
const { createMock } = await import('./mock-firestore.js');
const { fireApi } = await import('../public/js/services/firestore-api/fire-api.js');
const mock = createMock();
useFs(mock);

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const throws = async (f, re, n) => { try { await f(); fail++; console.log('  FAIL (no error)', n); } catch (e) { ok(re.test(e.code || e.message), n + ' -> ' + (e.code || e.message)); } };
const U = { admin: { uid: 'adm', email: 'admin.fyndr@gmail.com' }, org: { uid: 'org1', email: 'hr@acme.com', displayName: 'Acme HR' }, cand: { uid: 'c1', email: 'sam@gmail.com', displayName: 'Sam' }, cand2: { uid: 'c2', email: 'lee@gmail.com', displayName: 'Lee' } };
const api = (u, p, m = 'GET', b) => fireApi(p, m, b, U[u]);
const b64 = s => Buffer.from(s, 'latin1').toString('base64');
const PDF = b64('%PDF-1.4 hello world');
const IMG = 'data:image/jpeg;base64,' + b64('\xFF\xD8\xFF fake jpeg bytes');

// ---- accounts
await api('admin', '/init', 'POST', { role: 'user', name: 'Main' });
await api('org', '/init', 'POST', { role: 'org', orgName: 'Acme Academy', orgType: 'small', website: 'https://acme.com' });
await api('cand', '/init', 'POST', { role: 'user' });
await api('cand2', '/init', 'POST', { role: 'user' });
await throws(() => api('cand', '/init', 'POST', { role: 'user' }), /already exists/, 'duplicate init');
const adm = await api('admin', '/me');
ok(adm.role === 'admin' && adm.permanent, 'main admin is admin');
ok((await api('cand', '/me')).role === 'user', 'candidate role');

// ---- org must be verified, have a phone, add a cover image
const post = { title: 'Python Bootcamp', type: 'Course', location: 'Online', pay: '$99', duration: '12 weeks', description: 'Learn Python', image: IMG, logo: IMG };
await throws(() => api('org', '/listings', 'POST', post), /NOT_VERIFIED/, 'unverified org cannot post');
await throws(() => api('org', '/proof', 'POST', { name: 'x', data: PDF }), /careers page/, 'org proof needs https portal');
const me1 = await api('org', '/proof', 'POST', { name: 'proof.pdf', data: PDF, portal: 'https://acme.com/careers' });
ok(me1.proofStatus === 'pending', 'proof pending');
ok((await api('admin', '/proof/file/org1')).data === PDF, 'staff can read the proof file');
await throws(() => api('cand', '/admin/proof/org1', 'PATCH', { status: 'verified' }), /Forbidden/, 'candidate cannot verify');
await api('admin', '/admin/proof/org1', 'PATCH', { status: 'verified' });
ok((await api('org', '/me')).verified === true, 'org verified');
await throws(() => api('org', '/listings', 'POST', post), /PHONE_REQUIRED/, 'phone required to post');
await api('org', '/phone/verify', 'POST', { access_token: 'tokA' });
await throws(() => api('cand', '/phone/verify', 'POST', { access_token: 'tokA' }), /PHONE_TAKEN/, 'same phone on 2nd account refused');
await throws(() => api('org', '/listings', 'POST', { ...post, image: '' }), /cover image/i, 'cover image required');
await throws(() => api('org', '/listings', 'POST', { ...post, image: 'data:text/html;base64,AAAA' }), /cover image/i, 'non-image refused');
await throws(() => api('org', '/listings', 'POST', { ...post, image: 'data:image/jpeg;base64,' + 'A'.repeat(160000) }), /cover image/i, 'oversized image refused');
await api('org', '/listings', 'POST', post);
ok((await api('cand', '/listings')).length === 0, 'pending listing not public');
const mine = await api('org', '/org/listings');
ok(mine.length === 1 && mine[0].status === 'pending' && mine[0].image === IMG && mine[0].duration === '12 weeks', 'org sees own pending listing with image');
const lid = mine[0].id;

// ---- moderation
await throws(() => api('org', `/admin/listings/${lid}`, 'PATCH', { status: 'approved' }), /Forbidden/, 'org cannot approve itself');
const ad = await api('admin', '/admin/data');
ok(ad.stats.pendingListings === 1 && ad.listings[0].image === IMG, 'admin sees pending listing + image');
await api('admin', `/admin/listings/${lid}`, 'PATCH', { status: 'approved' });
const pubL = await api('cand', '/listings?type=Course');
ok(pubL.length === 1 && pubL[0].orgVerified && pubL[0].logo === IMG, 'approved listing is public with logo');
ok((await api('cand', '/listings?q=nomatch')).length === 0, 'search filter');

// ---- candidate flow
await throws(() => api('cand', `/apply/${lid}`, 'POST', {}), /profile first/, 'profile needed before applying');
const prof = { qualification: "Bachelor's", field: 'CS', institution: 'MIT', experience: 'Student / Fresher', gradYear: 2025, skills: ['Python'], jobTypes: ['Course'] };
await api('cand', '/profile', 'PUT', prof);
await throws(() => api('cand', `/apply/${lid}`, 'POST', {}), /PHONE_REQUIRED/, 'phone needed before applying');
await api('cand', '/phone/verify', 'POST', { access_token: 'tokB' });
await throws(() => api('cand', '/resume', 'POST', { name: 'r.pdf', data: b64('not a pdf') }), /PDF/, 'only PDFs');
const big = b64('%PDF-' + 'x'.repeat(1700000)); // > one chunk
const rm = await api('cand', '/resume', 'POST', { name: 'cv.pdf', data: big });
ok(rm.chunks === 4, 'big resume split in chunks: ' + rm.chunks);
ok((await api('cand', '/resume/file')).data === big, 'resume reassembled intact');
await api('cand', `/apply/${lid}`, 'POST', { resume: 'own' });
await throws(() => api('cand', `/apply/${lid}`, 'POST', {}), /Already applied/, 'cannot apply twice');
await api('cand', `/save/${lid}`, 'POST');
const my = await api('cand', '/my');
ok(my.saved[0] === lid && my.applications.length === 1 && my.applications[0].listing.title === 'Python Bootcamp', 'my: saved + applications');
ok((await api('cand', `/save/${lid}`, 'POST')).saved === false, 'save toggles off');
ok(mock.store.get('users/c1').sharedWith.includes('org1'), 'candidate shared profile with that org');

// ---- org side
const oapps = await api('org', '/org/applications');
ok(oapps.length === 1 && oapps[0].name === 'Sam' && oapps[0].title === 'Python Bootcamp', 'org sees applicant');
const res = await api('org', `/org/applications/${oapps[0].id}/resume`);
ok(res.type === 'own' && res.data === big, 'org reads own-resume PDF');
await api('org', `/applications/${oapps[0].id}`, 'PATCH', { status: 'interview' });
ok((await api('cand', '/my')).applications[0].status === 'interview', 'status change reaches candidate');
await throws(() => api('cand', `/applications/${oapps[0].id}`, 'PATCH', { status: 'accepted' }), /Forbidden/, 'candidate cannot set status');
ok((await api('org', '/org/listings'))[0].applicants === 1, 'applicant count');
await api('cand2', '/profile', 'PUT', prof);
await throws(() => api('cand2', '/proof/file/org1'), /Not found/, 'others cannot read proof files');

// ---- admin: team + roles
await api('admin', '/admin/staff-invite', 'POST', { email: 'mod@x.com', role: 'moderator' });
const td = await api('admin', '/admin/data');
ok(td.invites.some(i => i.email === 'mod@x.com'), 'staff invite stored');
ok(td.team.some(t => t.permanent && t.email === 'admin.fyndr@gmail.com'), 'main admin on team');
await throws(() => api('admin', '/admin/staff/x', 'PATCH', { email: 'admin.fyndr@gmail.com', role: 'none' }), /permanent/, 'main admin protected');
store0.x = 1;
U.mod = { uid: 'mod1', email: 'mod@x.com' };
await api('mod', '/init', 'POST', { role: 'user' });
ok((await api('mod', '/me')).role === 'moderator', 'invited email becomes moderator');
await throws(() => api('mod', '/admin/staff-invite', 'POST', { email: 'a@b.co', role: 'admin' }), /Forbidden/, 'moderator cannot manage team');
await api('admin', '/admin/orgs/org1', 'PATCH', { orgType: 'enterprise', gmailOk: true });
ok(mock.store.get('users/org1').gmailOk === true && mock.store.get('users/org1').orgType === 'enterprise', 'org size + gmail override');
await api('admin', '/admin/orgs/org1', 'PATCH', { gmailOk: null });
ok(!('gmailOk' in mock.store.get('users/org1')), 'gmail override cleared');

// ---- delete listing / user cascade
await api('org', `/listings/${lid}`, 'DELETE');
ok(![...mock.store.keys()].some(k => k.startsWith('applications/')), 'deleting a listing removes its applications');
await api('admin', '/admin/users/c1', 'DELETE');
ok(![...mock.store.keys()].some(k => k.startsWith('blobs/c1_') || k === 'users/c1' || k.startsWith('phones/9123')), 'deleting an account removes user, files and phone claim');
await throws(() => api('cand', '/me'), /no profile/, 'deleted account has no profile');

// ---- signed out
await throws(() => fireApi('/listings', 'GET', {}, null), /log in/, 'needs login');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
