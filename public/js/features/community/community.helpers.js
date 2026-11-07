// Small pure helpers shared by Communities and Groups (no DOM, no network, so they are easy to test).
export const LIMITS = { name: 60, desc: 300, post: 1000, groupMax: 50 };
const EMAIL = /^[^\s@,;<>"'()[\]\\]+@[^\s@,;<>"'()[\]\\]+\.[^\s@,;<>"'()[\]\\]{2,}$/;
// One line of plain text, at most n characters.
export const oneLine = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
// A message: keeps line breaks, trims blank runs, at most LIMITS.post characters.
export const cleanPost = s => String(s ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, LIMITS.post);
// "A@x.com, b@y.com; nonsense" -> { good: ['a@x.com', 'b@y.com'], bad: ['nonsense'] }  (lower case, no repeats)
export function parseEmails(text) {
    const good = [];
    const bad = [];
    for (const raw of String(text ?? '').split(/[\s,;]+/)) {
        const e = raw.trim().toLowerCase();
        if (!e) {
            continue;
        }
        if (EMAIL.test(e) && e.length <= 120) {
            if (!good.includes(e)) {
                good.push(e);
            }
        } else if (!bad.includes(raw.trim())) {
            bad.push(raw.trim());
        }
    }
    return { good, bad };
}
// "just now", "5 min ago", "3 h ago", "2 days ago", or a date for older posts. 0 / missing = "just now" (the server time is still being set).
export function when(ms, now = Date.now()) {
    if (!ms) {
        return 'just now';
    }
    const s = Math.max(0, Math.round((now - ms) / 1000));
    if (s < 45) {
        return 'just now';
    }
    if (s < 3600) {
        return Math.max(1, Math.round(s / 60)) + ' min ago';
    }
    if (s < 86400) {
        return Math.round(s / 3600) + ' h ago';
    }
    if (s < 7 * 86400) {
        const d = Math.round(s / 86400);
        return d + (d === 1 ? ' day ago' : ' days ago');
    }
    return new Date(ms).toLocaleDateString();
}
export const plural = (n, one, many) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
