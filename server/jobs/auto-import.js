// Finds jobs, internships and courses by itself, inside the Node server (no GitHub, no Firebase key, no clicking).
//   - on start (after a short delay) and then every IMPORT_EVERY_HOURS hours (default 6)
//   - reads config/companies.json (same sources as scripts/import-jobs.js) and config/import-settings.json
//   - scores each listing (trust 50+ -> approved and visible at once, under 50 -> pending for an admin, scam -> dropped)
//   - still on the employer's page -> kept open (lastSeen refreshed); gone from it -> closed; not seen for 45 days -> closed
// Environment: IMPORT=0 turns it off.  IMPORT_EVERY_HOURS=3 changes the interval.  ADZUNA_APP_ID / ADZUNA_APP_KEY add Adzuna (optional).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const PUBJS = path.join(ROOT, 'public', 'js');
const load = async rel => import(require('url').pathToFileURL(path.join(PUBJS, rel)).href); // the shared browser modules (ES modules) are reused as they are

// Pure part: puts collected items into `listings` (the db.listings array). Returns counts. `deps` = { trustScore, decide, cleanImport, hash, LIFE_DAYS }.
function applyImport(listings, items, deps, report = { complete: new Set() }, nowMs = Date.now(), log = () => { }) {
    const { trustScore, decide, cleanImport, hash, LIFE_DAYS } = deps;
    const out = { published: 0, review: 0, skipped: 0, duplicates: 0, invalid: 0, refreshed: 0, gone: 0, closed: 0 };
    const now = new Date(nowMs).toISOString();
    const byId = new Map(listings.filter(l => l.source === 'import').map(l => [l.id, l]));
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
        const old = byId.get(id);
        if (old) {
            if (old.status === 'approved') {
                old.lastSeen = now;
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
        const row = { ...l, id, trust: t.score, trustReasons: t.reasons, status, created: now, lastSeen: now, srcKey: it.srcKey || '' };
        listings.push(row);
        byId.set(id, row);
        status === 'approved' ? out.published++ : out.review++;
    }
    // Close what is gone from the employer's page, and what nobody has seen for a long time.
    const cutoff = new Date(nowMs - LIFE_DAYS.import * 864e5).toISOString();
    const open = [...byId.values()].filter(l => l.status === 'approved');
    const perSource = {};
    for (const l of open) {
        if (l.srcKey) {
            (perSource[l.srcKey] = perSource[l.srcKey] || []).push(l);
        }
    }
    const goneIds = new Set();
    for (const [k, docs] of Object.entries(perSource)) {
        if (!report.complete.has(k)) {
            continue;
        }
        const gone = docs.filter(l => !seen.has(l.id));
        if (docs.length >= 5 && gone.length > docs.length * 0.6) {
            log(`  ${k}: ${gone.length} of ${docs.length} listings look gone, which is suspicious. Left open this time.`);
            continue;
        }
        gone.forEach(l => goneIds.add(l.id));
    }
    for (const l of open) {
        if (goneIds.has(l.id)) {
            l.status = 'closed';
            l.closedAt = now;
            out.gone++;
        } else if (String(l.lastSeen || l.created) < cutoff) {
            l.status = 'closed';
            l.closedAt = now;
            out.closed++;
        }
    }
    return out;
}

let running = false;
async function runOnce(log = console.log) {
    if (running) {
        return null;
    }
    running = true;
    try {
        const { db, save } = require('../db/store');
        const { collect } = require('../../scripts/import-jobs');
        const { trustScore, decide: decideTrust } = await load('features/trust/trust.js');
        const settings = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'import-settings.json'), 'utf8')); } catch { return {}; } })();
        // By default EVERY found listing waits for a person to approve it (with its trust score shown). Set "autoPublish": true in config/import-settings.json to publish trusted ones at once.
        const decide = r => (r.scam ? 'hidden' : settings.autoPublish === true ? decideTrust(r) : 'pending');
        const { cleanImport, hash } = await load('services/firestore-api/helpers.js');
        const { LIFE_DAYS } = await load('features/listings/expiry.js');
        const list = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'companies.json'), 'utf8'));
        const report = { complete: new Set(), failed: [], skipped: [] };
        const items = await collect(list, log, report);
        if (!items.length) {
            log('Auto import: nothing was collected from any source (network or source problem). Nothing changed.');
            return null;
        }
        const out = applyImport(db.listings, items, { trustScore, decide, cleanImport, hash, LIFE_DAYS }, report, Date.now(), log);
        save();
        log('Auto import finished:', JSON.stringify(out), report.failed.length ? '| failed sources: ' + report.failed.join(', ') : '');
        return out;
    } catch (e) {
        console.error('Auto import failed:', e.message);
        return null;
    } finally {
        running = false;
    }
}

function start() {
    if (process.env.IMPORT === '0') {
        return;
    }
    const hours = Math.max(1, Number(process.env.IMPORT_EVERY_HOURS) || 6);
    const go = () => runOnce().catch(() => { });
    setTimeout(go, 15e3).unref();                 // first run shortly after the server starts, so a fresh site fills itself
    setInterval(go, hours * 3600e3).unref();
    console.log(`Auto import on: every ${hours} h (IMPORT=0 turns it off)`);
}
module.exports = { start, runOnce, applyImport };
