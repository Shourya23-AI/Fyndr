// Notifications (Part 3, step 2): the rules. Pure functions: no DOM, no network.
// Two kinds of notice, both worked out on this device from data the person can already read, so no backend or Firestore rules change:
//   status  an organization moved one of your Fyndr applications (reviewing, interview, accepted, rejected)
//   match   a listing posted since your last check fits your profile (the same engine as "For you", at "good" or better)
// The inbox is kept in localStorage, one per account (`fyndr-inbox:<account>`). Clearing browser data clears it.
export const MAX_ITEMS = 50;
export const CHECK_GAP = 10 * 60e3; // look for news at most every 10 minutes
export const MATCH_MIN = 50; // "good" or better
export const MATCH_SHOWN = 3; // single notices per check; the rest become one "and N more" notice
export const KEY = uid => 'fyndr-inbox:' + String(uid || 'me').slice(0, 80);
const T = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const num = v => (Number.isFinite(+v) ? +v : 0);

export const STATUS_NOTE = {
    reviewing: ['is being reviewed', 'The organization has started reviewing your application.'],
    interview: ['moved to interview', 'You are through to the interview stage. Check your email and phone for the next step.'],
    accepted: ['was accepted', 'Congratulations. The organization accepted your application.'],
    rejected: ['was not selected', 'The organization chose not to continue this time. Your other applications and matches are unaffected.']
};

export const newBox = (now = Date.now()) => ({ v: 1, items: [], seen: {}, since: now, checked: 0, prefs: { match: true } });

// Anything stored on the device is untrusted: rebuild it field by field.
export function cleanBox(raw, now = Date.now()) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const box = newBox(now);
    box.since = num(raw.since) > 0 && num(raw.since) <= now + 864e5 ? num(raw.since) : now;
    box.checked = num(raw.checked) > 0 ? num(raw.checked) : 0;
    box.prefs = { match: !(raw.prefs && raw.prefs.match === false) };
    if (raw.seen && typeof raw.seen === 'object') {
        for (const [k, v] of Object.entries(raw.seen).slice(0, 500)) {
            if (typeof v === 'string') {
                box.seen[T(k, 80)] = T(v, 20);
            }
        }
    }
    box.items = (Array.isArray(raw.items) ? raw.items : []).filter(x => x && typeof x.id === 'string' && x.id).slice(0, MAX_ITEMS).map(x => ({
        id: T(x.id, 120), kind: x.kind === 'match' ? 'match' : 'status', title: T(x.title, 140), text: T(x.text, 240), at: num(x.at), read: !!x.read, go: x.go === 'foryou' ? 'foryou' : 'apps'
    }));
    return box;
}
export function loadBox(store, uid, now = Date.now()) {
    try {
        return cleanBox(JSON.parse(store.getItem(KEY(uid))), now);
    } catch {
        return null;
    }
}
export function saveBox(store, uid, box) {
    try {
        store.setItem(KEY(uid), JSON.stringify(box));
        return true;
    } catch {
        return false;
    }
}

// Applications ({ id, status, listing: { title, orgName } }) against the statuses seen last time.
// First time ever (seen is null) only records where things stand, so nobody is greeted by a pile of old news.
// "applied" is where every application starts, so it is never news. A withdrawn application drops out of `seen`.
export function statusEvents(apps, seen, now = Date.now()) {
    const list = (Array.isArray(apps) ? apps : []).filter(a => a && typeof a.id === 'string' && typeof a.status === 'string');
    const next = {};
    const events = [];
    for (const a of list) {
        next[a.id] = a.status;
        if (!seen || seen[a.id] === a.status || !STATUS_NOTE[a.status]) {
            continue;
        }
        const [verb, text] = STATUS_NOTE[a.status];
        const title = T(a.listing && a.listing.title, 100) || 'Your application';
        const org = T(a.listing && a.listing.orgName, 60);
        events.push({ id: `st:${a.id}:${a.status}`, kind: 'status', title: `${title}${org ? ' at ' + org : ''} ${verb}`.slice(0, 140), text, at: now, read: false, go: 'apps' });
    }
    return { events, seen: next };
}

// picks = suggestFor(...).picks computed with lastSeen = the time of the previous check, so m.isNew means "posted since then".
export function matchEvents(picks, now = Date.now(), since = 0) {
    const fresh = (Array.isArray(picks) ? picks : []).filter(x => x && x.l && x.l.id && x.m && x.m.isNew && x.m.score >= MATCH_MIN).sort((a, b) => b.m.score - a.m.score);
    const events = fresh.slice(0, MATCH_SHOWN).map(({ l, m }) => ({
        id: `ls:${l.id}`, kind: 'match', title: `New match: ${T(l.title, 100)}`, text: `${T(l.orgName, 60) || 'An organization'} · ${Math.round(m.score)}% match with your skills and preferences.`, at: now, read: false, go: 'foryou'
    }));
    const more = fresh.length - events.length;
    if (more > 0) {
        events.push({ id: `lsmore:${Math.floor(num(since) / 6e4)}`, kind: 'match', title: `${more} more new match${more === 1 ? '' : 'es'} for you`, text: 'Open For you to see every listing that fits your profile.', at: now, read: false, go: 'foryou' });
    }
    return events;
}

// New events go on top; an id already in the inbox is never added twice (so a repeated check does not repeat a notice).
export function merge(box, events, now = Date.now()) {
    const have = new Set(box.items.map(x => x.id));
    const add = events.filter(e => !have.has(e.id));
    return { ...box, items: [...add, ...box.items].sort((a, b) => b.at - a.at).slice(0, MAX_ITEMS), checked: now };
}
export const unread = box => (box ? box.items.filter(x => !x.read).length : 0);
export const markAllRead = box => ({ ...box, items: box.items.map(x => ({ ...x, read: true })) });
export const checkDue = (box, now = Date.now()) => !box || now - box.checked >= CHECK_GAP;

// Plain words for "5 minutes ago".
export function ago(at, now = Date.now()) {
    const s = Math.max(0, Math.round((now - at) / 1000));
    if (s < 60) {
        return 'just now';
    }
    const u = [[3600, 'minute', 60], [86400, 'hour', 3600], [604800, 'day', 86400]];
    for (const [lim, name, div] of u) {
        if (s < lim) {
            const n = Math.floor(s / div);
            return `${n} ${name}${n === 1 ? '' : 's'} ago`;
        }
    }
    return new Date(at).toISOString().slice(0, 10);
}
