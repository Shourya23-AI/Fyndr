// End-to-end check of the Firestore backend logic against the in-memory stand-in.  Run:  node test/run.test.js
const store0 = {};
globalThis.document = { querySelector: () => null };
globalThis.localStorage = { getItem: k => store0[k] ?? (k.startsWith('fyndr-fbcfg') ? JSON.stringify({ cfg: { apiKey: 'YOUR_KEY' }, local: true }) : null), setItem: (k, v) => { store0[k] = v; }, removeItem: k => delete store0[k] };
const phones = { tokA: ['91', '9876543210'], tokB: ['91', '9123456780'], tokC: ['91', '9000000001'], tokD: ['91', '9000000002'] };
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
(await import('../public/js/services/firestore-api/fire-api.js')).tuning.selfTtl = 0;
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
await api('admin', '/init', 'POST', { role: 'user', name: 'Main', agree: true });
await api('org', '/init', 'POST', { role: 'org', orgName: 'Acme Academy', orgType: 'small', website: 'https://acme.com', agree: 'on' });
await api('cand', '/init', 'POST', { role: 'user', agree: true });
await api('cand2', '/init', 'POST', { role: 'user', agree: true });
await throws(() => api('cand', '/init', 'POST', { role: 'user', agree: true }), /already exists/, 'duplicate init');
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
await throws(() => api('cand', `/apply/${lid}`, 'POST', { consent: true }), /profile first/, 'profile needed before applying');
const prof = { qualification: "Bachelor's", field: 'CS', institution: 'MIT', experience: 'Student / Fresher', gradYear: 2025, skills: ['Python'], jobTypes: ['Course'] };
await api('cand', '/profile', 'PUT', prof);
await throws(() => api('cand', `/apply/${lid}`, 'POST', { consent: true }), /PHONE_REQUIRED/, 'phone needed before applying');
await api('cand', '/phone/verify', 'POST', { access_token: 'tokB' });
await throws(() => api('cand', '/resume', 'POST', { name: 'r.pdf', data: b64('not a pdf') }), /PDF/, 'only PDFs');
const big = b64('%PDF-' + 'x'.repeat(1700000)); // > one chunk
const rm = await api('cand', '/resume', 'POST', { name: 'cv.pdf', data: big });
ok(rm.chunks === 4, 'big resume split in chunks: ' + rm.chunks);
ok((await api('cand', '/resume/file')).data === big, 'resume reassembled intact');
await api('cand', `/apply/${lid}`, 'POST', { resume: 'own', consent: true });
await throws(() => api('cand', `/apply/${lid}`, 'POST', { consent: true }), /Already applied/, 'cannot apply twice');
await api('cand', `/save/${lid}`, 'POST');
const my = await api('cand', '/my');
ok(my.saved[0] === lid && my.applications.length === 1 && my.applications[0].listing.title === 'Python Bootcamp', 'my: saved + applications');
ok((await api('cand', `/save/${lid}`, 'POST')).saved === false, 'save toggles off');
ok(mock.store.get('users/c1').sharedWith.length === 0 && [...mock.store.keys()].some(k => k.startsWith('blobs/ar_c1_' + lid)), 'application carries its own resume copy (no live profile access)');

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

// ---- consent, resume copies, withdraw, export, delete account, retention
const keysOf = pre => [...mock.store.keys()].filter(k => k.startsWith(pre));
U.x1 = { uid: 'x1', email: 'newbie@gmail.com' };
await throws(() => api('x1', '/init', 'POST', { role: 'user' }), /CONSENT/, 'sign-up needs the Terms/Privacy box ticked');
await throws(() => api('x1', '/init', 'POST', { role: 'user', agree: false }), /CONSENT/, 'unticked box refused');
ok(mock.store.get('users/c1').consent.v === '2026-10-12' && !!mock.store.get('users/c1').consent.at, 'consent version + time stored at sign-up');
ok((await api('cand', '/me')).needsConsent === false, 'fresh account does not need consent again');
// an old account (consent from an older policy version) is asked once
mock.store.get('users/c2').consent = { v: '2025-01-01', at: '2025-01-01T00:00:00.000Z' };
ok((await api('cand2', '/me')).needsConsent === true, 'old policy version needs consent again');
await throws(() => api('cand2', '/consent', 'POST', {}), /CONSENT/, 'consent needs the tick');
ok((await api('cand2', '/consent', 'POST', { agree: true })).needsConsent === false, 'accepting clears the gate');

