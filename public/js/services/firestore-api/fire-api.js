// The whole Fyndr backend for static hosting (GitHub Pages): same routes as the Node server (server/routes/*),
// answered straight from Firebase Firestore. There is no server: firestore.rules decides who may read and write what.
//
// Collections
//   users/{uid}                 account + profile + resume/proof info + photo        (owner, staff, and orgs the candidate applied to)
//   users/{uid}/saved/{listing} saved listings                                       (owner)
//   listings/{id}               jobs / internships / courses incl. cover image+logo  (approved = public; owner; staff)
//   applications/{uid}_{listing} one application per candidate per listing           (candidate, that organization, staff)
//   blobs/{uid}_{kind}_{i}      chunks of resume PDFs and proof documents            (owner; staff for proofs)
//   blobs/ar_{appId}_{i}        the resume copy shared by ONE application            (candidate, that organization; deleted with the application)
//   phones/{digits}             one verified phone number belongs to one account
//   staff/{email}               admin / moderator roles
//   reports/{listingId}_{uid}   "Report this listing": one report per person per listing           (the reporter writes; staff read)
import { fs, friendly, SITE_VERSION } from './fire.js';
import { staffOf, staffMap, setStaff } from '../cloud/cloud.js';
import { phoneClientId, lookupPhone, phoneVerifyUrl } from '../phone-email/phone-email.js';
import { putBlob, dropBlob, getBlob, putAppBlob, dropAppBlob, getAppBlob } from './blobs.js';
import { expiredApps } from './retention.js';
import { POLICY_VERSION } from '../../features/legal/constants.js';
import { ADMIN_EMAILS } from './config.js';
import { trustScore, decide } from '../../features/trust/trust.js';
import { cleanReport, cleanTitle, cleanOrg, isCatalogId, reportId } from '../../features/report/report.rules.js';
import { isExpired, dropExpired } from '../../features/listings/expiry.js';
import { QUAL, EXP, JT, ORG_TYPES, IMG_MAX, now, lc, bad, isMain, isFree, gmailAllowed, pub, meOf, completion, cleanExtras, need, imgOk, filterListings, adminData, cleanForm, cleanImport, hash, studyFrom } from './helpers.js';

