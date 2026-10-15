// Checks for the "no more hanging, jobs and courses update by themselves" changes. Uses a pretend internet.
// Run:  node test/import-live.test.js
const assert = require('assert');
let pass = 0;
const ok = (c, m) => {
    assert.ok(c, m);
    pass++;
};
(async () => {
    const realFetch = global.fetch;
    const J = require('../scripts/import-jobs');
    const settings = require('../config/import-settings.json');
    ok(settings.autoPublish === true, 'imports go live by themselves (autoPublish)');

    // 1) a download that never answers is cut off instead of waiting for ever
    global.fetch = (u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    const t0 = Date.now();
    const list = [{ name: 'Slow Co', type: 'greenhouse', board: 'slow' }];
    const rep = { complete: new Set(), failed: [], skipped: [] };
    J.TIMEOUT.ms = 150;
    await J.collect(list, () => { }, rep, { pause: 0 });
    J.TIMEOUT.ms = 20000;
    ok(rep.failed.includes('Slow Co') && Date.now() - t0 < 3000, 'a hanging site is cut off and reported as failed');

    // 2) several sources at once, in list order, one failing does not stop the rest
    const logs = [];
    global.fetch = async u => {
        const s = String(u);
        await new Promise(r => setTimeout(r, 30));
        if (s.includes('/boards/bad/')) {
            return { ok: false, status: 404, json: async () => ({}) };
        }
        const m = s.match(/boards\/([a-z]+)\//);
        return { ok: true, status: 200, json: async () => ({ jobs: [{ title: 'Software Engineer Intern', absolute_url: `https://boards.greenhouse.io/${m[1]}/jobs/1`, location: { name: 'Bengaluru' }, content: 'Intern role. Learn a lot. '.repeat(10) }] }) };
    };
    const names = ['aa', 'bb', 'bad', 'cc', 'dd', 'ee', 'ff'];
    const rep2 = { complete: new Set(), failed: [], skipped: [] };
    const t1 = Date.now();
    const items = await J.collect(names.map(n => ({ name: n.toUpperCase(), type: 'greenhouse', board: n })), m => logs.push(m), rep2, { pause: 0 });
    ok(items.length === 6 && rep2.failed.join() === 'BAD', 'six good sources collected, the broken one reported');
    ok(items.map(i => i.orgName).join() === 'AA,BB,CC,DD,EE,FF', 'results keep the order of the list');
    ok(Date.now() - t1 < 7 * 30 * 0.8 + 400, 'sources run in parallel (faster than one by one)');

    // 3) deadline: nothing new starts after it, and the run still finishes
    const rep3 = { complete: new Set(), failed: [], skipped: [] };
    const late = await J.collect(names.map(n => ({ name: n.toUpperCase(), type: 'greenhouse', board: n })), m => logs.push(m), rep3, { pause: 0, deadline: Date.now() - 1 });
    ok(late.length === 0 && logs.some(l => /not started/.test(l)), 'after the time limit nothing new starts');

    // 4) Microsoft Learn: newest first, https only, no tracking query, marked Free, never filtered like jobs
    global.fetch = async () => ({
        ok: true, status: 200, json: async () => ({
            learningPaths: [
                { title: 'Old path', summary: 'Old one', url: '/en-us/training/paths/old/?WT.mc_id=api_CatalogApi', last_modified: '2023-01-01T00:00:00Z', duration_in_minutes: 90, levels: ['beginner'], roles: ['student'] },
                { title: 'Azure AI Fundamentals', summary: '<p>Learn <b>AI</b> basics &amp; more</p>', url: 'https://learn.microsoft.com/en-us/training/paths/get-started-with-artificial-intelligence-on-azure/?x=1', last_modified: '2026-09-01T00:00:00Z', duration_in_minutes: 600, levels: ['beginner'], roles: ['student', 'ai-engineer'] },
                { title: 'Expert only', summary: 'Hard', url: 'https://learn.microsoft.com/en-us/training/paths/hard/', last_modified: '2026-10-01T00:00:00Z', duration_in_minutes: 60, levels: ['advanced'] },
                { title: 'No link', summary: 'x', last_modified: '2026-10-02T00:00:00Z', levels: ['beginner'] }
            ]
        })
    });
    const rep4 = { complete: new Set(), failed: [], skipped: [] };
    const cs = await J.collect([{ name: 'Microsoft Learn', type: 'mslearn', levels: ['beginner'], limit: 5 }], () => { }, rep4, { pause: 0 });
    ok(cs.length === 2 && cs[0].title === 'Azure AI Fundamentals' && cs[1].title === 'Old path', 'newest beginner paths first, advanced and link-less ones left out');
    ok(cs[0].type === 'Course' && cs[0].pay === 'Free' && cs[0].location === 'Online', 'marked as a free online course');
    ok(cs[0].applyUrl === 'https://learn.microsoft.com/en-us/training/paths/get-started-with-artificial-intelligence-on-azure/', 'tracking parameters removed');
    ok(cs[0].description.includes('Learn AI basics & more') && !/[<>]/.test(cs[0].description) && cs[0].duration === 'About 10 hours, at your own pace', 'plain text description and a readable duration');
    ok(cs[1].applyUrl.startsWith('https://learn.microsoft.com/en-us/training/paths/old/'), 'relative links are made absolute');
    const { cleanImport } = await import('../public/js/services/firestore-api/helpers.js');
    const { trustScore, decide } = await import('../public/js/features/trust/trust.js');
    const row = cleanImport(cs[0]);
    ok(row && row.type === 'Course' && decide(trustScore(row)) === 'approved', 'a Microsoft Learn course is accepted and published by the trust rules');

    // 5) the Firebase importer ends by itself and uses batched lookups
    const src = require('fs').readFileSync(__dirname + '/../scripts/import-to-firestore.js', 'utf8');
    ok(/main\(\)\.then\(\(\) => process\.exit\(0\)/.test(src), 'the Firebase importer exits when it is done');
    ok(/pathToFileURL/.test(src), 'module loading works on Windows too');
    const wf = require('fs').readFileSync(__dirname + '/../.github/workflows/import-jobs.yml', 'utf8');
    ok(/cron: '15 \*\/3 \* \* \*'/.test(wf) && /config\/courses\.json/.test(wf) && /workflow_dispatch/.test(wf), 'the workflow runs every 3 hours, after config edits and on demand');

    // 6) run() with a database that has getAll: existing listings are refreshed, new ones published, no per-item lookups
    const { run } = require('../scripts/import-to-firestore.js');
    const { LIFE_DAYS } = await import('../public/js/features/listings/expiry.js');
    const { hash } = await import('../public/js/services/firestore-api/helpers.js');
    const store = new Map();
    let singles = 0;
    const doc = id => ({ id, get: async () => { singles++; return { exists: store.has(id), id, data: () => store.get(id) }; }, set: async d => store.set(id, d), update: async d => store.set(id, { ...store.get(id), ...d }) });
    const db = {
        collection: () => ({ doc, where: () => ({ where: () => ({ get: async () => ({ docs: [] }) }) }) }),
        getAll: async (...refs) => refs.map(r => ({ exists: store.has(r.id), id: r.id, data: () => store.get(r.id) }))
    };
    const it = { orgName: 'Microsoft Learn', title: 'Azure AI Fundamentals', type: 'Course', location: 'Online', pay: 'Free', applyUrl: cs[0].applyUrl, source: 'mslearn', description: cs[0].description, srcKey: 'mslearn:x' };
    const r1 = await run(db, [it, it], { trustScore, decide, cleanImport, hash, LIFE_DAYS }, { complete: new Set() });
    ok(r1.published === 1 && r1.duplicates === 1, 'a new course is published at once, the repeat is ignored');
    const r2 = await run(db, [it], { trustScore, decide, cleanImport, hash, LIFE_DAYS }, { complete: new Set() });
    ok(r2.refreshed === 1 && r2.published === 0, 'on the next run it is only refreshed');
    ok(singles === 0, 'lookups were batched (no one-by-one reads)');

    global.fetch = realFetch;
    console.log(`\n${pass} passed, 0 failed`);
})().catch(e => {
    console.error('FAILED:', e.message, '\n', e.stack.split('\n').slice(1, 4).join('\n'));
    process.exit(1);
});