// a second listing, applied to with the website resume
const post2 = { ...post, title: 'Data Course', location: 'Pune' };
await api('org', '/listings', 'POST', post2);
const lid2 = (await api('org', '/org/listings')).find(l => l.title === 'Data Course').id;
await api('admin', `/admin/listings/${lid2}`, 'PATCH', { status: 'approved' });
await throws(() => api('cand', `/apply/${lid2}`, 'POST', { resume: 'site' }), /CONSENT/, 'apply needs the consent confirmation');
await api('cand', `/apply/${lid2}`, 'POST', { resume: 'site', consent: true });
const app2 = mock.store.get(`applications/c1_${lid2}`);
ok(!!app2.consentAt && app2.snapChunks === 1 && keysOf(`blobs/ar_c1_${lid2}_`).length === 1, 'application records consent time and holds one resume copy');
const oapps2 = await api('org', '/org/applications');
const a2 = oapps2.find(a => a.listingId === lid2);
// the copy is a snapshot: later profile edits do not change what the organization sees
await api('cand', '/profile', 'PUT', { ...prof, institution: 'Stanford' });
const seen = await api('org', `/org/applications/${a2.id}/resume`);
ok(seen.type === 'site' && seen.profile.institution === 'MIT' && seen.name === 'Sam', 'organization sees the resume as shared, not the live profile');
await api('cand', '/profile', 'PUT', prof);
// withdraw
await throws(() => api('cand2', `/applications/c1_${lid2}`, 'DELETE'), /Not found/, "cannot withdraw someone else's application");
await throws(() => api('org', `/applications/c1_${lid2}`, 'DELETE'), /Forbidden/, 'organization cannot use the candidate withdraw route');
await api('cand', `/applications/c1_${lid2}`, 'DELETE');
ok(!mock.store.has(`applications/c1_${lid2}`) && keysOf(`blobs/ar_c1_${lid2}_`).length === 0, 'withdrawing removes the application and its resume copy');
await throws(() => api('org', `/org/applications/${a2.id}/resume`), /Not found/, 'organization loses access after withdrawal');
ok((await api('cand', '/my')).applications.every(a => a.listingId !== lid2), 'withdrawn application disappears for the candidate');
await api('cand', `/apply/${lid2}`, 'POST', { resume: 'site', consent: true }); // can apply again later
await api('cand', `/applications/c1_${lid2}`, 'DELETE');

// applications made before resume copies existed still work, and withdrawing ends their access
mock.store.set('applications/c2_legacy', { userId: 'c2', listingId: 'legacy', orgId: 'org1', orgName: 'Acme Academy', title: 'Old', type: 'Job', name: 'Lee', email: 'lee@gmail.com', status: 'applied', resumeType: 'site', created: new Date().toISOString() });
mock.store.get('users/c2').sharedWith = ['org1'];
const leg = await api('org', '/org/applications/c2_legacy/resume');
ok(leg.type === 'site' && leg.profile.institution === 'MIT', 'older application still readable by its organization');
await api('cand2', '/applications/c2_legacy', 'DELETE');
ok(!mock.store.get('users/c2').sharedWith.includes('org1'), 'withdrawing an older application removes the organization from sharedWith');

