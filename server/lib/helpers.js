const crypto = require('crypto');
const { isAdminEmail } = require('../config');
// Shared constants and pure helpers used by several route files.
const uid = () => crypto.randomBytes(6).toString('hex');
// Staff levels. u.role is the *effective* role used by every route ('user' | 'org' | 'moderator' | 'admin').
// u.staff is what an admin granted ('admin' | 'moderator'); u.baseRole remembers the account type underneath so a demoted
// person goes back to being a candidate / organization. The built-in main admin (admin.fyndr@gmail.com) is permanent.
const staffLevel = u => isAdminEmail(u.email) ? 'admin' : (u.staff === 'admin' || u.staff === 'moderator') ? u.staff : null;
const baseKind = u => (u.role === 'admin' || u.role === 'moderator') ? (u.baseRole || 'user') : u.role;
// Brings u.role in line with staffLevel(u). Returns true when something changed (caller saves).
const applyStaff = u => {
    const want = staffLevel(u);
    if (want) {
        if (u.role !== 'admin' && u.role !== 'moderator') {
            u.baseRole = u.role;
        }
        if (u.role !== want) {
            u.role = want;
            return true;
        }
        return false;
    }
    if (u.role === 'admin' || u.role === 'moderator') {
        u.role = u.baseRole || 'user';
        delete u.baseRole;
        return true;
    }
    return false;
};
const isStaff = u => u.role === 'admin' || u.role === 'moderator';
const pub = u => ({
    id: u.id, name: u.name, email: u.email, role: u.role, orgName: u.orgName, verified: u.verified, phoneVerified: !!u.phone, created: u.created, photo: u.photo || undefined, permanent: isAdminEmail(u.email) || undefined
});
const QUAL = ['High School', 'Diploma', "Bachelor's", "Master's", 'PhD', 'Other'];
const EXP = ['Student / Fresher', '0–1 years', '1–3 years', '3–5 years', '5+ years'];
const JT = ['Job', 'Internship', 'Freelance', 'Course'];
const completion = u => {
    const p = u.profile || {};
    return Math.round([p.qualification, p.field, p.institution, p.gradYear, p.skills?.length, p.experience, p.jobTypes?.length, p.locations, u.resume].filter(Boolean).length / 9 * 100);
};
const meOf = u => ({
    ...pub(u), proofStatus: u.proof?.status, portal: u.proof?.portal, phoneMasked: u.phone ? u.phone.replace(/\d(?=\d{4})/g, '•') : undefined, ...(u.role === 'user' ? {
        hasResume: !!u.resume, onboarded: !!u.profile?.done, completion: completion(u)
    } : {}), ...(u.role === 'org' ? { orgType: u.orgType || 'small', gmailBlocked: !gmailAllowed(u) } : {})
});
// Optional resume fields from the profile form. Anything empty is dropped so the resume can leave that section out.
const T = (v, n) => String(v || '').trim().slice(0, n);
const arr = v => Array.isArray(v) ? v : [];
const LV = n => {
    n = Math.round(+n);
    return n >= 1 && n <= 5 ? n : 3;
};
const cleanExtras = (b, skills) => {
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
const FREE = /@(gmail|yahoo|outlook|hotmail|proton|protonmail|icloud|aol)\./i;
const ORG_TYPES = ['small', 'enterprise'];
// Small businesses may use Gmail etc.; enterprises may not. An admin can override either way per organization (u.gmailOk true/false).
const isFree = e => FREE.test(e || '');
const gmailAllowed = u => !isFree(u.email) || (typeof u.gmailOk === 'boolean' ? u.gmailOk : (u.orgType || 'small') === 'small');
const sniff = b => b.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf' : (b[0] === 0xFF && b[1] === 0xD8) ? 'image/jpeg' : (b[0] === 0x89 && b.subarray(1, 4).toString() === 'PNG') ? 'image/png' : (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') ? 'image/webp' : null;
const signals = u => {
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
const adminData = db => {
    const orgs = db.users.filter(u => baseKind(u) === 'org');
    const cands = db.users.filter(u => baseKind(u) === 'user' && !isAdminEmail(u.email));
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
        team: db.users.filter(u => u.email).map(u => ({
            id: u.id, name: u.name, email: u.email, kind: baseKind(u) === 'org' ? 'Organization' : 'Candidate', staff: staffLevel(u), permanent: isAdminEmail(u.email), created: u.created
        })).sort((a, b) => (b.permanent - a.permanent) || ((b.staff === 'admin') - (a.staff === 'admin')) || ((!!b.staff) - (!!a.staff)) || a.name.localeCompare(b.name)),
        invites: (db.staffInvites || []).map(i => ({ email: i.email, role: i.role, at: i.at })),
        proofs: proofs.map(u => ({
            id: u.id, name: u.orgName || u.name, email: u.email, role: u.role, portal: u.proof.portal, status: u.proof.status, signals: u.role === 'org' ? signals(u) : null
        }))
    };
};
module.exports = {
    staffLevel, baseKind, applyStaff, isStaff, ORG_TYPES, isFree, gmailAllowed, adminData, uid, pub, QUAL, EXP, JT, completion, cleanExtras, meOf, FREE, sniff, signals
};
