// Which applications have outlived the retention rules (see features/privacy/retention.js and the Privacy Policy).
//   - older than maxApplicationDays, or
//   - for a listing that was closed (status 'closed' + closedAt) more than closedListingDays ago.
import { RETENTION } from '../../features/privacy/retention.js';

const DAY = 864e5;
const ms = v => {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
};
export function expiredApps(apps, listings, nowMs = Date.now()) {
    const byId = new Map(listings.map(l => [l.id, l]));
    return apps.filter(a => {
        const made = ms(a.created);
        if (made !== null && nowMs - made > RETENTION.maxApplicationDays * DAY) {
            return true;
        }
        const l = byId.get(a.listingId);
        const closed = l && l.status === 'closed' ? ms(l.closedAt) : null;
        return closed !== null && nowMs - closed > RETENTION.closedListingDays * DAY;
    });
}