// download my data
const ex = await api('cand', '/account/export');
ok(ex.account.email === 'sam@gmail.com' && ex.account.consent.v === '2026-10-12' && ex.profile.institution === 'MIT' && ex.applications.length === 1 && ex.applications[0].organization === 'Acme Academy' && ex.uploadedResume.base64 === big, 'candidate export holds account, profile, applications, consent and the resume file');
const exo = await api('org', '/account/export');
ok(exo.account.orgName === 'Acme Academy' && exo.listings.length === 2 && exo.listings.every(l => l.image === undefined && l.hasImage === true) && exo.applicationsReceived.length === 1, 'organization export holds listings (without pictures) and applications received');
await throws(() => api('admin', '/account/export'), /Forbidden/, 'staff accounts have no export');

// retention cleanup
const old = new Date(Date.now() - 400 * 864e5).toISOString();
const fresh = new Date().toISOString();
mock.store.set('applications/z_old', { userId: 'z', listingId: 'lx', orgId: 'org1', created: old, snapChunks: 1 });
mock.store.set('blobs/ar_z_old_0', { owner: 'z', kind: 'appresume', i: 0, appId: 'z_old', orgId: 'org1', data: 'x' });
mock.store.set('listings/closedL', { orgId: 'org1', status: 'closed', closedAt: new Date(Date.now() - 40 * 864e5).toISOString(), title: 'Closed', created: old });
mock.store.set('applications/z_closed', { userId: 'z', listingId: 'closedL', orgId: 'org1', created: fresh, snapChunks: 1 });
mock.store.set('blobs/ar_z_closed_0', { owner: 'z', kind: 'appresume', i: 0, appId: 'z_closed', orgId: 'org1', data: 'x' });
mock.store.set('listings/closedNew', { orgId: 'org1', status: 'closed', closedAt: new Date(Date.now() - 5 * 864e5).toISOString(), title: 'Closed lately', created: old });
mock.store.set('applications/z_recent', { userId: 'z', listingId: 'closedNew', orgId: 'org1', created: fresh, snapChunks: 1 });
await throws(() => api('cand2', '/admin/cleanup', 'POST'), /Forbidden/, 'only admins run cleanup');
const cl = await api('admin', '/admin/cleanup', 'POST');
ok(cl.removed === 2 && !mock.store.has('applications/z_old') && !mock.store.has('applications/z_closed') && !mock.store.has('blobs/ar_z_old_0') && !mock.store.has('blobs/ar_z_closed_0'), 'cleanup removes applications older than a year and 30+ days after their listing closed, with their copies');
ok(mock.store.has('applications/z_recent') && mock.store.has(`applications/c1_${lid}`), 'cleanup keeps recent and open applications');
mock.store.delete('applications/z_recent'); mock.store.delete('listings/closedL'); mock.store.delete('listings/closedNew');

