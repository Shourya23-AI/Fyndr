#!/usr/bin/env node
// Scheduled importer (runs in GitHub Actions, see .github/workflows/import-jobs.yml).
// Collects listings (same sources as import-jobs.js), scores them, writes them straight into Firestore, and closes old imports.
//   trust 50+ -> published   |   under 50 -> pending (your review queue)   |   obvious scam -> not stored
// Needs: env FIREBASE_SERVICE_ACCOUNT = the service-account JSON (a GitHub secret) and `npm i firebase-admin`.
// The service account bypasses security rules, so this script re-checks everything itself (https links only, trust score, size limits).
const fs = require('fs');
const path = require('path');
const { collect } = require('./import-jobs');
async function main() {
    const admin = require('firebase-admin');
    let key;
    try {
        key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '');
    } catch {
        throw new Error('FIREBASE_SERVICE_ACCOUNT is missing or is not valid JSON');
    }
    admin.initializeApp({ credential: admin.credential.cert(key) });
    const db = admin.firestore();
    const root = path.join(__dirname, '..', 'public', 'js');
    const { trustScore, decide } = await import(path.join(root, 'features/trust/trust.js'));
    const { cleanImport, hash } = await import(path.join(root, 'services/firestore-api/helpers.js'));
    const { LIFE_DAYS } = await import(path.join(root, 'features/listings/expiry.js'));
    const list = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'companies.json'), 'utf8'));
    const items = await collect(list);
    const out = { published: 0, review: 0, skipped: 0, duplicates: 0, invalid: 0, closed: 0 };
    const seen = new Set();
    for (const it of items) {
        const l = cleanImport(it);
        if (!l) {
            out.invalid++;
            continue;
        }
        const id = 'imp_' + hash(l.applyUrl);
        if (seen.has(id)) {
            out.duplicates++;
            continue;
        }
        seen.add(id);
        const ref = db.collection('listings').doc(id);
        if ((await ref.get()).exists) {
            out.duplicates++;
            continue;
        }
        const t = trustScore(l);
        const status = decide(t);
        if (status === 'hidden') {
            out.skipped++;
            continue;
        }
        await ref.set({ ...l, trust: t.score, trustReasons: t.reasons, status, created: new Date().toISOString() });
        status === 'approved' ? out.published++ : out.review++;
    }
    // Expire old imports (they start the 30-day retention clock the same way a closed listing does).
    const cutoff = new Date(Date.now() - LIFE_DAYS.import * 864e5).toISOString();
    const old = await db.collection('listings').where('source', '==', 'import').where('status', '==', 'approved').get();
    for (const d of old.docs.filter(x => String(x.data().created) < cutoff)) {
        await d.ref.update({ status: 'closed', closedAt: new Date().toISOString() });
        out.closed++;
    }
    console.log('Import finished:', JSON.stringify(out));
}
main().catch(e => {
    console.error(e.message);
    process.exit(1);
});
