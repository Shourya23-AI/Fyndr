import { S } from '../../core/state.js';
import { api } from '../../core/api.js';
import { suggestFor } from '../suggestions/engine.js';
import { loadBox, saveBox, newBox, statusEvents, matchEvents, merge, checkDue } from './notify.rules.js';
import { refreshBell } from './notify.bell.js';
// Looks for news: reads the person's applications, profile and the approved listings (the same three calls the dashboard makes),
// then adds notices to the inbox. Runs in the background, at most every 10 minutes, and never gets in the way of the page.
const uid = () => (S.me && (S.me.id || S.me.email)) || 'me';
let running = null;
export const eligible = () => !!S.me && S.me.role === 'user' && !!S.me.onboarded;
export function checkNow({ force = false } = {}) {
    if (!eligible()) {
        return Promise.resolve(false);
    }
    if (running) {
        return running;
    }
    const now = Date.now();
    const had = loadBox(localStorage, uid(), now);
    if (!force && !checkDue(had, now)) {
        refreshBell();
        return Promise.resolve(false);
    }
    running = (async () => {
        try {
            const [mine, d, ls] = await Promise.all([api('/my'), api('/profile'), api('/listings')]);
            const first = !had;
            const box = had || newBox(now);
            const st = statusEvents(mine.applications, first ? null : box.seen, now);
            let events = st.events;
            if (!first && box.prefs.match) {
                const r = suggestFor(d.profile || {}, ls, { saved: mine.saved || [], applied: (mine.applications || []).map(a => a.listingId), lastSeen: box.since, limit: 200, now });
                events = events.concat(matchEvents(r.picks, now, box.since));
            }
            const next = { ...merge(box, events, now), seen: st.seen, since: now };
            saveBox(localStorage, uid(), next);
            refreshBell();
            return true;
        } catch {
            return false; // notices are a bonus: a failed check is simply tried again later
        } finally {
            running = null;
        }
    })();
    return running;
}
