const fs = require('fs');
const { DB_FILE, SEED_DEMO } = require('../config');
const { uid } = require('../lib/helpers');
// JSON-file database. `db` is loaded (or seeded) once; call save() after changing it.
// Safety: a missing file starts a new database, but a file that EXISTS and cannot be read is never overwritten.
// The newest readable backup is used instead (the broken file is kept next to it as *.corrupt-<time>); with no backup the server refuses to start.
const BAK = DB_FILE + '.bak';
const readJson = f => JSON.parse(fs.readFileSync(f));
let db = null;
try {
    db = readJson(DB_FILE);
} catch (e) {
    if (e.code !== 'ENOENT') {
        const keep = DB_FILE + '.corrupt-' + Date.now();
        try {
            fs.copyFileSync(DB_FILE, keep);
        } catch { }
        try {
            db = readJson(BAK);
            console.error('Database file was unreadable (' + e.message + '). Restored from ' + BAK + '. The broken file was kept as ' + keep);
        } catch {
            throw new Error('Database file ' + DB_FILE + ' is unreadable (' + e.message + ') and no backup could be loaded. Nothing was changed. A copy is at ' + keep);
        }
    }
}
// Write to a temp file then rename, so a crash mid-write can never leave a half-written database.
// A backup of the previous version is refreshed at most every 10 minutes (copying a big file on every save would be slow).
let lastBak = 0;
const save = () => {
    const t = DB_FILE + '.tmp';
    fs.writeFileSync(t, JSON.stringify(db));
    if (Date.now() - lastBak > 10 * 60e3) {
        try {
            fs.copyFileSync(DB_FILE, BAK);
            lastBak = Date.now();
        } catch { }
    }
    fs.renameSync(t, DB_FILE);
};
if (!db && !SEED_DEMO) {
    db = {
        users: [], listings: [], applications: [], saved: []
    };
    save();
}
if (!db) {
    const org = {
        id: 'seed-org', name: 'Linear HR', email: '', role: 'org', orgName: 'Linear', verified: true, created: new Date().toISOString()
    };
    const L = (title, type, location, pay, description) => ({
        id: uid(), orgId: org.id, orgName: 'Linear', title, type, location, pay, description, status: 'approved', created: new Date().toISOString()
    });
    db = {
        users: [org], listings: [
            L('Product Design Intern', 'Internship', 'Remote · Worldwide', '$2,000–$3,000 / month', 'Work with our design team on real product features.'),
            L('Junior Frontend Developer', 'Job', 'New York, NY · Hybrid', '$75K–$95K / year', 'Build and ship UI with React and TypeScript.'),
            L('Data Analytics Certificate', 'Course', 'Online · Self-paced', '$14 / month', 'Learn SQL, spreadsheets and dashboards.')
        ],
        applications: [], saved: []
    };
    save();
}
module.exports = { db, save };