// delete my account: candidate
U.c3 = { uid: 'c3', email: 'kay@gmail.com', displayName: 'Kay' };
await api('c3', '/init', 'POST', { role: 'user', agree: true });
await api('c3', '/profile', 'PUT', prof);
await api('c3', '/phone/verify', 'POST', { access_token: 'tokC' });
await api('c3', '/resume', 'POST', { name: 'k.pdf', data: PDF });
await api('c3', `/apply/${lid2}`, 'POST', { resume: 'own', consent: true });
await api('c3', `/save/${lid2}`, 'POST');
ok(keysOf('blobs/c3_').length === 1 && keysOf('blobs/ar_c3_').length === 1 && keysOf('phones/919000000001').length === 1, 'candidate c3 has account data to delete');
await api('c3', '/account', 'DELETE');
ok(!mock.store.has('users/c3') && keysOf('blobs/c3_').length === 0 && keysOf('blobs/ar_c3_').length === 0 && keysOf('applications/c3_').length === 0 && keysOf('users/c3/').length === 0 && !mock.store.has('phones/919000000001'), 'deleting my account removes profile, files, resume copies, applications, saved items and the phone claim');
await throws(() => api('c3', '/me'), /no profile/, 'deleted candidate has no profile');
// delete my account: organization
U.org2 = { uid: 'org2', email: 'hr@beta.com', displayName: 'Beta HR' };
await api('org2', '/init', 'POST', { role: 'org', orgName: 'Beta Labs', orgType: 'small', agree: true });
await api('org2', '/proof', 'POST', { name: 'p.pdf', data: PDF, portal: 'https://beta.com/careers' });
await api('admin', '/admin/proof/org2', 'PATCH', { status: 'verified' });
await api('org2', '/phone/verify', 'POST', { access_token: 'tokD' });
await api('org2', '/listings', 'POST', { ...post, title: 'Beta Role' });
const lid3 = (await api('org2', '/org/listings'))[0].id;
await api('admin', `/admin/listings/${lid3}`, 'PATCH', { status: 'approved' });
await api('cand', `/apply/${lid3}`, 'POST', { resume: 'site', consent: true });
ok(keysOf(`blobs/ar_c1_${lid3}_`).length === 1, 'application to org2 exists');
await api('org2', '/account', 'DELETE');
ok(!mock.store.has('users/org2') && !mock.store.has(`listings/${lid3}`) && !mock.store.has(`applications/c1_${lid3}`) && keysOf(`blobs/ar_c1_${lid3}_`).length === 0 && keysOf('blobs/org2_').length === 0 && !mock.store.has('phones/919000000002'), 'deleting an organization removes its listings, applications, resume copies, proof and phone claim');
ok((await api('cand', '/my')).applications.every(a => a.listingId !== lid3), 'candidate no longer sees applications to the deleted organization');
// staff accounts must be demoted first
await throws(() => api('admin', '/account', 'DELETE'), /cannot be deleted here/, 'main admin cannot delete itself');

// ---- admin: team + roles
await api('admin', '/admin/staff-invite', 'POST', { email: 'mod@x.com', role: 'moderator' });
const td = await api('admin', '/admin/data');
ok(td.invites.some(i => i.email === 'mod@x.com'), 'staff invite stored');
ok(td.team.some(t => t.permanent && t.email === 'admin.fyndr@gmail.com'), 'main admin on team');
await throws(() => api('admin', '/admin/staff/x', 'PATCH', { email: 'admin.fyndr@gmail.com', role: 'none' }), /permanent/, 'main admin protected');
store0.x = 1;
U.mod = { uid: 'mod1', email: 'mod@x.com' };
await api('mod', '/init', 'POST', { role: 'user', agree: true });
ok((await api('mod', '/me')).role === 'moderator', 'invited email becomes moderator');
await throws(() => api('mod', '/admin/staff-invite', 'POST', { email: 'a@b.co', role: 'admin' }), /Forbidden/, 'moderator cannot manage team');
await api('admin', '/admin/orgs/org1', 'PATCH', { orgType: 'enterprise', gmailOk: true });
ok(mock.store.get('users/org1').gmailOk === true && mock.store.get('users/org1').orgType === 'enterprise', 'org size + gmail override');
await api('admin', '/admin/orgs/org1', 'PATCH', { gmailOk: null });
ok(!('gmailOk' in mock.store.get('users/org1')), 'gmail override cleared');

