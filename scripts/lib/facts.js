// Facts read from a posting's own words: how long an internship lasts, what stipend it states, whether it is remote.
// Only what the text clearly says is returned; otherwise '' (never guessed). Run tests:  node test/refine.test.js
const NUM = s => Number(String(s).replace(/,/g, ''));
function durationFrom(text) {
    const t = String(text || '').slice(0, 4000);
    const m = t.match(/\b(\d{1,2})\s*(?:[-\u2013]|to)\s*(\d{1,2})[\s-]*(months?|weeks?)\b/i) || t.match(/\b(\d{1,2})[\s-]*(months?|weeks?)\b(?:\s+(?:internship|duration|long|program))?/i);
    if (!m) { return ''; }
    const range = m.length === 4;
    const unit = (range ? m[3] : m[2]).toLowerCase().replace(/s$/, '');
    const a = +m[1], b = range ? +m[2] : 0;
    const max = Math.max(a, b);
    if (!max || (unit === 'month' && max > 24) || (unit === 'week' && max > 52)) { return ''; }
    return range ? `${a}-${b} ${unit}s` : `${a} ${unit}${a === 1 ? '' : 's'}`;
}
function stipendFrom(text) {
    const t = String(text || '').slice(0, 4000);
    const m = t.match(/(?:stipend|salary|ctc|pay)[^.\n\u20b9]{0,40}(?:\u20b9|INR|Rs\.?)\s*([\d,]{4,9})(?:\s*(?:[-\u2013]|to)\s*(?:\u20b9|INR|Rs\.?)?\s*([\d,]{4,9}))?\s*(?:\/|per\s+)?\s*(month|mo|year|annum|yr|lpa)?/i);
    if (!m) { return ''; }
    const lo = NUM(m[1]), hi = m[2] ? NUM(m[2]) : 0;
    const per = /^(year|annum|yr|lpa)$/i.test(m[3] || '') ? 'year' : 'month';
    if (!lo || lo < 1000) { return ''; }
    return `INR ${lo}${hi > lo ? '-' + hi : ''} / ${per}`;
}
const remoteFrom = (location, text) => /remote|work from home|wfh/i.test(String(location || '')) || /\b(fully remote|100% remote|work from home)\b/i.test(String(text || '').slice(0, 1500));
// Lever's salaryRange, Ashby's compensation summary, Greenhouse's pay_input_ranges -> "CUR lo-hi / unit"
const cur = c => String(c || '').toUpperCase();
const unitOf = i => (/year|annual/i.test(i || '') ? 'year' : /month/i.test(i || '') ? 'month' : /hour/i.test(i || '') ? 'hour' : '');
function payFromLever(j) { const r = j && j.salaryRange; return r && r.min ? `${cur(r.currency)} ${r.min}${r.max > r.min ? '-' + r.max : ''}${unitOf(r.interval) ? ' / ' + unitOf(r.interval) : ''}`.trim() : ''; }
function payFromGreenhouse(j) { const r = j && j.pay_input_ranges && j.pay_input_ranges[0]; return r && r.min_cents ? `${cur(r.currency_type)} ${Math.round(r.min_cents / 100)}${r.max_cents > r.min_cents ? '-' + Math.round(r.max_cents / 100) : ''} / year` : ''; }
const payFromAshby = j => String((j && j.compensation && j.compensation.compensationTierSummary) || '').slice(0, 80);
module.exports = { durationFrom, stipendFrom, remoteFrom, payFromLever, payFromGreenhouse, payFromAshby };
