// Daily housekeeping that must not depend on an admin opening the dashboard:
//   1. listings that outlived their life (45 days imported / 90 days posted) are closed, so candidates never see them;
//   2. applications older than the retention limit, or whose listing closed long ago, are deleted together with the resume copy
//      shared with the organization (the Privacy Policy promises this; the numbers come from public/js/features/privacy/retention.js).
// Run by .github/workflows/sweep.yml with the same FIREBASE_SERVICE_ACCOUNT secret as the importer.   node scripts/sweep-firestore.js
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const load = rel => import(pathToFileURL(path.join(__dirname, '..', 'public', 'js', rel)).href);
const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data(), _ref: d.ref }));

// `db` is a firebase-admin Firestore (or anything with the same collection().where().get() / batch() shape, which the tests use).
async function sweep(db, now = Date.now()) {
    const { isExpired } = await load('features/listings/expiry.js');
    const { expiredApps } = await load('services/firestore-api/retention.js');
    const { RETENTION } = await load('features/privacy/retention.js');
    const DAY = 864e5;
    const result = { closed: 0, applications: 0, files: 0 };

    // 1. close expired listings
    const live = rows(await db.collection('listings').where('status', '==', 'approved').get());
    const stale = live.filter(l => isExpired(l, now));
    for (let i = 0; i < stale.length; i += 400) {
        const b = db.batch();
        stale.slice(i, i + 400).forEach(l => {
            b.update(l._ref, { status: 'closed', closedAt: new Date(now).toISOString() });
            l.status = 'closed';
            l.closedAt = new Date(now).toISOString();
        });
        await b.commit();
    }
    result.closed = stale.length;

    // 2. applications that outlived the retention rules: old ones, plus those of listings closed more than closedListingDays ago
    const cutoff = new Date(now - RETENTION.maxApplicationDays * DAY).toISOString();
    const apps = new Map(rows(await db.collection('applications').where('created', '<', cutoff).get()).map(a => [a.id, a]));
    const closed = rows(await db.collection('listings').where('status', '==', 'closed').get());
    const listings = [...live, ...closed];
    for (const l of closed) {
        const t = Date.parse(l.closedAt);
        if (!Number.isNaN(t) && now - t > RETENTION.closedListingDays * DAY) {
            rows(await db.collection('applications').where('listingId', '==', l.id).get()).forEach(a => apps.set(a.id, a));
        }
    }
    const doomed = expiredApps([...apps.values()], listings, now);
    for (let i = 0; i < doomed.length; i += 100) {
        const b = db.batch();
        for (const a of doomed.slice(i, i + 100)) {
            for (let n = 0; n < (a.snapChunks || 0); n++) {
                b.delete(db.collection('blobs').doc(`ar_${a.id}_${n}`));
                result.files++;
            }
            b.delete(a._ref);
        }
        await b.commit();
    }
    result.applications = doomed.length;
    return result;
}

function readKey() {
    let key;
    try {
        key = JSON.parse(String(process.env.FIREBASE_SERVICE_ACCOUNT || '').trim());
        if (typeof key === 'string') {
            key = JSON.parse(key);
        }
    } catch {
        throw new Error('FIREBASE_SERVICE_ACCOUNT is missing or is not valid JSON (see README: "No command line needed").');
    }
    key.private_key = String(key.private_key || '').replace(/\\n/g, '\n');
    return key;
}

if (require.main === module) {
    const admin = require('firebase-admin');
    admin.initializeApp({ credential: admin.credential.cert(readKey()) });
    sweep(admin.firestore()).then(r => {
        console.log('Sweep finished:', JSON.stringify(r));
        if (process.env.GITHUB_STEP_SUMMARY) {
            fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Sweep finished\n\nClosed ${r.closed} expired listing(s), deleted ${r.applications} old application(s) and ${r.files} shared resume file part(s).\n`);
        }
        process.exit(0);
    }, e => {
        console.error(e.message);
        process.exit(1);
    });
}
module.exports = { sweep };