// ---- step 3: imported listings, trust bands, full apply form
const good = { orgName: 'Globex', title: 'Backend Engineer', type: 'Job', location: 'Bengaluru', pay: 'INR 20-30 / year', description: 'Build services in Python and SQL on AWS. '.repeat(12), applyUrl: 'https://boards.greenhouse.io/globex/jobs/1', source: 'greenhouse' };
const doubtful = { orgName: 'Confidential', title: 'Office Assistant', type: 'Job', location: 'Pune', pay: 'See listing', description: 'Join us. Message on WhatsApp.', applyUrl: 'https://jobs-now.example.net/a1' };
const scam = { orgName: 'Quick Hire', title: 'Data Entry', type: 'Job', location: 'Remote', pay: 'Rs 500/day', description: 'Pay a registration fee of Rs 500 to start. Contact on WhatsApp. '.repeat(3), applyUrl: 'https://quickhire.example.net/x' };
await throws(() => api('cand', '/admin/import', 'POST', { items: [good] }), /Forbidden/, 'candidate cannot import');
const imp = await api('admin', '/admin/import', 'POST', { items: [good, doubtful, scam, good, { title: 'x' }, { ...good, applyUrl: 'http://insecure.example.com/1', title: 'Insecure' }] });
ok(imp.published === 1 && imp.review === 1 && imp.skipped === 1 && imp.duplicates === 1 && imp.invalid === 2, 'import sorts listings by trust: ' + JSON.stringify(imp));
const impRows = [...mock.store.entries()].filter(([k]) => k.startsWith('listings/imp_'));
ok(impRows.length === 2, 'obvious scam is not stored');
ok(impRows.find(([, v]) => v.title === 'Backend Engineer')[1].status === 'approved' && impRows.find(([, v]) => v.title === 'Office Assistant')[1].status === 'pending', 'trust >= 50 approved, below 50 goes to review');
ok(impRows.every(([, v]) => v.trust >= 0 && v.trust <= 100 && v.applyUrl.startsWith('https://') && v.source === 'import'), 'imported listings carry trust score and https apply link');
const pubList = await api('cand', '/listings');
const impPub = pubList.find(l => l.title === 'Backend Engineer');
ok(impPub && impPub.orgVerified === false && !pubList.some(l => l.title === 'Office Assistant'), 'candidates see only the published import (not marked as a verified organization)');
await throws(() => api('cand', `/apply/${impPub.id}`, 'POST', { consent: true }), /EXTERNAL/, 'imported listings are applied for on the official page');
const adm2 = await api('admin', '/admin/data');
ok(adm2.listings.some(l => l.title === 'Office Assistant' && l.status === 'pending'), 'review queue shows the doubtful import');
await api('admin', `/admin/listings/${impRows.find(([, v]) => v.title === 'Office Assistant')[0].split('/')[1]}`, 'PATCH', { status: 'approved' });
ok((await api('cand', '/listings')).some(l => l.title === 'Office Assistant'), 'admin can approve a doubtful import');
ok((await api('admin', '/admin/import', 'POST', { items: [good] })).duplicates === 1, 'importing again does not duplicate');

await api('org', '/listings', 'POST', { ...post, title: 'Design Intern', type: 'Internship' });
const dl = (await api('org', '/org/listings')).find(l => l.title === 'Design Intern').id;
await api('admin', `/admin/listings/${dl}`, 'PATCH', { status: 'approved' });
const form = { fullName: 'Casey Lee', email: 'c2@x.com', phone: '+919999999999', city: 'Pune', education: "Bachelor's, CS", skills: ['Figma', 'figma', 'UX'], experience: '0–1 years', linkedin: 'https://linkedin.com/in/casey', portfolio: '', note: 'I love design.' };
await throws(() => api('cand', `/apply/${dl}`, 'POST', { resume: 'site', consent: true, form: { ...form, note: '' } }), /fill in/, 'form needs a cover note');
await throws(() => api('cand', `/apply/${dl}`, 'POST', { resume: 'site', consent: true, form: { ...form, linkedin: 'javascript:alert(1)' } }), /fill in/, 'form links must be http(s)');
await api('cand', `/apply/${dl}`, 'POST', { resume: 'site', consent: true, form });
const got = (await api('org', '/org/applications')).find(a => a.listingId === dl);
ok(got && got.form.fullName === 'Casey Lee' && got.form.skills.length === 2 && got.form.city === 'Pune', 'organization receives the application form (skills de-duplicated)');
const sm = (await import('../public/js/features/listings/summary.js')).summarize(good);
ok(sm.skills.includes('Python') && sm.steps[0].includes('official page') && sm.overview.includes('Globex'), 'auto summary for an imported listing');
const imp2 = await import('../scripts/import-jobs.js');
const lds = imp2.jobPostings('<script type="application/ld+json">{"@graph":[{"@type":"JobPosting","title":"QA","description":"<p>Test</p>"}]}</script><script type="application/ld+json">not json</script>');
ok(lds.length === 1 && lds[0].title === 'QA', 'importer reads JobPosting data and ignores broken blocks');

