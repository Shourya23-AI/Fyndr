const { R, bad, need } = require('../lib/router');
const { db, save } = require('../db/store');
const { uid, gmailAllowed } = require('../lib/helpers');
const scoreListing = require('../lib/trust');
// Organization: post listings, see own listings and applicants.
R('POST', '/api/listings', ['org'], async ({ user, body: b }) => {
    if (!user.verified) {
        bad(403, 'Your organization must be verified before posting', 'NOT_VERIFIED');
    }
    if (!gmailAllowed(user)) {
        bad(403, 'Posting with a Gmail or other free email is not enabled for your organization. Use a work email, or ask Fyndr admin to allow it.', 'FREE_EMAIL');
    }
    if (!user.phone) {
        bad(403, 'Verify your phone number before posting', 'PHONE_REQUIRED');
    }
    need(b, 'title', 'type', 'location', 'pay');
    if (!['Job', 'Internship', 'Course'].includes(b.type)) {
        bad(400, 'Invalid type');
    }
    // Cover image + logo arrive as small data URLs (the browser shrinks them first).
    const IMG = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
    if (typeof b.image !== 'string' || b.image.length > 150000 || !IMG.test(b.image)) {
        bad(400, 'Add a cover image for your listing (JPG, PNG or WebP)');
    }
    if (b.logo && (typeof b.logo !== 'string' || b.logo.length > 40000 || !IMG.test(b.logo))) {
        bad(400, 'That logo could not be used. Try another image.');
    }
    const row = {
        id: uid(), orgId: user.id, orgName: user.orgName, title: b.title.trim(), type: b.type, location: b.location.trim(), pay: b.pay.trim(), duration: String(b.duration || '').trim().slice(0, 40), description: (b.description || '').trim(), image: b.image, logo: b.logo || '', status: 'pending', created: new Date().toISOString()
    };
    // Automatic verification: every posting gets a legitimacy rating (0-100) the moment it is posted. An admin still approves it by hand.
    Object.assign(row, await scoreListing(row));
    db.listings.push(row);
    save();
    return { ok: 1 };
});
R('GET', '/api/org/listings', ['org'], ({ user }) => db.listings.filter(l => l.orgId === user.id).map(l => ({ ...l, applicants: db.applications.filter(a => a.listingId === l.id).length })));
R('GET', '/api/org/applications', ['org'], ({ user }) => {
    const mine = db.listings.filter(l => l.orgId === user.id);
    return db.applications.filter(a => mine.some(l => l.id === a.listingId)).map(a => {
        const u = db.users.find(x => x.id === a.userId) || {};
        return {
            ...a, title: mine.find(l => l.id === a.listingId).title, name: u.name, email: u.email
        };
    });
});
// Org opens the resume an applicant chose: their own PDF, or the profile data the website resume is built from.
R('GET', '/api/org/applications/:id/resume', ['org'], ({ user, p }) => {
    const a = db.applications.find(x => x.id === p[0]);
    const l = a && db.listings.find(x => x.id === a.listingId);
    if (!l || l.orgId !== user.id) {
        bad(404, 'Not found');
    }
    const u = db.users.find(x => x.id === a.userId);
    if (!u) {
        bad(404, 'Candidate not found');
    }
    if (a.resumeType === 'own' && u.resume) {
        const f = require('path').join(require('../config').UP_DIR, u.id + '.pdf');
        try {
            return {
                type: 'own', mime: 'application/pdf', data: require('fs').readFileSync(f).toString('base64')
            };
        } catch {
            bad(404, 'Resume file missing');
        }
    }
    return {
        type: 'site', name: u.name, email: u.email, phone: u.phone || null, photo: u.photo || null, profile: u.profile || {}
    };
});
R('PATCH', '/api/applications/:id', ['org'], ({ user, p, body: b }) => {
    const a = db.applications.find(x => x.id === p[0]);
    const l = a && db.listings.find(x => x.id === a.listingId);
    if (!l || l.orgId !== user.id) {
        bad(404, 'Not found');
    }
    if (!['applied', 'reviewing', 'interview', 'accepted', 'rejected'].includes(b.status)) {
        bad(400, 'Bad status');
    }
    a.status = b.status;
    save();
    return { ok: 1 };
});
R('DELETE', '/api/listings/:id', ['org', 'moderator', 'admin'], ({ user, p }) => {
    const l = db.listings.find(x => x.id === p[0]);
    if (!l || (user.role === 'org' && l.orgId !== user.id)) {
        bad(404, 'Not found');
    }
    db.listings = db.listings.filter(x => x !== l);
    db.applications = db.applications.filter(a => a.listingId !== l.id);
    save();
    return { ok: 1 };
});
