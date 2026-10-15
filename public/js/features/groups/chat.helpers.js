// Pure helpers for the group chat window (no DOM, no network).
import { oneLine } from '../community/community.helpers.js';
import { esc } from '../../core/dom.js';
import { shareLine } from '../share/share.js';
export const QUICK = ['👍', '❤️', '😂', '😮', '🙏', '🎉'];
export const EMOJI = '😀 😁 😂 🤣 😊 😍 😘 😎 🤔 😅 😢 😭 😡 🙌 👏 👍 👎 🙏 💪 🎉 🔥 ✨ ❤️ 💯 ✅ ❌ 📚 💼 📌 📎 ⏰ 🍕 ☕ 🚀 🎯 👀 🤝 😴 🥳 😇'.split(' ');
export const hue = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 360;
export const clock = ms => new Date(ms || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const dayKey = ms => { const d = new Date(ms || Date.now()); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
export function dayLabel(ms, now = Date.now()) {
    const d = new Date(ms || now);
    const n = new Date(now);
    const midnight = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((midnight(n) - midnight(d)) / 864e5);
    return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString([], { day: 'numeric', month: 'short', year: diff > 300 ? 'numeric' : undefined });
}
// A poll from the form: question + 2 to 6 different options.
export function cleanPoll({ q, opts, multi }) {
    const question = oneLine(q, 200);
    const list = [...new Set((opts || []).map(o => oneLine(o, 80)).filter(Boolean))].slice(0, 6);
    if (question.length < 2) {
        throw new Error('Type the poll question.');
    }
    if (list.length < 2) {
        throw new Error('A poll needs at least 2 different options.');
    }
    return { q: question, opts: list, multi: !!multi };
}
// -> { counts: [n per option], voters, mine: [indexes] }
export function tally(poll, votes, uid) {
    const counts = poll.opts.map(() => 0);
    let voters = 0;
    for (const v of Object.values(votes || {})) {
        const picks = Array.isArray(v) ? v.filter(i => Number.isInteger(i) && i >= 0 && i < counts.length) : [];
        picks.length && voters++;
        picks.forEach(i => counts[i]++);
    }
    const mine = Array.isArray((votes || {})[uid]) ? votes[uid] : [];
    return { counts, voters, mine };
}
// emoji -> { n, mine }
export function reactionCounts(reactions, uid) {
    const out = {};
    for (const [u, e] of Object.entries(reactions || {})) {
        if (e) {
            out[e] = out[e] || { n: 0, mine: false };
            out[e].n++;
            out[e].mine ||= u === uid;
        }
    }
    return out;
}
export const snippet = p => (p.text ? oneLine(p.text, 80) : p.img ? '📷 Photo' : p.poll ? '📊 ' + oneLine(p.poll.q, 70) : p.share ? '🔖 ' + shareLine(p.share) : '');
// The first letter of a name, upper case and safe for HTML (the round letter badge of a group, a community or a person).
export const initial = s => esc((String(s || '?').trim()[0] || '?').toUpperCase());
