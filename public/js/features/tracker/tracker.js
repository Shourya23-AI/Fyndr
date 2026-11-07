// Application tracker: Saved -> Applied -> Interview -> Offer (or Closed), with a note and a follow-up date per item.
// It lives on THIS device (localStorage, one list per signed-in person), so it works for any listing: a Fyndr listing, a company's own
// openings page, or a job board search card. Nothing here is sent to Fyndr or to anyone else. Clearing browser data clears it.
export const STAGES = [['saved', 'Saved'], ['applied', 'Applied'], ['interview', 'Interview'], ['offer', 'Offer'], ['closed', 'Closed']];
export const stageName = k => (STAGES.find(s => s[0] === k) || STAGES[0])[1];
const KEY = uid => 'fyndr-tracker:' + String(uid || 'me').slice(0, 80);
const T = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const today = (nowMs = Date.now()) => new Date(nowMs).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const safeUrl = u => (/^https:\/\/[^\s]+$/i.test(String(u || '')) ? String(u).slice(0, 500) : '');

export function load(uid, store = globalThis.localStorage) {
    try {
        const a = JSON.parse(store.getItem(KEY(uid)));
        return Array.isArray(a) ? a.filter(x => x && typeof x.id === 'string' && STAGES.some(s => s[0] === x.stage)) : [];
    } catch {
        return [];
    }
}
export function save(uid, list, store = globalThis.localStorage) {
    try {
        store.setItem(KEY(uid), JSON.stringify(list.slice(0, 500)));
        return true;
    } catch {
        return false;
    }
}
// A follow-up date is suggested when an item moves forward: a week after applying, two days after an interview.
export const suggestRemind = (stage, from = today()) => (stage === 'applied' ? addDays(from, 7) : stage === 'interview' ? addDays(from, 2) : '');
const mk = (id, t, nowMs) => ({ id, title: T(t.title, 120), org: T(t.org, 80), type: T(t.type, 20), url: safeUrl(t.url), stage: 'saved', note: '', remind: '', added: today(nowMs), history: [] });

// list + a listing (or typed details) -> list. Adding an item that is already there only moves its stage forward when asked.
export function add(list, t, stage = 'saved', nowMs = Date.now()) {
    const id = T(t.id, 80) || 'm_' + nowMs.toString(36) + Math.random().toString(36).slice(2, 6);
    if (!T(t.title, 120)) {
        return list;
    }
    const i = list.findIndex(x => x.id === id);
    const cur = i >= 0 ? list[i] : mk(id, t, nowMs);
    const next = setStage(i >= 0 ? list.map(x => (x.id === id ? cur : x)) : [...list, cur], id, stage, nowMs);
    return next;
}
export function setStage(list, id, stage, nowMs = Date.now()) {
    if (!STAGES.some(s => s[0] === stage)) {
        return list;
    }
    return list.map(x => {
        if (x.id !== id || x.stage === stage) {
            return x;
        }
        const remind = x.remind || suggestRemind(stage, today(nowMs));
        return { ...x, stage, remind: stage === 'offer' || stage === 'closed' ? '' : remind, history: [...(x.history || []), { stage, at: today(nowMs) }].slice(-20) };
    });
}
export const setNote = (list, id, note) => list.map(x => (x.id === id ? { ...x, note: T(note, 600) } : x));
export const setRemind = (list, id, day) => list.map(x => (x.id === id ? { ...x, remind: DAY.test(day || '') ? day : '' } : x));
export const remove = (list, id) => list.filter(x => x.id !== id);
export const find = (list, id) => list.find(x => x.id === id);

// Follow-ups due today or earlier (only for items still in play), oldest first.
export const due = (list, nowMs = Date.now()) => list.filter(x => x.remind && x.remind <= today(nowMs) && !['offer', 'closed'].includes(x.stage)).sort((a, b) => a.remind.localeCompare(b.remind));
export const counts = list => Object.fromEntries(STAGES.map(([k]) => [k, list.filter(x => x.stage === k).length]));

// Fyndr applications (made on Fyndr itself) show on the board too, as read-only items. The organization's status maps to a stage.
const FY = { applied: 'applied', reviewing: 'applied', interview: 'interview', accepted: 'offer', rejected: 'closed' };
export const fromFyndr = apps => (apps || []).filter(a => a && a.listing).map(a => ({
    id: 'fy_' + a.id, title: T(a.listing.title, 120), org: T(a.listing.orgName, 80), type: T(a.listing.type, 20), url: '', stage: FY[a.status] || 'applied', note: '', remind: '', added: String(a.created || '').slice(0, 10), history: [], fyndr: true
}));