const NUM = ['views', 'searches', 'emptySearches', 'saves', 'applyClicks'];
// Counters from the browser, cleaned: whole numbers 0-50, plain words only, at most 10 words per kind.
const cleanCounts = b => {
    const n = v => Math.max(0, Math.min(50, Math.floor(+v) || 0));
    const mp = (o, re) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k]) => re.test(k)).slice(0, 10).map(([k, v]) => [k, n(v)]).filter(([, v]) => v));
    const out = Object.fromEntries(NUM.map(k => [k, n(b[k])]).filter(([, v]) => v));
    const empty = mp(b.empty, /^[a-z][a-z +#.-]{1,28}$/);
    const skills = mp(b.skills, /^[a-z0-9][a-z0-9 +#.-]{0,28}$/);
    return { ...out, ...(Object.keys(empty).length ? { empty } : {}), ...(Object.keys(skills).length ? { skills } : {}) };
};
export const tuning = { selfTtl: 8000 }; // how long (ms) your own profile document is reused between calls (0 = always re-read)
const selfMemo = { uid: null, t: 0, d: null };
const sweep = { t: 0 }; // last time expired applications were cleaned up (admin dashboard)
const agreed = v => v === true || v === 'on';
const memo = { listings: null }; // approved listings kept for a short while so tab changes do not re-download the images
const LIFE = 30e3;
const digits = p => String(p || '').replace(/\D/g, '');
const mimeOf = r => r.startsWith('%PDF-') ? 'application/pdf' : r.startsWith('\xFF\xD8') ? 'image/jpeg' : r.startsWith('\x89PNG') ? 'image/png' : (r.startsWith('RIFF') && r.slice(8, 12) === 'WEBP') ? 'image/webp' : null;
const rows = s => s.docs.map(x => ({ id: x.id, ...x.data() }));

export async function fireApi(path, method, b = {}, fu) {
    try {
        const r = await run(path, method, b, fu);
        return r;
    } catch (e) {
        throw friendly(e);
    } finally {
        if (method !== 'GET') {
            memo.listings = null;
            selfMemo.d = null;
        }
    }
}

async function run(path, method, b, fu) {
    const { m, db } = await fs();
    const url = new URL(path, 'http://x');
    const p = url.pathname;
    const q = url.searchParams;
    const id = p.split('/').pop();
    const k = method + ' ' + p.replace(/^(\/(?:apply|save|report|admin\/reports|listings|applications|admin\/listings|admin\/staff|admin\/orgs|admin\/users|admin\/proof|proof\/file))\/[^/]+$/, '$1/:id');
    const col = n => m.collection(db, n);
    const ref = (n, i) => m.doc(db, n, i);
    const loadUser = async i => {
        const s = await m.getDoc(ref('users', i));
        return s.exists() ? { id: s.id, ...s.data() } : null;
    };
    // Deletes in groups (a batch holds at most 500 writes).
    // Deletes applications together with the resume copy each one carries (the organization loses access at the same moment).
    const dropApps = async list => {
        for (let i = 0; i < list.length; i += 50) {
            const bt = m.writeBatch(db);
            for (const a of list.slice(i, i + 50)) {
                await dropAppBlob(bt, a.id, a.snapChunks || 0);
                bt.delete(ref('applications', a.id));
            }
            await bt.commit();
        }
    };
    // An organization that stops being verified must not keep live listings: they go back to 'pending' until staff look again.
    const hideOrgListings = async orgId => {
        const live = await m.getDocs(m.query(col('listings'), m.where('orgId', '==', orgId), m.where('status', '==', 'approved')));
        for (let i = 0; i < live.docs.length; i += 400) {
            const bt = m.writeBatch(db);
            live.docs.slice(i, i + 400).forEach(d => bt.update(d.ref, { status: 'pending' }));
            await bt.commit();
        }
        memo.listings = null;
    };
    const wipe = async refs => {
        for (let i = 0; i < refs.length; i += 400) {
            const bt = m.writeBatch(db);
            refs.slice(i, i + 400).forEach(r => bt.delete(r));
            await bt.commit();
        }
    };

    if (!fu) {
        bad('Please log in');
    }
    if (k === 'GET /listings') {
        if (!memo.listings || Date.now() - memo.listings.t > LIFE) {
            const s = await m.getDocs(m.query(col('listings'), m.where('status', '==', 'approved')));
            memo.listings = { t: Date.now(), d: dropExpired(rows(s)).map(x => ({ ...x, orgVerified: x.source !== 'import' })) };
        }
        return filterListings(memo.listings.d, q);
    }
    if (k === 'POST /init') {
        if (await loadUser(fu.uid)) {
            bad('Profile already exists');
        }
        if (!agreed(b.agree)) {
            bad('Please accept the Terms and Privacy Policy to create an account', 'CONSENT');
        }
        const role = b.role === 'org' ? 'org' : 'user';
        if (role === 'org') {
            need(b, 'orgName');
            if (!ORG_TYPES.includes(b.orgType)) {
                bad('Choose your organization type: small business or enterprise');
            }
            if (b.orgType === 'enterprise' && isFree(fu.email)) {
                bad('Enterprise organizations must use a work email. Small businesses can use Gmail.');
            }
        }
        const u = {
            name: String(b.name || fu.displayName || (fu.email || '').split('@')[0]).trim().slice(0, 80), email: lc(fu.email), role, verified: false, sharedWith: [], consent: { v: POLICY_VERSION, at: now() }, created: now()
        };
        if (role === 'org') {
            u.orgName = b.orgName.trim().slice(0, 80);
            u.orgType = b.orgType;
            u.website = String(b.website || '').trim().slice(0, 200);
        }
        await m.setDoc(ref('users', fu.uid), u);
        return pub({ id: fu.uid, ...u, role });
    }

    // Every call used to re-read the profile; reuse it for a few seconds (any change clears it).
    let doc0;
    if (tuning.selfTtl && selfMemo.d && selfMemo.uid === fu.uid && Date.now() - selfMemo.t < tuning.selfTtl) {
        doc0 = selfMemo.d;
    } else {
        doc0 = await loadUser(fu.uid);
        Object.assign(selfMemo, { uid: fu.uid, t: Date.now(), d: doc0 });
    }
    if (!doc0) {
        bad('no profile');
    }
    // Staff roles come from the staff collection (so they follow the person to every device). The main admin is built in.
    const level = isMain(fu.email) ? 'admin' : await staffOf(fu.email);
    const user = { ...doc0, role: level || doc0.role }; // user.role = effective role; doc0.role = what the account was created as
    const only = (...r) => {
        if (!r.includes(user.role)) {
            bad('Forbidden');
        }
    };
    const onboarded = () => {
        if (!user.profile?.done) {
            bad('Complete your profile first');
        }
    };
    const patchMe = fields => m.updateDoc(ref('users', fu.uid), fields);
    // Removes an account and everything that hangs off it: applications (with their resume copies), listings, saved items, files, phone claim.
    const purge = async u => {
        const org = u.role === 'org';
        const [ls, ap, sv, rp] = await Promise.all([
            org ? m.getDocs(m.query(col('listings'), m.where('orgId', '==', u.id))) : { docs: [] },
            m.getDocs(m.query(col('applications'), m.where(org ? 'orgId' : 'userId', '==', u.id))),
            m.getDocs(m.collection(db, 'users', u.id, 'saved')),
            m.getDocs(m.query(col('reports'), m.where('userId', '==', u.id))).catch(() => ({ docs: [] })) // (a person can only list their own reports if the rules allow it; staff deleting an account can)
        ]);
        await dropApps(rows(ap));
        const bt = m.writeBatch(db);
        await dropBlob(bt, u.id, 'resume', u.resume?.chunks || 0);
        await dropBlob(bt, u.id, 'proof', u.proof?.chunks || 0);
        await bt.commit();
        const refs = [...ls.docs.map(x => x.ref), ...sv.docs.map(x => x.ref), ...rp.docs.map(x => x.ref)];
        if (u.phone) {
            refs.push(ref('phones', digits(u.phone)));
        }
        await wipe([...refs, ref('users', u.id)]);
    };

    const om = p.match(/^\/org\/applications\/([^/]+)\/resume$/);
    if (method === 'GET' && om) {
        only('org');
        const as = await m.getDoc(ref('applications', om[1]));
        const a = as.exists() ? as.data() : null;
        if (!a || a.orgId !== user.id) {
            bad('Not found');
        }
        if (a.snapChunks) { // the copy the candidate chose to share when applying
            const raw = await getAppBlob(om[1], a.snapChunks);
            if (a.resumeType === 'own') {
                return { type: 'own', mime: 'application/pdf', data: raw };
            }
            let c;
            try {
                c = JSON.parse(raw);
            } catch {
                bad('This resume copy is damaged');
            }
            return {
                type: 'site', name: c.name, email: c.email, phone: c.phone || null, photo: c.photo || null, profile: c.profile || {}
            };
        }
        // Applications made before resume copies existed: read the candidate's current details (access came from users/{uid}.sharedWith).
        const u = await loadUser(a.userId);
        if (!u) {
            bad('Candidate not found');
        }
        if (a.resumeType === 'own' && u.resume) {
            return { type: 'own', mime: 'application/pdf', data: await getBlob(u.id, 'resume', u.resume.chunks || 1) };
        }
        return {
            type: 'site', name: u.name, email: u.email, phone: u.phone || null, photo: u.photo || null, profile: u.profile || {}
        };
    }

    switch (k) {
        case 'GET /me': return meOf(user);
        case 'POST /consent': {
            if (!agreed(b.agree)) {
                bad('Please tick the box to continue', 'CONSENT');
            }
            const consent = { v: POLICY_VERSION, at: now() };
            await patchMe({ consent });
            return meOf({ ...user, consent });
        }
        case 'GET /account/export': {
            only('user', 'org');
            const acct = {
                id: user.id, name: doc0.name, email: doc0.email, role: doc0.role, phone: doc0.phone || null, created: doc0.created, consent: doc0.consent || null
            };
            if (doc0.role === 'org') {
                const [ls, ap] = await Promise.all([m.getDocs(m.query(col('listings'), m.where('orgId', '==', user.id))), m.getDocs(m.query(col('applications'), m.where('orgId', '==', user.id)))]);
                return {
                    exportedAt: now(), service: 'Fyndr', account: {
                        ...acct, orgName: doc0.orgName, orgType: doc0.orgType, website: doc0.website || '', verified: !!doc0.verified, proof: doc0.proof ? { portal: doc0.proof.portal, status: doc0.proof.status, name: doc0.proof.name, size: doc0.proof.size, at: doc0.proof.at } : null
                    },
                    listings: rows(ls).map(({ image, logo, ...l }) => ({ ...l, hasImage: !!image, hasLogo: !!logo })),
                    applicationsReceived: rows(ap).map(a => ({
                        id: a.id, listingId: a.listingId, title: a.title, type: a.type, candidateName: a.name, candidateEmail: a.email, status: a.status, resumeType: a.resumeType, created: a.created
                    }))
                };
            }
            const [sv, ap] = await Promise.all([m.getDocs(m.collection(db, 'users', user.id, 'saved')), m.getDocs(m.query(col('applications'), m.where('userId', '==', user.id)))]);
            return {
                exportedAt: now(), service: 'Fyndr', account: { ...acct, photo: doc0.photo || null }, profile: doc0.profile || {},
                uploadedResume: doc0.resume ? { name: doc0.resume.name, size: doc0.resume.size, at: doc0.resume.at, mime: 'application/pdf', base64: await getBlob(user.id, 'resume', doc0.resume.chunks || 1) } : null,
                documentCheck: doc0.proof ? { status: doc0.proof.status, name: doc0.proof.name, size: doc0.proof.size, at: doc0.proof.at } : null,
                applications: rows(ap).map(a => ({
                    id: a.id, listingId: a.listingId, title: a.title, organization: a.orgName, type: a.type, status: a.status, resumeShared: a.resumeType === 'own' ? 'uploaded PDF' : 'website resume', sharedAt: a.consentAt || a.created, created: a.created
                })).sort((x, y) => String(y.created).localeCompare(String(x.created))),
                savedListings: sv.docs.map(x => x.id)
            };
        }
        case 'DELETE /account': {
            if (user.role !== doc0.role || !['user', 'org'].includes(doc0.role)) {
                bad('Admin and moderator accounts cannot be deleted here. Ask the main admin to change your role first.');
            }
            await purge(doc0);
            return { ok: 1 };
        }
        case 'POST /proof': {
            only('user', 'org');
            let r;
            try {
                r = atob(String(b.data || '').slice(0, 16));
            } catch {
                bad('Invalid file');
            }
            const mime = mimeOf(r);
            if (!mime) {
                bad('Upload a clear photo (JPG, PNG, WebP) or a PDF');
            }
            const size = Math.floor(String(b.data).length * 3 / 4);
            if (size > 2 * 1024 * 1024) {
                bad('File must be under 2 MB');
            }
            let portal = '';
            if (user.role === 'org') {
                portal = String(b.portal || '').trim().slice(0, 200);
                if (!/^https:\/\/[^\s]+\.[^\s]+$/i.test(portal)) {
                    bad('Enter your careers page link starting with https://');
                }
            }
            const bt = m.writeBatch(db);
            const chunks = await putBlob(bt, user.id, 'proof', b.data, doc0.proof?.chunks || 0);
            const proof = {
                portal, mime, name: String(b.name || 'proof').replace(/[^\w.\- ]/g, '').slice(0, 80), size, status: 'pending', at: now(), chunks
            };
            bt.update(ref('users', user.id), { proof });
            await bt.commit();
            return meOf({ ...user, proof });
        }
        case 'GET /proof/file/:id': {
            const u = id === user.id ? user : await loadUser(id);
            if (!u?.proof || (u.id !== user.id && user.role !== 'admin' && user.role !== 'moderator')) {
                bad('Not found');
            }
            return { mime: u.proof.mime, data: await getBlob(u.id, 'proof', u.proof.chunks || 1) };
        }
        case 'PATCH /admin/proof/:id': {
            only('admin', 'moderator');
            const u = await loadUser(id);
            if (!u?.proof) {
                bad('Not found');
            }
            if (!['verified', 'rejected'].includes(b.status)) {
                bad('Bad status');
            }
            const f = { 'proof.status': b.status };
            if (u.role === 'org') {
                f.verified = b.status === 'verified';
            }
            await m.updateDoc(ref('users', id), f);
            if (u.role === 'org' && f.verified === false) {
                await hideOrgListings(id);
            }
            return { ok: 1 };
        }
        case 'POST /phone/verify': {
            only('user', 'org');
            // Preferred: a server (functions/index.js) checks the phone.email token and saves the number with admin rights.
            const serverUrl = await phoneVerifyUrl();
            if (serverUrl) {
                let r;
                try {
                    r = await fetch(serverUrl, {
                        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await fu.getIdToken() }, body: JSON.stringify({ access_token: String(b.access_token || '') })
                    });
                } catch {
                    bad('Could not reach the phone verification service. Please try again.', 'PHONE_UNREACHABLE');
                }
                const d = await r.json().catch(() => ({}));
                if (!r.ok || !d.phone) {
                    bad(d.error || 'Phone verification failed or expired. Please try again.', d.code || 'PHONE_FAILED');
                }
                return meOf({ ...user, phone: d.phone });
            }
            const cid = await phoneClientId();
            if (!cid) {
                bad('Phone verification is not set up yet. Add your Client ID to config/phone-email.json', 'NOT_CONFIGURED');
            }
            let ph = null;
            try {
                ph = await lookupPhone(String(b.access_token || ''), cid);
            } catch {
                bad('Could not reach the phone verification service. Please try again.', 'PHONE_UNREACHABLE');
            }
            if (!ph) {
                bad('Phone verification failed or expired. Please try again.', 'PHONE_FAILED');
            }
            const pr = ref('phones', digits(ph));
            const step = async (what, f) => {
                try {
                    return await f();
                } catch (e) {
                    if (e && e.code === 'permission-denied') {
                        throw Object.assign(new Error('Firestore rules refused this step: ' + what + '. Publish the latest firestore.rules (Firebase Console > Firestore Database > Rules), then try again. (site ' + SITE_VERSION + ')'), { code: 'DENIED' });
                    }
                    throw e;
                }
            };
            const owner = await step('checking the number is free', () => m.getDoc(pr));
            if (owner.exists() && owner.data().uid !== user.id) {
                bad('This phone number is already used by another account', 'PHONE_TAKEN');
            }
            // Two plain writes (no batch): 1) claim the number, 2) save it on the account. A retry after a half-done attempt just continues.
            if (!owner.exists()) {
                await step('claiming the number', () => m.setDoc(pr, { uid: user.id, at: now() }));
            }
            await step('saving the verified number', () => m.updateDoc(ref('users', user.id), { phone: ph, phoneId: digits(ph) }));
            return meOf({ ...user, phone: ph });
        }
        case 'GET /my': {
            only('user');
            const [sv, ap] = await Promise.all([m.getDocs(m.collection(db, 'users', user.id, 'saved')), m.getDocs(m.query(col('applications'), m.where('userId', '==', user.id)))]);
            return {
                saved: sv.docs.map(x => x.id),
                applications: rows(ap).map(a => ({ ...a, listing: { id: a.listingId, title: a.title, orgName: a.orgName, type: a.type } })).sort((x, y) => String(y.created).localeCompare(String(x.created)))
            };
        }
        case 'POST /apply/:id': {
            only('user');
            onboarded();
            if (b.consent !== true) {
                bad('Please confirm that you agree to share your resume with the organization', 'CONSENT');
            }
            const rt = b.resume === 'own' ? 'own' : 'site';
            if (rt === 'own' && !user.resume) {
                bad('Upload your resume first');
            }
            if (!user.phone) {
                bad('Verify your phone number before applying', 'PHONE_REQUIRED');
            }
            const ls = await m.getDoc(ref('listings', id));
            const l = ls.exists() && ls.data().status === 'approved' ? ls.data() : null;
            if (!l) {
                bad('Listing not found');
            }
            if (l.source === 'import') {
                bad('This listing is applied for on the employer\'s own page. Use the Apply on the official page button.', 'EXTERNAL');
            }
            const form = cleanForm(b.form);
            if (b.form !== undefined && !form) {
                bad('Please fill in your name, phone, city and a short note');
            }
            const mine = await m.getDocs(m.query(col('applications'), m.where('userId', '==', user.id)));
            if (mine.docs.some(x => x.data().listingId === id)) {
                bad('Already applied');
            }
            // The organization gets a COPY of what the candidate chose to share (the PDF, or the website-resume details as they are now).
            // It lives and dies with the application, so withdrawing the application ends the organization's access.
            const appId = user.id + '_' + id;
            const copy = rt === 'own' ? await getBlob(user.id, 'resume', user.resume.chunks || 1) : JSON.stringify({
                name: user.name, email: user.email, phone: user.phone || null, photo: user.photo || null, profile: user.profile || {}
            });
            const bt = m.writeBatch(db);
            const snapChunks = await putAppBlob(bt, user.id, l.orgId, appId, copy);
            bt.set(ref('applications', appId), {
                userId: user.id, listingId: id, orgId: l.orgId, orgName: l.orgName, title: l.title, type: l.type, name: user.name, email: user.email, status: 'applied', resumeType: rt, consentAt: now(), snapChunks, created: now(), ...(form ? { form } : {})
            });
            await bt.commit();
            return { ok: 1 };
        }
        case 'DELETE /applications/:id': { // the candidate withdraws an application
            only('user');
            if (!id.startsWith(user.id + '_')) {
                bad('Not found');
            }
            const as = await m.getDoc(ref('applications', id));
            const a = as.exists() ? as.data() : null;
            if (!a || a.userId !== user.id) {
                bad('Not found');
            }
            await dropApps([{ id, ...a }]);
            if (!a.snapChunks) { // an older application: also end that organization's access to the live profile
                const left = await m.getDocs(m.query(col('applications'), m.where('userId', '==', user.id)));
                if (!left.docs.some(x => x.data().orgId === a.orgId)) {
                    await patchMe({ sharedWith: m.arrayRemove(a.orgId) });
                }
            }
            return { ok: 1 };
        }
        case 'POST /report/:id': { // a signed-in person reports a listing (scam, misleading, closed); sending again replaces the first report
            only('user', 'org');
            const clean = cleanReport(b);
            if (!clean) {
                bad('Choose what is wrong with this listing');
            }
            let title;
            let orgName;
            if (isCatalogId(id)) { // a search link from the built-in catalog is not stored, so the report carries its title
                title = cleanTitle(b.title);
                orgName = cleanOrg(b.orgName);
                if (!title) {
                    bad('Missing listing title');
                }
            } else {
                const ls = await m.getDoc(ref('listings', id));
                if (!ls.exists() || ls.data().status !== 'approved') {
                    bad('Listing not found');
                }
                title = ls.data().title;
                orgName = ls.data().orgName;
            }
            await m.setDoc(ref('reports', reportId(id, user.id)), { listingId: id, userId: user.id, ...clean, title, orgName, status: 'open', created: now() });
            return { ok: 1 };
        }
        case 'PATCH /admin/reports/:id': { // staff close every open report about one listing
            only('admin', 'moderator');
            if (!['dismissed', 'actioned'].includes(b.status)) {
                bad('Bad status');
            }
            const rs = await m.getDocs(m.query(col('reports'), m.where('listingId', '==', id), m.where('status', '==', 'open')));
            for (let i = 0; i < rs.docs.length; i += 400) {
                const bt = m.writeBatch(db);
                rs.docs.slice(i, i + 400).forEach(d => bt.update(d.ref, { status: b.status }));
                await bt.commit();
            }
            return { ok: 1, closed: rs.docs.length };
        }
        case 'POST /save/:id': {
            only('user');
            onboarded();
            const sr = m.doc(db, 'users', user.id, 'saved', id);
            const had = (await m.getDoc(sr)).exists();
            if (had) {
                await m.deleteDoc(sr);
            } else {
                await m.setDoc(sr, { at: now() });
            }
            return { saved: !had };
        }
        case 'GET /profile':
            only('user');
            return {
                profile: user.profile || {}, resume: user.resume || null, completion: completion(user), phone: user.phone || null, name: user.name, email: user.email, photo: user.photo || null, joined: user.created
            };
        case 'PUT /profile': {
            only('user');
            need(b, 'qualification', 'field', 'institution', 'experience');
            const yr = +b.gradYear;
            if (!(yr >= 1970 && yr <= new Date().getFullYear() + 8)) {
                bad('Enter a valid graduation year');
            }
            if (!QUAL.includes(b.qualification) || !EXP.includes(b.experience)) {
                bad('Invalid selection');
            }
            const skills = [...new Set((Array.isArray(b.skills) ? b.skills : []).map(s => String(s).trim().slice(0, 30)).filter(Boolean))].slice(0, 30);
            if (!skills.length) {
                bad('Add at least one skill');
            }
            const profile = {
                qualification: b.qualification, ...studyFrom(b), field: b.field.trim().slice(0, 80), institution: b.institution.trim().slice(0, 100), gradYear: yr, skills, experience: b.experience, jobTypes: (Array.isArray(b.jobTypes) ? b.jobTypes : []).filter(t => JT.includes(t)), locations: String(b.locations || '').trim().slice(0, 150), headline: String(b.headline || '').trim().slice(0, 100), summary: String(b.summary || '').trim().slice(0, 500), projects: String(b.projects || '').trim().slice(0, 800), link: String(b.link || '').trim().slice(0, 200), ...cleanExtras(b, skills), done: true
            };
            await patchMe({ profile });
            return { completion: completion({ ...user, profile }) };
        }
        case 'POST /resume': {
            only('user');
            let ok = false;
            try {
                ok = atob(String(b.data || '').slice(0, 8)).startsWith('%PDF-');
            } catch { }
            if (!ok) {
                bad('Only PDF files are allowed');
            }
            const size = Math.floor(b.data.length * 3 / 4);
            if (size > 2 * 1024 * 1024) {
                bad('Resume must be under 2 MB');
            }
            const bt = m.writeBatch(db);
            const chunks = await putBlob(bt, user.id, 'resume', b.data, doc0.resume?.chunks || 0);
            const resume = {
                name: String(b.name || 'resume.pdf').replace(/[^\w.\- ]/g, '').slice(0, 80), size, at: now(), chunks
            };
            bt.update(ref('users', user.id), { resume });
            await bt.commit();
            return resume;
        }
        case 'GET /resume/file':
            only('user');
            if (!user.resume) {
                bad('No resume uploaded');
            }
            return { mime: 'application/pdf', data: await getBlob(user.id, 'resume', user.resume.chunks || 1) };
        case 'DELETE /resume': {
            only('user');
            const bt = m.writeBatch(db);
            await dropBlob(bt, user.id, 'resume', doc0.resume?.chunks || 0);
            bt.update(ref('users', user.id), { resume: m.deleteField() });
            await bt.commit();
            return { ok: 1 };
        }
        case 'POST /photo': {
            only('user');
            const d = String(b.data || '');
            if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(d) || d.length > 120000) {
                bad('Upload a JPG, PNG or WebP photo');
            }
            await patchMe({ photo: d });
            return { photo: d };
        }
        case 'DELETE /photo':
            only('user');
            await patchMe({ photo: m.deleteField() });
            return { ok: 1 };

        case 'POST /listings': {
            only('org');
            if (!user.verified) {
                bad('Your organization must be verified before posting', 'NOT_VERIFIED');
            }
            if (!gmailAllowed(user)) {
                bad('Posting with a Gmail or other free email is not enabled for your organization. Use a work email, or ask Fyndr admin to allow it.', 'FREE_EMAIL');
            }
            if (!user.phone) {
                bad('Verify your phone number before posting', 'PHONE_REQUIRED');
            }
            need(b, 'title', 'type', 'location', 'pay');
            if (!['Job', 'Internship', 'Course'].includes(b.type)) {
                bad('Invalid type');
            }
            if (!imgOk(b.image, IMG_MAX.image)) {
                bad('Add a cover image for your listing (JPG, PNG or WebP)');
            }
            if (b.logo && !imgOk(b.logo, IMG_MAX.logo)) {
                bad('That logo could not be used. Try another image.');
            }
            const l = {
                orgId: user.id, orgName: user.orgName, title: b.title.trim().slice(0, 120), type: b.type, location: b.location.trim().slice(0, 120), pay: b.pay.trim().slice(0, 80), duration: String(b.duration || '').trim().slice(0, 40), description: String(b.description || '').trim().slice(0, 4000), image: b.image, logo: b.logo || '', status: 'pending', created: now()
            };
            await m.setDoc(m.doc(col('listings')), l);
            return { ok: 1 };
        }
        case 'GET /org/listings': {
            only('org');
            const [ls, ap] = await Promise.all([m.getDocs(m.query(col('listings'), m.where('orgId', '==', user.id))), m.getDocs(m.query(col('applications'), m.where('orgId', '==', user.id)))]);
            const n = {};
            ap.docs.forEach(x => {
                n[x.data().listingId] = (n[x.data().listingId] || 0) + 1;
            });
            return rows(ls).map(l => ({ ...l, applicants: n[l.id] || 0 })).sort((x, y) => String(y.created).localeCompare(String(x.created)));
        }
        case 'GET /org/applications': {
            only('org');
            const ap = await m.getDocs(m.query(col('applications'), m.where('orgId', '==', user.id)));
            return rows(ap).sort((x, y) => String(y.created).localeCompare(String(x.created)));
        }
        case 'PATCH /applications/:id': {
            only('org');
            if (!['applied', 'reviewing', 'interview', 'accepted', 'rejected'].includes(b.status)) {
                bad('Bad status');
            }
            const as = await m.getDoc(ref('applications', id));
            if (!as.exists() || as.data().orgId !== user.id) {
                bad('Not found');
            }
            await m.updateDoc(ref('applications', id), { status: b.status });
            return { ok: 1 };
        }
        case 'DELETE /listings/:id': {
            only('org', 'moderator', 'admin');
            const ls = await m.getDoc(ref('listings', id));
            if (!ls.exists() || (user.role === 'org' && ls.data().orgId !== user.id)) {
                bad('Not found');
            }
            // An organization may only query its own applications; staff may query by listing.
            const ap = user.role === 'org' ? await m.getDocs(m.query(col('applications'), m.where('orgId', '==', user.id))) : await m.getDocs(m.query(col('applications'), m.where('listingId', '==', id)));
            await dropApps(rows(ap).filter(x => x.listingId === id));
            await m.deleteDoc(ref('listings', id));
            return { ok: 1 };
        }

        case 'GET /admin/data': {
            only('admin', 'moderator');
            const [us, ls, ap, rp] = await Promise.all([m.getDocs(col('users')), m.getDocs(col('listings')), m.getDocs(col('applications')), m.getDocs(m.query(col('reports'), m.where('status', '==', 'open'))).catch(e => ({ docs: [], failed: e.code || e.message || 'error' }))]);
            const users = rows(us);
            let apps = rows(ap);
            let cleaned = 0;
            // Retention housekeeping: admins' dashboard loads remove expired applications (at most once an hour).
            if (user.role === 'admin' && Date.now() - sweep.t > 3600e3) {
                sweep.t = Date.now();
                try {
                    const stale = rows(ls).filter(l => isExpired(l));
                    for (const l of stale) {
                        await m.updateDoc(ref('listings', l.id), { status: 'closed', closedAt: now() });
                        l.status = 'closed';
                        l.closedAt = now();
                    }
                    const old = expiredApps(apps, rows(ls));
                    await dropApps(old);
                    const gone = new Set(old.map(a => a.id));
                    apps = apps.filter(a => !gone.has(a.id));
                    cleaned = old.length;
                } catch (e) {
                    console.warn('Retention cleanup skipped:', e.code || e.message);
                }
            }
            const d = adminData(users, rows(ls), apps);
            d.cleaned = cleaned;
            d.reportsError = rp.failed || ''; // shown on the Reports tab, so a rules problem is not mistaken for "no reports"
            d.reports = rows(rp).slice(0, 500).map(({ id: _i, userId: _u, ...r }) => r); // (who reported is kept out of the dashboard)
            if (user.role !== 'admin') {
                return d; // moderators do not see the Team tab
            }
            try {
                const staff = await staffMap();
                const mains = ADMIN_EMAILS.map(lc);
                const team = users.map(u => ({
                    id: u.id, name: u.name, email: u.email, kind: u.role === 'org' ? 'Organization' : 'Candidate', staff: isMain(u.email) ? 'admin' : staff[lc(u.email)] || null, permanent: isMain(u.email), created: u.created
                }));
                for (const e of mains) { // the main admin always appears, even before the first sign-in
                    if (!team.some(r => lc(r.email) === e)) {
                        team.push({ id: 'main:' + e, name: 'Main admin', email: e, kind: 'Candidate', staff: 'admin', permanent: true, created: '' });
                    }
                }
                d.team = team.sort((a, c) => (c.permanent - a.permanent) || ((c.staff === 'admin') - (a.staff === 'admin')) || ((!!c.staff) - (!!a.staff)) || String(a.name).localeCompare(String(c.name)));
                const known = new Set(team.map(r => lc(r.email)));
                d.invites = Object.entries(staff).filter(([e]) => !known.has(e)).map(([email, role]) => ({ email, role, at: '' }));
            } catch (e) {
                d.teamError = friendly(e).message;
            }
            return d;
        }
        case 'POST /admin/cleanup': {
            only('admin');
            await run('/admin/expire', 'POST', {}, fu);
            const [ls, ap] = await Promise.all([m.getDocs(col('listings')), m.getDocs(col('applications'))]);
            const old = expiredApps(rows(ap), rows(ls));
            await dropApps(old);
            sweep.t = Date.now();
            return { removed: old.length };
        }
        case 'PATCH /admin/staff/:id': {
            only('admin');
            const email = lc(b.email);
            if (!email) {
                bad('Missing email');
            }
            if (isMain(email)) {
                bad('The main admin is permanent and cannot be changed');
            }
            if (id === user.id || email === lc(user.email)) {
                bad("You can't change your own role");
            }
            if (!['admin', 'moderator', 'none'].includes(b.role)) {
                bad('Bad role');
            }
            await setStaff(email, b.role, user.email);
            return { ok: 1 };
        }
        case 'POST /admin/staff-invite': {
            only('admin');
            const email = lc(b.email);
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                bad('Enter a valid email address');
            }
            if (!['admin', 'moderator'].includes(b.role)) {
                bad('Choose Admin or Moderator');
            }
            if (isMain(email)) {
                bad('That account is already a permanent admin');
            }
            await setStaff(email, b.role, user.email);
            return { ok: 1, applied: true };
        }
        case 'POST /admin/staff-invite/revoke':
            only('admin');
            await setStaff(b.email, 'none', user.email);
            return { ok: 1 };
        case 'PATCH /admin/orgs/:id': {
            only('admin');
            const u = await loadUser(id);
            if (!u || u.role !== 'org') {
                bad('Organization not found');
            }
            const f = {};
            if ('orgType' in b) {
                if (!ORG_TYPES.includes(b.orgType)) {
                    bad('Bad organization type');
                }
                f.orgType = b.orgType;
            }
            if ('gmailOk' in b) {
                if (b.gmailOk === null) {
                    f.gmailOk = m.deleteField();
                } else if (typeof b.gmailOk === 'boolean') {
                    f.gmailOk = b.gmailOk;
                } else {
                    bad('Bad value');
                }
            }
            if (Object.keys(f).length) {
                await m.updateDoc(ref('users', id), f);
            }
            return { ok: 1 };
        }
        case 'POST /admin/import': { // staff load listings found by scripts/import-jobs.js; each is scored and sorted into publish / review / skipped
            only('admin', 'moderator');
            const items = Array.isArray(b.items) ? b.items.slice(0, 100) : [];
            const out = { published: 0, review: 0, skipped: 0, duplicates: 0, invalid: 0 };
            const bt = m.writeBatch(db);
            const seen = new Set();
            for (const it of items) {
                const l = cleanImport(it);
                if (!l) {
                    out.invalid++;
                    continue;
                }
                const lid = 'imp_' + hash(l.applyUrl);
                if (seen.has(lid) || (await m.getDoc(ref('listings', lid))).exists()) {
                    out.duplicates++;
                    continue;
                }
                seen.add(lid);
                const t = trustScore(l);
                const st = decide(t);
                if (st === 'hidden') {
                    out.skipped++;
                    continue;
                }
                bt.set(ref('listings', lid), { ...l, trust: t.score, trustReasons: t.reasons, status: st, created: now() });
                st === 'approved' ? out.published++ : out.review++;
            }
            await bt.commit();
            return out;
        }
        case 'POST /analytics': { // daily counters only; no id of the person or the listing is stored
            const c = cleanCounts(b || {});
            if (!Object.keys(c).length) {
                return { ok: 1 };
            }
            const f = {};
            for (const [k, v] of Object.entries(c)) {
                f[k] = typeof v === 'number' ? m.increment(v) : Object.fromEntries(Object.entries(v).map(([w, x]) => [w, m.increment(x)]));
            }
            await m.setDoc(ref('analytics', now().slice(0, 10)), f, { merge: true });
            return { ok: 1 };
        }
        case 'GET /admin/insights': {
            only('admin', 'moderator');
            const [as, ls, ap] = await Promise.all([m.getDocs(col('analytics')), m.getDocs(col('listings')), m.getDocs(col('applications'))]);
            return { analytics: rows(as), listings: rows(ls).map(l => ({ id: l.id, title: l.title, description: String(l.description || '').slice(0, 1500), status: l.status })), applicationDates: rows(ap).map(a => a.created) };
        }
        case 'POST /admin/expire': {
            only('admin', 'moderator');
            const ls = await m.getDocs(m.query(col('listings'), m.where('status', '==', 'approved')));
            const old = rows(ls).filter(l => isExpired(l));
            for (let i = 0; i < old.length; i += 400) {
                const bt = m.writeBatch(db);
                old.slice(i, i + 400).forEach(l => bt.update(ref('listings', l.id), { status: 'closed', closedAt: now() }));
                await bt.commit();
            }
            memo.listings = null;
            return { closed: old.length };
        }
        case 'PATCH /admin/listings/:id': {
            only('admin', 'moderator');
            if (!['approved', 'rejected', 'pending'].includes(b.status)) {
                bad('Bad status');
            }
            const ls = await m.getDoc(ref('listings', id));
            if (!ls.exists()) {
                bad('Not found');
            }
            await m.updateDoc(ref('listings', id), { status: b.status });
            return { ok: 1 };
        }
        case 'PATCH /admin/users/:id': {
            only('admin', 'moderator');
            const u = await loadUser(id);
            if (!u) {
                bad('Not found');
            }
            await m.updateDoc(ref('users', id), { verified: !!b.verified });
            if (u.role === 'org' && !b.verified) {
                await hideOrgListings(id);
            }
            return { ok: 1 };
        }
        case 'DELETE /admin/users/:id': {
            only('admin');
            if (id === user.id) {
                bad("You can't delete yourself");
            }
            const u = await loadUser(id);
            if (!u) {
                bad('Not found');
            }
            // Remove everything that belongs to the account. (The sign-in itself stays in Firebase Authentication; delete it in the console if needed.)
            await purge(u);
            return { ok: 1 };
        }
    }
    bad('Not found');
}
