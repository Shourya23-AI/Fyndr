// How long a listing stays open. Imported ones go stale faster. Older ones are closed (status 'closed' + closedAt),
// which also starts the retention clock for their applications.
export const LIFE_DAYS = { import: 45, posted: 90 };
export const isExpired = (l, nowMs = Date.now()) => l.status === 'approved' && nowMs - Date.parse(l.created || 0) > (l.source === 'import' ? LIFE_DAYS.import : LIFE_DAYS.posted) * 864e5;
