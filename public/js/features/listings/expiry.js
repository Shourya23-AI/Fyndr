// How long a listing stays open (imported ones count from the last time the daily importer still saw them on the employer's page). Imported ones go stale faster. Older ones are closed (status 'closed' + closedAt),
// which also starts the retention clock for their applications.
export const LIFE_DAYS = { import: 45, posted: 90 };
export const isExpired = (l, nowMs = Date.now()) => l.status === 'approved' && nowMs - Date.parse((l.source === 'import' && l.lastSeen) || l.created || 0) > (l.source === 'import' ? LIFE_DAYS.import : LIFE_DAYS.posted) * 864e5;

// Hides expired listings from a list shown to candidates. A phone with a wrong clock (set far into the future) would think EVERYTHING is
// expired, so when 9 in 10 of at least 5 listings look expired the clock is assumed wrong and nothing is hidden. The daily sweep, which
// uses the server's clock, is what really closes them.
export function dropExpired(rows, nowMs = Date.now()) {
    const live = rows.filter(l => !isExpired(l, nowMs));
    return rows.length >= 5 && live.length < rows.length * 0.1 ? rows : live;
}
