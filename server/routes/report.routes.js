const path = require('path');
const { pathToFileURL } = require('url');
const { R, bad } = require('../lib/router');
const { db, save } = require('../db/store');
const { uid } = require('../lib/helpers');
// "Report this listing": a signed-in person tells the staff that a listing looks like a scam, is misleading or is closed.
// The rules (allowed reasons, length limits, grouping) are the browser's own file, loaded once with a dynamic import.
let rules;
const load = async () => rules || (rules = await import(pathToFileURL(path.join(__dirname, '..', '..', 'public', 'js', 'features', 'report', 'report.rules.js')).href));
const MOD = ['admin', 'moderator'];
R('POST', '/api/report/:id', ['user', 'org'], async ({ user, p, body: b }) => {
    const r = await load();
    const clean = r.cleanReport(b);
    if (!clean) {
        bad(400, 'Choose what is wrong with this listing');
    }
    const id = p[0];
    let title;
    let orgName;
    if (r.isCatalogId(id)) { // a search link from the built-in catalog: it is not stored, so the report carries its title
        title = r.cleanTitle(b.title);
        orgName = r.cleanOrg(b.orgName);
        if (!title) {
            bad(400, 'Missing listing title');
        }
    } else {
        const l = db.listings.find(x => x.id === id);
        if (!l) {
            bad(404, 'Listing not found');
        }
        title = l.title;
        orgName = l.orgName;
    }
    db.reports = db.reports || [];
    const day = Date.now() - 864e5;
    const mine = db.reports.filter(x => x.userId === user.id);
    const had = mine.find(x => x.listingId === id);
    if (!had && mine.filter(x => Date.parse(x.created) > day).length >= r.MAX_PER_DAY) {
        bad(429, 'You have sent a lot of reports today. Thank you. Please try again tomorrow.', 'LIMIT');
    }
    const now = new Date().toISOString();
    if (had) { // sending again replaces the first report and puts it back in the queue
        Object.assign(had, { ...clean, title, orgName, created: now, status: 'open' });
    } else {
        db.reports.push({ id: uid(), listingId: id, userId: user.id, ...clean, title, orgName, created: now, status: 'open' });
    }
    save();
    return { ok: 1 };
});
// Staff close all open reports about one listing: 'dismissed' (nothing wrong) or 'actioned' (the listing was hidden or fixed).
R('PATCH', '/api/admin/reports/:id', MOD, ({ p, body: b }) => {
    if (!['dismissed', 'actioned'].includes(b.status)) {
        bad(400, 'Bad status');
    }
    let n = 0;
    for (const x of db.reports || []) {
        if (x.listingId === p[0] && x.status === 'open') {
            x.status = b.status;
            n++;
        }
    }
    save();
    return { ok: 1, closed: n };
});
