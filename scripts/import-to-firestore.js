#!/usr/bin/env node
// Scheduled importer (runs in GitHub Actions, see .github/workflows/import-jobs.yml).
// Collects listings (same sources as import-jobs.js), scores them, writes them straight into Firestore, and keeps the list fresh:
//   trust 50+ -> published   |   under 50 -> pending (your review queue)   |   obvious scam -> not stored
//   still on the employer's page -> lastSeen is refreshed (stays open)
//   gone from the employer's page -> closed (only when that page was fetched fine this run, and never more than 60% of a company at once)
//   not seen for 45 days (e.g. a source stopped working) -> closed
//   (By default everything waits as 'pending' for an admin; set "autoPublish": true in config/import-settings.json to publish trust 50+ at once.)
// Needs: env FIREBASE_SERVICE_ACCOUNT = the service-account JSON (a GitHub secret) and `npm i firebase-admin`.
// Optional: env ADZUNA_APP_ID and ADZUNA_APP_KEY (free key) to also pull internships and fresher jobs from Adzuna.
// The service account bypasses security rules, so this script re-checks everything itself (https links only, trust score, size limits).
const fs = require('fs');
const path = require('path');
const { collect } = require('./import-jobs');
// db = a Firestore (firebase-admin) object; items = what collect() returned; deps = { trustScore, decide, cleanImport, hash, LIFE_DAYS }
async function run(db, items, deps, report = { complete: new Set() }, nowMs = Date.now(), log = console.log) {
    const { trustScore, decide, cleanImport, hash, LIFE_DAYS } = deps;
    const out = { published: 0, review: 0, skipped: 0, duplicates: 0, invalid: 0, refreshed: 0, gone: 0, closed: 0 };
    const now = new Date(nowMs).toISOString();
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
        const snap = await ref.get();
        if (snap.exists) {
            if (snap.data().status === 'approved') {
                await ref.update({ lastSeen: now });
                out.refreshed++;
            } else {
                out.duplicates++;
            }
            continue;
        }
        const t = trustScore(l);
        const status = decide(t);
        if (status === 'hidden') {
            out.skipped++;
            continue;
        }
        await ref.set({ ...l, trust: t.score, trustReasons: t.reasons, status, created: now, lastSeen: now, srcKey: it.srcKey || '' });
        status === 'approved' ? out.published++ : out.review++;
    }
    // Close what is gone from the employer's page, and what nobody has seen for a long time.
    const cutoff = new Date(nowMs - LIFE_DAYS.import * 864e5).toISOString();
    const open = (await db.collection('listings').where('source', '==', 'import').where('status', '==', 'approved').get()).docs;
    const perSource = {};
    for (const d of open) {
        const k = d.data().srcKey;
        if (k) {
            (perSource[k] = perSource[k] || []).push(d);
        }
    }
    const goneIds = new Set();
    for (const [k, docs] of Object.entries(perSource)) {
        if (!report.complete.has(k)) {
            continue;
        }
        const gone = docs.filter(d => !seen.has(d.id));
        if (docs.length >= 5 && gone.length > docs.length * 0.6) {
            log(`  ${k}: ${gone.length} of ${docs.length} listings look gone, which is suspicious. Left open this time.`);
            continue;
        }
        gone.forEach(d => goneIds.add(d.id));
    }
    for (const d of open) {
        const x = d.data();
        if (goneIds.has(d.id)) {
            await d.ref.update({ status: 'closed', closedAt: now });
            out.gone++;
        } else if (String(x.lastSeen || x.created) < cutoff) {
            await d.ref.update({ status: 'closed', closedAt: now });
            out.closed++;
        }
    }
    return out;
}
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
    const { trustScore, decide: decideTrust } = await import(path.join(root, 'features/trust/trust.js'));
    const { cleanImport, hash } = await import(path.join(root, 'services/firestore-api/helpers.js'));
    const { LIFE_DAYS } = await import(path.join(root, 'features/listings/expiry.js'));
    const list = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'companies.json'), 'utf8'));
    let settings = {};
    try {
        settings = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'import-settings.json'), 'utf8'));
    } catch { }
    const decide = r => (r.scam ? 'hidden' : settings.autoPublish === true ? decideTrust(r) : 'pending');
    const report = { complete: new Set(), failed: [], skipped: [] };
    const items = await collect(list, console.log, report);
    const out = await run(db, items, { trustScore, decide, cleanImport, hash, LIFE_DAYS }, report);
    console.log('Import finished:', JSON.stringify(out));
    if (report.failed.length) {
        console.log('These sources failed (wrong board name, or the site is down). Fix or delete them in config/companies.json:', report.failed.join(', '));
    }
    if (report.skipped.length) {
        console.log('Skipped (no key set):', report.skipped.join(', '));
    }
    if (!items.length) {
        throw new Error('Nothing was collected from any source. Check the log above.');
    }
}
if (require.main === module) {
    main().catch(e => {
        console.error(e.message);
        process.exit(1);
    });
}
module.exports = { run };