// ---- step 4: usage counters, insights, auto-close
await api('cand', '/analytics', 'POST', { views: 3, searches: 2, emptySearches: 1, applyClicks: 1, empty: { 'rust developer': 1, 'a@b.com': 1, '555 1234': 4 }, skills: { python: 2, sql: 1 }, userId: 'c1', listingId: 'x' });
await api('cand', '/analytics', 'POST', { views: 999, searches: -5, empty: { 'rust developer': 2 } });
const day = new Date().toISOString().slice(0, 10);
const an = mock.store.get('analytics/' + day);
ok(an.views === 53 && an.searches === 2 && an.emptySearches === 1 && an.empty['rust developer'] === 3 && an.skills.python === 2, 'counters add up and are capped per call');
ok(!('a@b.com' in an.empty) && !('555 1234' in an.empty) && !('userId' in an) && !('listingId' in an), 'only plain words and fixed counters are stored (no email, number, user or listing id)');
await throws(() => api('cand', '/admin/insights'), /Forbidden/, 'candidate cannot read insights');
const ins = await api('admin', '/admin/insights');
const { aggregate, weeklyReport } = await import('../public/js/features/insights/insights.js');
const ag = aggregate(ins.analytics, ins.listings, 2, 7);
ok(ag.totals.views === 53 && ag.topEmpty[0][0] === 'rust developer' && ag.shortage.some(x => x.skill === 'python'), 'insights aggregate: totals, empty searches, demand vs supply');
const rep = weeklyReport(ag);
ok(/53 listing views/.test(rep) && /rust developer/.test(rep) && !/@/.test(rep), 'weekly report is written from totals only');
// auto-close: an imported listing older than 45 days, a posted one older than 90 days
const oldImp = new Date(Date.now() - 50 * 864e5).toISOString();
const older = new Date(Date.now() - 100 * 864e5).toISOString();
mock.store.set('listings/imp_old1', { orgId: 'import', orgName: 'Old Co', title: 'Old import', type: 'Job', location: 'x', pay: 'x', status: 'approved', source: 'import', applyUrl: 'https://old.example.com/1', trust: 80, created: oldImp });
mock.store.set('listings/posted_old', { orgId: 'org1', orgName: 'Acme Academy', title: 'Old posted', type: 'Job', location: 'x', pay: 'x', status: 'approved', created: older });
mock.store.set('listings/posted_new', { orgId: 'org1', orgName: 'Acme Academy', title: 'New posted', type: 'Job', location: 'x', pay: 'x', status: 'approved', created: oldImp });
await throws(() => api('cand', '/admin/expire', 'POST', {}), /Forbidden/, 'candidate cannot close listings');
const ex2 = await api('admin', '/admin/expire', 'POST', {});
ok(ex2.closed === 2 && mock.store.get('listings/imp_old1').status === 'closed' && !!mock.store.get('listings/imp_old1').closedAt && mock.store.get('listings/posted_new').status === 'approved', 'old listings auto-close (imports 45 days, posted 90 days)');
ok(!(await api('cand', '/listings')).some(l => l.title === 'Old import'), 'closed listings disappear from the public list');

