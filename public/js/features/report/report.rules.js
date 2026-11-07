// "Report this listing": what a report may contain and how reports are grouped for the staff. Pure functions, no DOM and no network.
// Shared by the browser (report.actions.js, admin dashboard, fire-api.js) and the Node server (server/routes/report.routes.js loads this file).
export const REASONS = [
    ['scam', 'Asks me to pay money or a fee'],
    ['id', 'Asks for ID, bank details or an OTP'],
    ['fake', 'Fake company or misleading'],
    ['closed', 'Already closed, or the link is broken'],
    ['other', 'Something else']
];
export const REASON_KEYS = REASONS.map(r => r[0]);
export const reasonText = k => (REASONS.find(r => r[0] === k) || [k, k])[1];
export const SEVERE = ['scam', 'id', 'fake']; // reasons that are about harm to the student, not about a stale listing
export const MAX_PER_DAY = 10; // reports one person can send in 24 hours (the Node server enforces it; Firebase-only mode relies on one report per person per listing)
export const NOTE_MAX = 300;
// Search links (the built-in catalog) are not stored anywhere, so reports about them carry their own title.
export const isCatalogId = id => /^cat_[a-z0-9_]{3,60}$/i.test(String(id || ''));
const one = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
// -> { reason, note } or null when the reason is not one of the five.
export function cleanReport(b) {
    const reason = one(b && b.reason, 10);
    if (!REASON_KEYS.includes(reason)) {
        return null;
    }
    return { reason, note: one(b && b.note, NOTE_MAX) };
}
export const cleanTitle = v => one(v, 120);
export const cleanOrg = v => one(v, 80);
// The report document id in Firebase-only mode: one per person per listing, so sending again replaces the first report.
export const reportId = (listingId, uid) => String(listingId) + '_' + String(uid);
// Open reports grouped by listing, most urgent first: more people and more serious reasons come first.
// rows: [{ listingId, userId, reason, note, title, orgName, created, status }]  ->  [{ listingId, title, orgName, count, severe, reasons: {scam: 2, ...}, notes: [...], last }]
export function groupReports(rows) {
    const by = new Map();
    for (const r of rows || []) {
        if (!r || r.status !== 'open') {
            continue;
        }
        const g = by.get(r.listingId) || { listingId: r.listingId, title: r.title || '', orgName: r.orgName || '', count: 0, severe: 0, reasons: {}, notes: [], last: '' };
        g.count++;
        g.severe += SEVERE.includes(r.reason) ? 1 : 0;
        g.reasons[r.reason] = (g.reasons[r.reason] || 0) + 1;
        if (r.note && g.notes.length < 5) {
            g.notes.push(r.note);
        }
        g.last = String(r.created || '') > g.last ? String(r.created || '') : g.last;
        by.set(r.listingId, g);
    }
    return [...by.values()].sort((a, b) => b.severe - a.severe || b.count - a.count || b.last.localeCompare(a.last));
}
