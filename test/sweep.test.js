// Checks for the daily sweep (scripts/sweep-firestore.js) against a tiny in-memory Firestore.  Run:  node test/sweep.test.js
const { sweep } = require('../scripts/sweep-firestore.js');

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const NOW = Date.parse('2026-10-16T00:00:00Z');
const ago = d => new Date(NOW - d * 864e5).toISOString();

const store = { listings: {}, applications: {}, blobs: {} };
const ref = (col, id) => ({ col, id });
const fake = {
    collection: col => ({
        doc: id => ref(col, id),
        where: (f, op, v) => ({
            get: async () => ({
                docs: Object.entries(store[col]).filter(([, d]) => op === '==' ? d[f] === v : op === '<' ? String(d[f]) < v : false)
                    .map(([id, d]) => ({ id, data: () => ({ ...d }), ref: ref(col, id) }))
            })
        })
    }),
    batch: () => {
        const ops = [];
        return {
            update: (r, p) => ops.push(() => Object.assign(store[r.col][r.id], p)),
            delete: r => ops.push(() => delete store[r.col][r.id]),
            commit: async () => ops.forEach(f => f())
        };
    }
};
const L = (id, o) => { store.listings[id] = { orgId: 'o', status: 'approved', created: ago(1), ...o }; };
L('fresh', {});
L('old_posted', { created: ago(120) });
L('old_import', { source: 'import', lastSeen: ago(60), created: ago(5) });
L('seen_import', { source: 'import', lastSeen: ago(2), created: ago(100) });
L('closed_long', { status: 'closed', closedAt: ago(40) });
L('closed_recent', { status: 'closed', closedAt: ago(5) });
const A = (id, listingId, created, chunks = 2) => { store.applications[id] = { listingId, created, snapChunks: chunks }; store.blobs[`ar_${id}_0`] = {}; store.blobs[`ar_${id}_1`] = {}; };
A('a_fresh', 'fresh', ago(10));
A('a_year', 'fresh', ago(400));
A('a_closed_long', 'closed_long', ago(50));
A('a_closed_recent', 'closed_recent', ago(10));

(async () => {
    const r = await sweep(fake, NOW);
    ok(store.listings.old_posted.status === 'closed', 'a posted listing older than 90 days is closed');
    ok(store.listings.old_import.status === 'closed', 'an imported listing not seen for 45+ days is closed');
    ok(store.listings.fresh.status === 'approved', 'a fresh listing stays open');
    ok(store.listings.seen_import.status === 'approved', 'an imported listing still seen on the employer page stays open');
    ok(typeof store.listings.old_posted.closedAt === 'string', 'closing records closedAt (starts the retention clock)');
    ok(r.closed === 2, 'reports 2 closed');
    ok(!store.applications.a_year, 'an application older than a year is deleted');
    ok(!store.applications.a_closed_long, 'an application of a listing closed 30+ days ago is deleted');
    ok(!!store.applications.a_fresh && !!store.applications.a_closed_recent, 'recent applications are kept');
    ok(!store.blobs.a_year_0 && !store.blobs.ar_a_year_0 && !store.blobs.ar_a_year_1 && !store.blobs.ar_a_closed_long_1, 'the resume copies shared with organizations are deleted with them');
    ok(!!store.blobs.ar_a_fresh_0 && !!store.blobs.ar_a_closed_recent_1, 'resume copies of kept applications stay');
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
})();
