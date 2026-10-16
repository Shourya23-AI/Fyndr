// Checks for the server's data-safety fixes.  Run:  node test/server-safety.test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { Readable } = require('stream');
const readBody = require('../server/lib/body');

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const ROOT = path.join(__dirname, '..');
const load = dir => spawnSync(process.execPath, ['-e', "require('./server/db/store.js')"], { cwd: ROOT, env: { ...process.env, DATA_DIR: dir, NODE_ENV: 'production' }, encoding: 'utf8' });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fyndr-'));

(async () => {
    // ---- a damaged database file is never overwritten
    let d = tmp();
    const broken = '{"users":[{"id":"u1","name":"Real user"}],"listings":[';
    fs.writeFileSync(path.join(d, 'data.json'), broken);
    let r = load(d);
    ok(r.status !== 0, 'server refuses to start when the database is unreadable and there is no backup');
    ok(fs.readFileSync(path.join(d, 'data.json'), 'utf8') === broken, 'the damaged file is left exactly as it was');

    // ---- ... but a good backup is restored, and the broken file is kept
    d = tmp();
    const good = { users: [{ id: 'u1', name: 'Real user' }], listings: [], applications: [], saved: [] };
    fs.writeFileSync(path.join(d, 'data.json'), broken);
    fs.writeFileSync(path.join(d, 'data.json.bak'), JSON.stringify(good));
    r = load(d);
    ok(r.status === 0, 'starts from the backup');
    ok(fs.readdirSync(d).some(f => f.startsWith('data.json.corrupt-')), 'the damaged file is kept as data.json.corrupt-*');

    // ---- a missing file still starts a new empty database
    d = tmp();
    r = load(d);
    ok(r.status === 0 && JSON.parse(fs.readFileSync(path.join(d, 'data.json'), 'utf8')).users.length === 0, 'a first run creates an empty database');

    // ---- saving keeps a backup of the previous version
    d = tmp();
    spawnSync(process.execPath, ['-e', "const s=require('./server/db/store.js'); s.db.users.push({id:'x'}); s.save();"], { cwd: ROOT, env: { ...process.env, DATA_DIR: d, NODE_ENV: 'production' } });
    ok(fs.existsSync(path.join(d, 'data.json.bak')), 'save() writes a backup');

    // ---- request bodies keep multi-byte text intact, even when chunks split a character
    const text = JSON.stringify({ name: 'रोहित शर्मा ' .repeat(40), note: 'தமிழ் 😀' });
    const buf = Buffer.from(text);
    const chunks = [];
    for (let i = 0; i < buf.length; i += 7) { chunks.push(buf.subarray(i, i + 7)); }
    const got = await readBody(Readable.from(chunks), 1e6, () => { throw new Error('big'); });
    ok(got === text, 'Hindi, Tamil and emoji survive chunk boundaries');
    let tooBig = false;
    await readBody(Readable.from([Buffer.alloc(50), Buffer.alloc(50)]), 80, () => { tooBig = true; });
    ok(tooBig, 'an oversized body is rejected');

    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
})();
