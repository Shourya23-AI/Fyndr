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
const { pathToFileURL } = require('url');
const { collect } = require('./import-jobs');
// db = a Firestore (firebase-admin) object; items = what collect() returned; deps = { trustScore, decide, cleanImport, hash, LIFE_DAYS }
async function run(db, items, deps, report = { complete: new Set() }, nowMs = Date.now(), log = console.log) {
    const { trustScore, decide, cleanImport, hash, LIFE_DAYS } = deps;
    const out = { published: 0, review: 0, skipped: 0, duplicates: 0, invalid: 0, refreshed: 0, gone: 0, closed: 0 };
    const now = new Date(nowMs).toISOString();
    const seen = new Set();
    const snaps = new Map();
    if (typeof db.getAll === 'function') {
        const refs = [...new Set(items.map(it => {
            const l = cleanImport(it);
            return l ? 'imp_' + hash(l.applyUrl) : '';
        }).filter(Boolean))].map(id => db.collection('listings').doc(id));
        for (let i = 0; i < refs.length; i += 100) {
            (await db.getAll(...refs.slice(i, i + 100))).forEach(s => snaps.set(s.id, s));
        }
    }
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
        const snap = snaps.get(id) || await ref.get();
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
// ---- first-run setup checks: every usual mistake gets ONE plain sentence that says what to click ----
function readKey() {
    const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
    if (!raw) {
        throw new Error('The FIREBASE_SERVICE_ACCOUNT secret is empty. GitHub repository > Settings > Secrets and variables > Actions > New repository secret. Name: FIREBASE_SERVICE_ACCOUNT, value: the WHOLE service-account .json file.');
    }
    let key;
    try {
        key = JSON.parse(raw);
        if (typeof key === 'string') {
            key = JSON.parse(key); // pasted with quotes around it
        }
    } catch {
        throw new Error('The FIREBASE_SERVICE_ACCOUNT secret is not valid JSON. Open the downloaded .json key file in Notepad, select ALL of it (it starts with { and ends with }), and paste it again without adding quotes or leaving anything out.');
    }
    const missing = ['project_id', 'client_email', 'private_key'].filter(k => !key || typeof key[k] !== 'string' || !key[k].trim());
    if (missing.length) {
        throw new Error(`The FIREBASE_SERVICE_ACCOUNT secret is JSON but not a service-account key (missing: ${missing.join(', ')}). Firebase Console > gear icon > Project settings > Service accounts > Generate new private key, and paste that whole file. (Not the web "firebaseConfig" and not google-services.json.)`);
    }
    key.private_key = key.private_key.replace(/\\n/g, '\n'); // a key whose line breaks were pasted as the two characters \n
    return key;
}
function explain(e, projectId) {
    const m = String((e && e.message) || e);
    const code = e && e.code;
    if (/Datastore Mode/i.test(m)) {
        return `The Firestore database in project "${projectId}" was created in Datastore mode. Fyndr needs Native mode: make a new project (or database) and choose "Native mode".`;
    }
    if (/Cloud Firestore API has not been used|SERVICE_DISABLED|firestore\.googleapis\.com.*disabled/i.test(m)) {
        return `The Cloud Firestore API is switched off for project "${projectId}". Open https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=${projectId} , click Enable, wait a minute, then run the workflow again.`;
    }
    if (code === 5 || /^5 NOT_FOUND/.test(m)) {
        return `Project "${projectId}" has no Firestore database yet. Firebase Console > Build > Firestore Database > Create database (production mode is fine), then run the workflow again.`;
    }
    if (code === 7 || /PERMISSION_DENIED/.test(m)) {
        return `Google says this service account may not use Firestore in project "${projectId}". Generate a new private key from Firebase Console > Project settings > Service accounts of THAT project (it must be the project that holds the site's data), replace the secret, and run again. Details: ${m}`;
    }
    if (code === 16 || /UNAUTHENTICATED|invalid_grant|Invalid JWT|DECODER routines|private key|PEM/i.test(m)) {
        return `Google refused the key. It was deleted, copied only in part, or belongs to another project. Generate a new private key (Firebase Console > Project settings > Service accounts), replace the FIREBASE_SERVICE_ACCOUNT secret with the whole new file, and run again. Details: ${m}`;
    }
    return null;
}
function say(kind, text) {
    // In GitHub Actions "::error::" shows the message as a red banner at the top of the run.
    console[kind === 'error' ? 'error' : 'log'](process.env.GITHUB_ACTIONS ? `::${kind}::${String(text).replace(/\r?\n/g, ' ')}` : text);
}
function writeSummary(lines) {
    if (process.env.GITHUB_STEP_SUMMARY) {
        try {
            fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
        } catch { }
    }
}
async function main() {
    const admin = require('firebase-admin');
    const key = readKey();
    let webProject = '';
    try {
        webProject = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'firebase-config.json'), 'utf8')).projectId || '';
    } catch { }
    if (webProject && webProject !== key.project_id) {
        say('warning', `The key is for project "${key.project_id}" but the site (config/firebase-config.json) reads project "${webProject}". The importer would fill a database the site never looks at. Use a key from "${webProject}".`);
    }
    try {
        admin.initializeApp({ credential: admin.credential.cert(key) });
    } catch (e) {
        throw new Error(explain(e, key.project_id) || `The service-account key was rejected: ${e.message}. Generate a new private key and replace the secret.`);
    }
    const db = admin.firestore();
    try {
        await db.collection('listings').limit(1).get(); // cheap read: proves the key, the API and the database all work before 70+ sites are fetched
    } catch (e) {
        throw new Error(explain(e, key.project_id) || `Could not read Firestore (${e.message}).`);
    }
    const root = path.join(__dirname, '..', 'public', 'js');
    const load = rel => import(pathToFileURL(path.join(root, rel)).href);
    const { trustScore, decide: decideTrust } = await load('features/trust/trust.js');
    const { cleanImport, hash } = await load('services/firestore-api/helpers.js');
    const { LIFE_DAYS } = await load('features/listings/expiry.js');
    const list = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'companies.json'), 'utf8'));
    let settings = {};
    try {
        settings = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'import-settings.json'), 'utf8'));
    } catch { }
    const decide = r => (r.scam ? 'hidden' : settings.autoPublish === true ? decideTrust(r) : 'pending');
    const report = { complete: new Set(), failed: [], skipped: [] };
    const cacheRef = db.collection('meta').doc('atsCache');
    let atsCache = {};
    try {
        const c = await cacheRef.get();
        atsCache = c.exists ? JSON.parse(c.data().json || '{}') : {};
    } catch { }
    const items = await collect(list, console.log, report, { atsCache, deadline: Date.now() + 9 * 60e3 });
    try {
        await cacheRef.set({ json: JSON.stringify(atsCache), at: new Date().toISOString() });
    } catch (e) {
        console.log('Could not save the board memory (not serious):', e.message);
    }
    const out = await run(db, items, { trustScore, decide, cleanImport, hash, LIFE_DAYS }, report);
    console.log('Import finished:', JSON.stringify(out));
    writeSummary(['### Import finished', '', `Collected ${items.length} listing(s) from ${list.length} sources.`, '', '| New and live | Waiting for review | Refreshed | Closed (gone from employer) | Closed (stale) |', '|---|---|---|---|---|', `| ${out.published} | ${out.review} | ${out.refreshed} | ${out.gone} | ${out.closed} |`, '', report.failed.length ? `Sources that failed (fix or delete in config/companies.json): ${report.failed.join(', ')}` : 'No source failed.']);
    if (report.failed.length) {
        console.log('These sources failed (wrong board name, or the site is down). Fix or delete them in config/companies.json:', report.failed.join(', '));
    }
    if (report.skipped.length) {
        console.log('Skipped (no API key set, or no public job board found for that company; this is normal and not an error):', report.skipped.join(', '));
    }
    if (!items.length) {
        throw new Error('Nothing was collected from any source. Check the log above.');
    }
}
if (require.main === module) {
    // firebase-admin keeps a network connection open, so without process.exit() this program never ends by itself.
    main().then(() => process.exit(0), e => {
        say('error', e.message);
        writeSummary(['### Import failed', '', String(e.message)]);
        process.exit(1);
    });
}
module.exports = { run };
