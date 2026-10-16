// Schema versions for data.json. `db.schemaVersion` is the number of steps already applied; every step below runs once, in order, on startup.
// To change the data layout: ADD a step at the end (never edit an old one) and describe it. store.js keeps a copy of the file as data.json.pre-v<N> before saving a migration.
const MIGRATIONS = [
    // 1: every list the code reads exists (older files were missing some of them)
    d => {
        for (const k of ['users', 'listings', 'applications', 'saved', 'staffInvites', 'adminLog']) {
            if (!Array.isArray(d[k])) {
                d[k] = [];
            }
        }
    }
];
module.exports = function migrate(d) {
    const from = Number.isInteger(d.schemaVersion) ? d.schemaVersion : 0;
    if (from > MIGRATIONS.length) {
        throw new Error('data.json was written by a newer version of Fyndr (schema ' + from + ', this server knows ' + MIGRATIONS.length + '). Update the server instead of opening it with older code.');
    }
    MIGRATIONS.slice(from).forEach(step => step(d));
    d.schemaVersion = MIGRATIONS.length;
    return { from, to: d.schemaVersion };
};
