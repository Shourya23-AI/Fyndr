const { R, bad, need } = require('../lib/router');
const { db, save } = require('../db/store');
const { adminData, ORG_TYPES, applyStaff, staffLevel } = require('../lib/helpers');
const { isAdminEmail, UP_DIR } = require('../config');
const fs = require('fs');
const path = require('path');
// Staff: moderators review proofs, listings and verification; admins can also change organization settings, delete accounts and manage the team.
const MOD = ['admin', 'moderator'];
// When an organization stops being verified, its live listings go back to 'pending' so nothing unverified stays public.
const hideListings = orgId => {
    for (const l of db.listings) {
        if (l.orgId === orgId && l.status === 'approved') {
            l.status = 'pending';
        }
    }
};
const rmFile = f => {
    try {
        fs.unlinkSync(path.join(UP_DIR, f));
    } catch { }
};
R('PATCH', '/api/admin/proof/:id', MOD, ({ p, body: b }) => {
    const u = db.users.find(x => x.id === p[0]);
    if (!u?.proof) {
        bad(404, 'Not found');
    }
    if (!['verified', 'rejected'].includes(b.status)) {
        bad(400, 'Bad status');
    }
    u.proof.status = b.status;
    if (u.role === 'org') {
        u.verified = b.status === 'verified';
        if (!u.verified) {
            hideListings(u.id);
        }
    }
    save();
    return { ok: 1 };
});
R('GET', '/api/admin/data', MOD, () => adminData(db));
// Admin: change an organization's size and/or whether it may post with a Gmail-type address (true / false / null = default by size).
R('PATCH', '/api/admin/orgs/:id', ['admin'], ({ p, body: b }) => {
    const u = db.users.find(x => x.id === p[0] && x.role === 'org');
    if (!u) {
        bad(404, 'Organization not found');
    }
    if ('orgType' in b) {
        if (!ORG_TYPES.includes(b.orgType)) {
            bad(400, 'Bad organization type');
        }
        u.orgType = b.orgType;
    }
    if ('gmailOk' in b) {
        if (b.gmailOk === null) {
            delete u.gmailOk;
        } else if (typeof b.gmailOk === 'boolean') {
            u.gmailOk = b.gmailOk;
        } else {
            bad(400, 'Bad value');
        }
    }
    save();
    return { ok: 1 };
});
R('PATCH', '/api/admin/listings/:id', MOD, ({ p, body: b }) => {
    const l = db.listings.find(x => x.id === p[0]);
    if (!l) {
        bad(404, 'Not found');
    }
    if (!['approved', 'rejected', 'pending'].includes(b.status)) {
        bad(400, 'Bad status');
    }
    l.status = b.status;
    save();
    return { ok: 1 };
});
R('PATCH', '/api/admin/users/:id', MOD, ({ p, body: b }) => {
    const u = db.users.find(x => x.id === p[0]);
    if (!u) {
        bad(404, 'Not found');
    }
    u.verified = !!b.verified;
    if (!u.verified && u.role === 'org') {
        hideListings(u.id);
    }
    save();
    return { ok: 1 };
});
R('DELETE', '/api/admin/users/:id', ['admin'], ({ user, p }) => {
    if (p[0] === user.id) {
        bad(400, "You can't delete yourself");
    }
    const target = db.users.find(u => u.id === p[0]);
    if (target && isAdminEmail(target.email)) {
        bad(400, 'The main admin is permanent and cannot be deleted', 'PERMANENT');
    }
    db.users = db.users.filter(u => u.id !== p[0]);
    db.listings = db.listings.filter(l => l.orgId !== p[0]);
    db.applications = db.applications.filter(a => a.userId !== p[0] && db.listings.some(l => l.id === a.listingId));
    db.saved = (db.saved || []).filter(x => x.userId !== p[0] && db.listings.some(l => l.id === x.listingId));
    rmFile(p[0] + '.pdf'); // resume, ID/proof document: personal files must not outlive the account
    rmFile('proof-' + p[0]);
    save();
    return { ok: 1 };
});
// Team management (admins only): make someone a moderator or admin, or take it away.
// body.role: 'admin' | 'moderator' | 'none'. The main admin is permanent: nobody (not even another admin) can change or remove it.
R('PATCH', '/api/admin/staff/:id', ['admin'], ({ user, p, body: b }) => {
    const u = db.users.find(x => x.id === p[0]);
    if (!u) {
        bad(404, 'Account not found');
    }
    if (isAdminEmail(u.email)) {
        bad(400, 'The main admin is permanent and cannot be changed', 'PERMANENT');
    }
    if (u.id === user.id) {
        bad(400, "You can't change your own role");
    }
    if (!['admin', 'moderator', 'none'].includes(b.role)) {
        bad(400, 'Bad role');
    }
    if (b.role === 'none') {
        delete u.staff;
    } else {
        u.staff = b.role;
    }
    applyStaff(u);
    save();
    return { ok: 1, staff: staffLevel(u) };
});
// Give a role to an email address, even if that person has not signed up yet. It is applied as soon as they sign up and confirm the email.
R('POST', '/api/admin/staff-invite', ['admin'], ({ user, body: b }) => {
    const email = String(b.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
        bad(400, 'Enter a valid email address');
    }
    if (!['admin', 'moderator'].includes(b.role)) {
        bad(400, 'Choose Admin or Moderator');
    }
    if (isAdminEmail(email)) {
        bad(400, 'That account is already a permanent admin', 'PERMANENT');
    }
    const existing = db.users.find(u => (u.email || '').toLowerCase() === email);
    if (existing) {
        existing.staff = b.role;
        applyStaff(existing);
        save();
        return { ok: 1, applied: true };
    }
    db.staffInvites = (db.staffInvites || []).filter(i => i.email !== email);
    db.staffInvites.push({ email, role: b.role, by: user.email, at: new Date().toISOString() });
    save();
    return { ok: 1, applied: false };
});
R('POST', '/api/admin/staff-invite/revoke', ['admin'], ({ body: b }) => {
    db.staffInvites = (db.staffInvites || []).filter(i => i.email !== String(b.email || '').toLowerCase());
    save();
    return { ok: 1 };
});
