// Consent-based usage counting. Only DAILY COUNTERS are sent (views, searches, empty-search words, saves, Apply clicks, skill names
// of viewed listings). No user id, no listing id, no timestamps per event. Nothing is sent unless the person said yes.
import { S } from '../../core/state.js';
import { api } from '../../core/api.js';
const KEY = 'fyndr-analytics';
const get = () => {
    try {
        return localStorage.getItem(KEY);
    } catch {
        return null;
    }
};
export const choice = () => get(); // 'yes' | 'no' | null (not asked yet)
export const setChoice = v => {
    try {
        localStorage.setItem(KEY, v ? 'yes' : 'no');
    } catch { }
    if (!v) {
        q = blank();
    }
};
const blank = () => ({ views: 0, searches: 0, emptySearches: 0, saves: 0, applyClicks: 0, empty: {}, skills: {} });
let q = blank();
let timer = 0;
export const flush = async () => {
    clearTimeout(timer);
    timer = 0;
    const out = q;
    q = blank();
    if (!S.me || choice() !== 'yes' || !Object.entries(out).some(([k, v]) => typeof v === 'number' ? v : Object.keys(v).length)) {
        return;
    }
    try {
        await api('/analytics', 'POST', out);
    } catch { } // counting must never bother the visitor
};
// term: only plain words (no digits, no @, no links) so a typed phone number or email is never kept.
const word = t => /^[a-z][a-z +#.-]{1,28}$/.test(t) && !/@|www|http/.test(t) ? t : '';
export function track(kind, o = {}) {
    if (choice() !== 'yes' || !S.me) {
        return;
    }
    if (kind === 'view') {
        q.views++;
        (o.skills || []).slice(0, 8).forEach(s => {
            q.skills[s.toLowerCase()] = (q.skills[s.toLowerCase()] || 0) + 1;
        });
    } else if (kind === 'search') {
        q.searches++;
        const w = word(String(o.term || '').trim().toLowerCase());
        if (o.empty) {
            q.emptySearches++;
            if (w) {
                q.empty[w] = (q.empty[w] || 0) + 1;
            }
        }
    } else if (kind === 'save') {
        q.saves++;
    } else if (kind === 'apply') {
        q.applyClicks++;
    }
    if (!timer) {
        timer = setTimeout(flush, 30000);
    }
}
document.addEventListener('visibilitychange', () => document.hidden && flush());