// ---- automatic listings: course list, student filter, daily refresh and auto-close
const { trustScore: tScore, decide: tDecide } = await import('../public/js/features/trust/trust.js');
const { cleanImport: cImp, hash: hsh } = await import('../public/js/services/firestore-api/helpers.js');
const { LIFE_DAYS: LD, isExpired: isExp } = await import('../public/js/features/listings/expiry.js');
const { run: runImport } = await import('../scripts/import-to-firestore.js');
const { summarize: summ, labelled: lab } = await import('../public/js/features/listings/summary.js');
const cat = await imp2.fromCatalog({ file: 'courses.json' });
ok(cat.length >= 10 && cat.every(c => cImp(c) && tDecide(tScore(cImp(c))) === 'approved'), 'every picked course is valid and passes the trust check on its own');
ok(new Set(cat.map(c => c.applyUrl)).size === cat.length && cat.every(c => /^https:\/\//.test(c.applyUrl)), 'picked courses have unique https links');
const cs = summ({ ...cImp(cat[0]), id: 'cx' });
ok(cs.bestFor.length >= 2 && cs.provides.length >= 2 && !/Best for:/.test(cs.about) && !/What you get:/.test(cs.about), 'picked course shows "best for" and "what you get" as written, not repeated in the long text');
const lb = lab('Great role.\nWho should apply: final-year students; career switchers\nBenefits:\n- Health insurance\n- Free meals\nApply today.');
ok(lb.bestFor.length === 2 && lb.provides.join() === 'Health insurance,Free meals' && lb.rest === 'Great role.\nApply today.', 'labelled lines and bullet lists are picked up and removed from the long text');
const rs = summ({ id: 'rx', type: 'Internship', title: 'Marketing Intern', orgName: 'Zed', location: 'Remote', pay: 'INR 8000 / month', description: 'Work with our social team. Certificate and letter of recommendation on completion. Mentor support included.' });
ok(rs.bestFor[0].startsWith('Students') && rs.provides.includes('A certificate') && rs.provides.includes('A letter of recommendation') && rs.provides.includes('Mentorship from experienced people'), 'rules find best-for and perks when the text does not label them');
ok(summ({ id: 'ex', type: 'Job', title: 'Helper', orgName: 'Q', location: 'See listing', pay: 'See listing', description: 'Short.' }).provides.length === 0, 'nothing is invented when the listing says nothing');
ok(imp2.studentFriendly({ title: 'Data Intern', description: '' }) && imp2.studentFriendly({ title: 'Analyst', description: 'Open to freshers.' }) && !imp2.studentFriendly({ title: 'Senior Engineer', description: 'x' }) && !imp2.studentFriendly({ title: 'Engineer', description: 'Needs 5+ years of experience' }) && !imp2.studentFriendly({ title: 'Accountant', description: 'Manage the books.' }), 'student filter keeps entry-level roles and drops senior or unlabelled ones');
ok(imp2.placeOk({ location: 'Bengaluru, Karnataka, India' }, ['india']) && imp2.placeOk({ location: 'Remote' }, ['remote']) && !imp2.placeOk({ location: 'Berlin, Germany' }, ['india', 'remote']), 'location filter');
const mkdb = () => {
    const m = new Map();
    const snap = id => ({ id, exists: m.has('listings/' + id), data: () => m.get('listings/' + id), ref: ref(id) });
    const ref = id => ({ get: async () => snap(id), set: async v => { m.set('listings/' + id, { ...v }); }, update: async v => { m.set('listings/' + id, { ...m.get('listings/' + id), ...v }); } });
    return { m, collection: () => ({ doc: ref, where: (f, o, v) => { const c = [[f, v]]; const q = { where: (f2, o2, v2) => { c.push([f2, v2]); return q; }, get: async () => ({ docs: [...m.entries()].filter(([k, x]) => k.startsWith('listings/') && c.every(([a, b]) => x[a] === b)).map(([k]) => snap(k.slice(9))) }) }; return q; } }) };
};
const deps = { trustScore: tScore, decide: tDecide, cleanImport: cImp, hash: hsh, LIFE_DAYS: LD };
const longText = 'Join the team and work with real users every day. '.repeat(10) + 'Great for freshers.';
const job = n => ({ orgName: 'Acme', title: 'Intern ' + n, type: 'Internship', location: 'Pune', pay: '', description: longText, applyUrl: 'https://boards.greenhouse.io/acme/jobs/' + n, source: 'greenhouse', srcKey: 'greenhouse:acme' });
const six = [1, 2, 3, 4, 5, 6].map(job);
const irep = { complete: new Set(['greenhouse:acme']) };
const fdb = mkdb();
const r1 = await runImport(fdb, six, deps, irep, Date.now(), () => { });
ok(r1.published === 6 && r1.review === 0, 'daily importer publishes trusted listings');
const r1b = await runImport(fdb, six, deps, irep, Date.now(), () => { });
ok(r1b.refreshed === 6 && r1b.published === 0 && r1b.gone === 0, 'running it again adds nothing new and keeps the same listings open');
const r2 = await runImport(fdb, six.slice(0, 5), deps, irep, Date.now(), () => { });
ok(r2.gone === 1 && fdb.m.get('listings/imp_' + hsh(six[5].applyUrl)).status === 'closed' && !!fdb.m.get('listings/imp_' + hsh(six[5].applyUrl)).closedAt, 'a job removed from the employer\'s page is closed automatically');
const r3 = await runImport(fdb, six.slice(0, 1), deps, irep, Date.now(), () => { });
ok(r3.gone === 0 && fdb.m.get('listings/imp_' + hsh(six[1].applyUrl)).status === 'approved', 'if almost everything vanishes at once, nothing is closed (probably a glitch)');
const r4 = await runImport(fdb, [], deps, { complete: new Set() }, Date.now(), () => { });
ok(r4.gone === 0 && r4.closed === 0, 'a source that failed this run closes nothing');
const later = Date.now() + (LD.import + 1) * 864e5;
const r5 = await runImport(fdb, [], deps, { complete: new Set() }, later, () => { });
ok(r5.closed === 5, 'listings nobody has seen for 45 days are closed');
ok(isExp({ status: 'approved', source: 'import', created: new Date(Date.now() - 60 * 864e5).toISOString(), lastSeen: new Date().toISOString() }) === false, 'an imported listing still seen recently does not expire by age');

// ---- importer inside the Node server (no GitHub needed)
const { applyImport } = await import('../server/jobs/auto-import.js');
{
    const L = [];
    const a1 = applyImport(L, six, deps, irep, Date.now());
    ok(a1.published === 6 && L.length === 6 && L.every(x => x.status === 'approved' && x.source === 'import' && x.id.startsWith('imp_')), 'node auto import: trusted listings are stored as approved');
    const a2 = applyImport(L, six, deps, irep, Date.now());
    ok(a2.refreshed === 6 && L.length === 6, 'node auto import: second run adds nothing and keeps them open');
    const a3 = applyImport(L, six.slice(0, 5), deps, irep, Date.now());
    ok(a3.gone === 1 && L.filter(x => x.status === 'closed').length === 1, 'node auto import: a job gone from the employer page is closed');
    const a4 = applyImport(L, [], deps, { complete: new Set() }, Date.now() + (LD.import + 1) * 864e5);
    ok(a4.closed === 5, 'node auto import: listings unseen for 45 days are closed');
}

// ---- delete listing / user cascade
await api('org', `/listings/${lid}`, 'DELETE');
ok(![...mock.store.keys()].some(k => (k.startsWith('applications/') && k.endsWith('_' + lid)) || k.startsWith('blobs/ar_') && k.includes('_' + lid + '_')), 'deleting a listing removes its applications and their resume copies');
await api('admin', '/admin/users/c1', 'DELETE');
ok(![...mock.store.keys()].some(k => k.startsWith('blobs/c1_') || k.startsWith('blobs/ar_c1_') || k === 'users/c1' || k.startsWith('phones/9123')), 'deleting an account removes user, files and phone claim');
await throws(() => api('cand', '/me'), /no profile/, 'deleted account has no profile');

// ---- signed out
await throws(() => fireApi('/listings', 'GET', {}, null), /log in/, 'needs login');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
