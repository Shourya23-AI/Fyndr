import { ADMIN_EMAILS } from './config.js';
import { POLICY_VERSION } from '../../features/legal/constants.js';
// Small pure helpers shared by the Firestore API routes (no database access in here).
export const uid = () => Math.random().toString(36).slice(2, 14);
export const now = () => new Date().toISOString();
export const lc = e => String(e || '').trim().toLowerCase();
export const bad = (m, code) => {
    throw Object.assign(new Error(m), { code });
};
export const isMain = e => ADMIN_EMAILS.map(lc).includes(lc(e));
export const QUAL = ['High School', 'Diploma', "Bachelor's", "Master's", 'PhD', 'Other'];
export const EXP = ['Student / Fresher', '0–1 years', '1–3 years', '3–5 years', '5+ years'];
export const JT = ['Job', 'Internship', 'Freelance', 'Course'];
export const ORG_TYPES = ['small', 'enterprise'];
export const FREE = /@(gmail|yahoo|outlook|hotmail|proton|protonmail|icloud|aol)\./i;
// Small businesses may use Gmail etc.; enterprises may not. An admin can override either way per organization (u.gmailOk true/false).
export const isFree = e => FREE.test(e || '');
export const gmailAllowed = u => !isFree(u.email) || (typeof u.gmailOk === 'boolean' ? u.gmailOk : (u.orgType || 'small') === 'small');

// u.role here is the EFFECTIVE role (admin / moderator / org / user).
export const pub = u => ({
    id: u.id, name: u.name, email: u.email, role: u.role, orgName: u.orgName, verified: u.role === 'org' ? !!u.verified : true, phoneVerified: !!u.phone, created: u.created, photo: u.photo || undefined
});
export const completion = u => {
    const p = u.profile || {};
    return Math.round([p.qualification, p.field, p.institution, p.gradYear, p.skills?.length, p.experience, p.jobTypes?.length, p.locations, u.resume].filter(Boolean).length / 9 * 100);
};
export const meOf = u => ({
    ...pub(u), permanent: isMain(u.email) || undefined, proofStatus: u.proof?.status, portal: u.proof?.portal, consentAt: u.consent?.at, needsConsent: u.consent?.v !== POLICY_VERSION, phoneMasked: u.phone ? u.phone.replace(/\d(?=\d{4})/g, '•') : undefined, ...(u.role === 'user' ? {
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

// Listing images are stored inside the listing document as small data URLs (no paid file storage needed).
export const IMG_MAX = { image: 150000, logo: 40000 };
export const IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
export const imgOk = (s, max) => typeof s === 'string' && s.length <= max && IMG_RE.test(s);

export function filterListings(rows, q) {
    const s = (q.get('q') || '').toLowerCase();
    const t = q.get('type');
    const l = (q.get('loc') || '').toLowerCase();
    return rows.filter(x => (!t || t.split(',').includes(x.type)) && (!s || (x.title + ' ' + x.orgName + ' ' + (x.description || '')).toLowerCase().includes(s)) && (!l || String(x.location || '').toLowerCase().includes(l)))
        .sort((a, b) => String(b.created).localeCompare(String(a.created)));
}

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
export const adminData = (users, lists, apps) => {
    const orgs = users.filter(u => u.role === 'org');
    const cands = users.filter(u => u.role === 'user');
    const proofs = users.filter(u => u.proof);
    return {
        stats: {
            candidates: cands.length, organizations: orgs.length, listings: lists.length, pendingListings: lists.filter(l => l.status === 'pending').length, pendingVerifications: proofs.filter(u => u.proof.status === 'pending').length, applications: apps.length
        },
        orgs: orgs.map(u => ({
            id: u.id, orgName: u.orgName, name: u.name, email: u.email, website: u.website || '', orgType: u.orgType || 'small', free: isFree(u.email), gmailOk: typeof u.gmailOk === 'boolean' ? u.gmailOk : null, gmailAllowed: gmailAllowed(u), verified: !!u.verified, proofStatus: u.proof?.status || null, listings: lists.filter(l => l.orgId === u.id).length, phoneVerified: !!u.phone, created: u.created
        })),
        candidates: cands.map(u => ({
            id: u.id, name: u.name, email: u.email, phoneVerified: !!u.phone, completion: completion(u), applications: apps.filter(a => a.userId === u.id).length, created: u.created
        })),
        listings: lists.sort((a, b) => String(b.created).localeCompare(String(a.created))),
        proofs: proofs.map(u => ({
            id: u.id, name: u.orgName || u.name, email: u.email, role: u.role, portal: u.proof.portal, status: u.proof.status, signals: u.role === 'org' ? signals(u) : null
        }))
    };
};

// The application form (apply page). Returns null when a required field is missing. Everything is trimmed and length-limited.
export const cleanForm = f => {
    if (!f || typeof f !== 'object') {
        return null;
    }
    const url = v => {
        const t = T(v, 200);
        return !t || /^https?:\/\/[^\s]+$/i.test(t) ? t : null;
    };
    const out = {
        fullName: T(f.fullName, 80), email: T(f.email, 100), phone: T(f.phone, 30), city: T(f.city, 80), education: T(f.education, 200),
        skills: [...new Map(arr(f.skills).map(x => T(x, 30)).filter(Boolean).map(x => [x.toLowerCase(), x])).values()].slice(0, 20), experience: T(f.experience, 40),
        linkedin: url(f.linkedin), portfolio: url(f.portfolio), note: T(f.note, 1500)
    };
    if (out.linkedin === null || out.portfolio === null || !out.fullName || !out.phone || !out.city || !out.note) {
        return null;
    }
    return out;
};
// A listing found by scripts/import-jobs.js. Only https apply links are accepted; the fields are cut to the same limits as posted listings.
export const hash = s => {
    let h = 5381;
    for (const c of String(s)) {
        h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
    }
    return h.toString(36) + String(s).length.toString(36);
};
export const cleanImport = it => {
    if (!it || typeof it !== 'object') {
        return null;
    }
    const applyUrl = T(it.applyUrl, 500);
    if (!/^https:\/\/[^\s]+\.[^\s]+$/i.test(applyUrl) || !T(it.title, 120) || !T(it.orgName, 80)) {
        return null;
    }
    return {
        orgId: 'import', orgName: T(it.orgName, 80), title: T(it.title, 120), type: JT.includes(it.type) && it.type !== 'Freelance' ? it.type : 'Job',
        location: T(it.location, 120) || 'See listing', pay: T(it.pay, 80) || 'See listing', duration: T(it.duration, 40), description: T(it.description, 4000),
        image: '', logo: '', applyUrl, source: 'import', origin: T(it.source, 20) || 'page'
    };
};
