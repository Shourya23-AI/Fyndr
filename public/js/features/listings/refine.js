// Filters for stipend, duration, remote, price and certificate, plus "Direct from company". Pure functions: rows in, rows out.
// Honest rule: a listing that does not STATE a stipend or duration (every search-link card) is hidden when that filter is on, never guessed.
import { isSearch, originOf } from './origin.js';
import { tierOf, hasCertificate } from '../catalog/group.js';

export const EMPTY_RF = { src: '', pay: '', dur: '', price: '', cert: false, remote: false };
export const isActive = rf => !!rf && Object.keys(EMPTY_RF).some(k => rf[k] && rf[k] !== EMPTY_RF[k]);

// Monthly rupees from pay text like "INR 15000-25000 / month", "Rs 20,000 per month", "INR 6-9 LPA" (lowest figure). null = not stated.
export function monthlyPay(pay) {
    const t = String(pay || '');
    const m = t.match(/(?:INR|Rs\.?|\u20b9)\s*([\d,]+(?:\.\d+)?)/i);
    if (!m) { return null; }
    let n = Number(m[1].replace(/,/g, ''));
    if (!(n > 0)) { return null; }
    if (/lpa|lakh/i.test(t)) { n *= 100000; }
    return /year|annum|yr|lpa|lakh/i.test(t) ? n / 12 : /hour/i.test(t) ? null : n;
}
// {min,max} in months from "3 months", "2-6 months", "12 weeks"; null when not stated ("Self-paced" has no length).
export function monthsOf(duration) {
    const m = String(duration || '').match(/(\d{1,2})\s*(?:[-\u2013]|to)?\s*(\d{1,2})?\s*(month|week)/i);
    if (!m) { return null; }
    const k = /week/i.test(m[3]) ? 1 / 4.345 : 1;
    const a = +m[1] * k, b = (m[2] ? +m[2] : +m[1]) * k;
    return { min: Math.min(a, b), max: Math.max(a, b) };
}
export const isRemoteListing = l => l.remote === true || /remote|work from home|anywhere/i.test(String(l.location || ''));
const free = l => (l.links ? !!l.free : /^free/i.test(String(l.pay || '')));
const fullyFree = l => (l.links ? !!l.allFree : tierOf(l.pay) === 'free');
const hasCert = l => (l.links ? !!l.cert : hasCertificate(l.pay) || /certificate/i.test(String(l.description || '')));

const PAY = { any: 1, '10': 10000, '25': 25000 };
const DUR = { short: [0, 2], mid: [3, 6], long: [6, 99] }; // months
export function refine(rows, rf) {
    if (!isActive(rf)) { return rows; }
    return rows.filter(l => {
        if (rf.src === 'direct' && originOf(l).k !== 'direct') { return false; }
        if (rf.remote && !isRemoteListing(l)) { return false; }
        if (rf.pay) {
            const p = isSearch(l) ? null : monthlyPay(l.pay);
            if (p === null || p < (PAY[rf.pay] === 1 ? 1 : PAY[rf.pay] || 1)) { return false; }
        }
        if (rf.dur) {
            const d = isSearch(l) ? null : monthsOf(l.duration);
            const [lo, hi] = DUR[rf.dur] || [0, 99];
            if (!d || d.max < lo || d.min > hi) { return false; }
        }
        if (rf.price === 'free' && !free(l)) { return false; }
        if (rf.price === 'allfree' && !fullyFree(l)) { return false; }
        if (rf.cert && !hasCert(l)) { return false; }
        return true;
    });
}
// A line saying what the filters left out and why.
export function refineNote(rf, before, after) {
    if (!isActive(rf)) { return ''; }
    const hid = before - after;
    const why = rf.pay || rf.dur ? ' Search-link cards are hidden because they do not state a stipend or duration.' : '';
    return `Filters on: ${after.toLocaleString()} of ${before.toLocaleString()} shown.${hid > 0 ? why : ''}`;
}
