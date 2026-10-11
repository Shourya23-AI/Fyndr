import { ADMIN_EMAILS } from './config.js';
import { db, bad } from './store.js';
// Small pure helpers shared by the local API routes.
export const QUAL = ['High School', 'Diploma', "Bachelor's", "Master's", 'PhD', 'Other'];
export const EXP = ['Student / Fresher', '0–1 years', '1–3 years', '3–5 years', '5+ years'];
export const JT = ['Job', 'Internship', 'Freelance', 'Course'];
export const pub = u => ({
    id: u.id, name: u.name, email: u.email, role: u.role, orgName: u.orgName, verified: u.verified, phoneVerified: !!u.phone, created: u.created, photo: u.photo || undefined
});
export const completion = u => {
    const p = u.profile || {};
    return Math.round([p.qualification, p.field, p.institution, p.gradYear, p.skills?.length, p.experience, p.jobTypes?.length, p.locations, u.resume].filter(Boolean).length / 9 * 100);
};
export const meOf = u => ({
    ...pub(u), permanent: ADMIN_EMAILS.some(e => e.toLowerCase() === (u.email || '').toLowerCase()) || undefined, proofStatus: u.proof?.status, portal: u.proof?.portal, phoneMasked: u.phone ? u.phone.replace(/\d(?=\d{4})/g, '•') : undefined, ...(u.role === 'user' ? {
        hasResume: !!u.resume, onboarded: !!u.profile?.done, completion: completion(u)
    } : {}), ...(u.role === 'org' ? { orgType: u.orgType || 'small', gmailBlocked: !gmailAllowed(u) } : {})
});
// Optional resume fields from the profile form. Anything empty is dropped so the resume can leave that section out.
export const T = (v, n) => String(v || '').trim().slice(0, n);
export const arr = v => Array.isArray(v) ? v : [];
export const LV = n => {
    n = Math.round(+n);
    return n >= 1 && n <= 5 ? n : 3;
};
export const cleanExtras = (b, skills) => {
    const sl = b.skillLevels && typeof b.skillLevels === 'object' ? b.skillLevels : {};
    const r = b.reference && typeof b.reference === 'object' ? b.reference : {};
    return {
        address: T(b.address, 150), linkedin: T(b.linkedin, 200), twitter: T(b.twitter, 200),
        hobbies: [...new Set(arr(b.hobbies).map(x => T(x, 30)).filter(Boolean))].slice(0, 12),
        skillLevels: Object.fromEntries(skills.map(s => [s, LV(sl[s])])),
        reference: {
            name: T(r.name, 60), role: T(r.role, 100), phone: T(r.phone, 30), email: T(r.email, 80)
        },
        jobs: arr(b.jobs).map(j => ({
            role: T(j?.role, 80), org: T(j?.org, 80), place: T(j?.place, 60), from: T(j?.from, 20), to: T(j?.to, 20), points: T(j?.points, 600)
        })).filter(j => j.role || j.org).slice(0, 10),
        education: arr(b.education).map(e => ({
            degree: T(e?.degree, 80), institution: T(e?.institution, 100), place: T(e?.place, 60), year: T(e?.year, 20), points: T(e?.points, 400)
        })).filter(e => e.degree || e.institution).slice(0, 6),
        languages: arr(b.languages).map(l => ({ name: T(l?.name, 30), level: LV(l?.level) })).filter(l => l.name).slice(0, 8)
    };
};
export const need = (b, ...k) => k.forEach(x => {
    if (!String(b[x] || '').trim()) {
        bad(x + ' is required');
    }
});
export function listings(q) {
    const s = (q.get('q') || '').toLowerCase();
    const t = q.get('type');
    const l = (q.get('loc') || '').toLowerCase();
    const org = Object.fromEntries(db.users.filter(u => u.role === 'org').map(u => [u.id, u.verified]));
    return db.listings.filter(x => x.status === 'approved' && (!t || t.split(',').includes(x.type)) && (!s || (x.title + x.orgName + x.description).toLowerCase().includes(s)) && (!l || x.location.toLowerCase().includes(l)))
        .sort((a, b) => b.created.localeCompare(a.created)).map(x => ({ ...x, orgVerified: !!org[x.orgId] }));
}
export const FREE = /@(gmail|yahoo|outlook|hotmail|proton|protonmail|icloud|aol)\./i;
export const ORG_TYPES = ['small', 'enterprise'];
// Small businesses may use Gmail etc.; enterprises may not. An admin can override either way per organization (u.gmailOk true/false).
export const isFree = e => FREE.test(e || '');
export const gmailAllowed = u => !isFree(u.email) || (typeof u.gmailOk === 'boolean' ? u.gmailOk : (u.orgType || 'small') === 'small');
export const signals = u => {
    const h = (() => {
        try {
            return new URL(u.proof.portal).hostname.replace(/^www\./, '');
        } catch {
            return '';
        }
    })();
    const ed = (u.email.split('@')[1] || '').toLowerCase();
    const tok = (u.orgName || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);
    return {
        https: (u.proof.portal || '').startsWith('https://'), workEmail: !FREE.test(u.email), emailMatchesSite: !!h && (ed === h || ed.endsWith('.' + h) || h.endsWith('.' + ed)), nameInSite: !!tok && h.replace(/[^a-z0-9]/g, '').includes(tok)
    };
};
export const adminData = db => {
    const orgs = db.users.filter(u => u.role === 'org');
    const cands = db.users.filter(u => u.role === 'user');
    const proofs = db.users.filter(u => u.proof);
    return {
        stats: {
            candidates: cands.length, organizations: orgs.length, listings: db.listings.length, pendingListings: db.listings.filter(l => l.status === 'pending').length, pendingVerifications: proofs.filter(u => u.proof.status === 'pending').length, applications: db.applications.length
        },
        orgs: orgs.map(u => ({
            id: u.id, orgName: u.orgName, name: u.name, email: u.email, website: u.website || '', orgType: u.orgType || 'small', free: isFree(u.email), gmailOk: typeof u.gmailOk === 'boolean' ? u.gmailOk : null, gmailAllowed: gmailAllowed(u), verified: !!u.verified, proofStatus: u.proof?.status || null, listings: db.listings.filter(l => l.orgId === u.id).length, phoneVerified: !!u.phone, created: u.created
        })),
        candidates: cands.map(u => ({
            id: u.id, name: u.name, email: u.email, phoneVerified: !!u.phone, completion: completion(u), applications: db.applications.filter(a => a.userId === u.id).length, created: u.created
        })),
        listings: db.listings,
        proofs: proofs.map(u => ({
            id: u.id, name: u.orgName || u.name, email: u.email, role: u.role, portal: u.proof.portal, status: u.proof.status, signals: u.role === 'org' ? signals(u) : null
        }))
    };
};
