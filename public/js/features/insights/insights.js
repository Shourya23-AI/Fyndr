// Owner insights from DAILY COUNTERS only (no person, no event log). Pure functions, so they are easy to test.
import { skillsIn } from '../listings/summary.js';
const SUM = ['views', 'searches', 'emptySearches', 'saves', 'applyClicks'];
const addMap = (t, m) => Object.entries(m || {}).forEach(([k, v]) => {
    t[k] = (t[k] || 0) + (+v || 0);
});
export function aggregate(docs, listings, appsInPeriod, days, nowMs = Date.now()) {
    const since = new Date(nowMs - days * 864e5).toISOString().slice(0, 10);
    const t = { views: 0, searches: 0, emptySearches: 0, saves: 0, applyClicks: 0 };
    const empty = {};
    const demand = {};
    for (const d of docs.filter(x => x.id >= since)) {
        SUM.forEach(k => {
            t[k] += +d[k] || 0;
        });
        addMap(empty, d.empty);
        addMap(demand, d.skills);
    }
    const supply = {};
    for (const l of listings.filter(x => x.status === 'approved')) {
        skillsIn(`${l.title} ${l.description || ''}`).forEach(s => {
            supply[s.toLowerCase()] = (supply[s.toLowerCase()] || 0) + 1;
        });
    }
    const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
    const dem = Object.keys({ ...demand, ...supply }).map(k => ({ skill: k, views: demand[k] || 0, listings: supply[k] || 0 }));
    return {
        days, totals: t, applications: appsInPeriod, topEmpty: top(empty, 10),
        shortage: dem.filter(x => x.views > 0).sort((a, b) => (b.views / (b.listings + 1)) - (a.views / (a.listings + 1))).slice(0, 8),
        surplus: dem.filter(x => x.listings > 0).sort((a, b) => (b.listings / (b.views + 1)) - (a.listings / (a.views + 1))).slice(0, 5)
    };
}
const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : 'n/a';
// Written from totals only, with fixed sentences (no AI). Safe to paste in an email.
export function weeklyReport(a) {
    const t = a.totals;
    const L = [`Fyndr report for the last ${a.days} days (aggregate numbers only).`, ''];
    L.push(`Activity: ${t.views} listing views, ${t.searches} searches, ${t.saves} saves, ${t.applyClicks} Apply clicks, ${a.applications} applications sent on Fyndr.`);
    L.push(`Funnel: ${pct(t.applyClicks, t.views)} of views led to an Apply click; ${pct(a.applications, t.applyClicks)} of Apply clicks (on Fyndr jobs and imported ones together) became applications on Fyndr.`);
    L.push(`Searches that found nothing: ${t.emptySearches} of ${t.searches} (${pct(t.emptySearches, t.searches)}).`);
    if (a.topEmpty.length) {
        L.push('Most common empty searches: ' + a.topEmpty.slice(0, 5).map(([k, v]) => `"${k}" (${v})`).join(', ') + '. Consider adding listings for these.');
    }
    if (a.shortage.length) {
        L.push('Skills people look at more than we have listings for: ' + a.shortage.slice(0, 5).map(x => `${x.skill} (${x.views} views, ${x.listings} listings)`).join(', ') + '.');
    }
    if (a.surplus.length) {
        L.push('Skills with plenty of listings and little interest: ' + a.surplus.slice(0, 3).map(x => `${x.skill} (${x.listings} listings, ${x.views} views)`).join(', ') + '.');
    }
    if (!t.views && !t.searches) {
        L.push('No usage was counted yet. Counting only starts after a visitor says yes to the usage-count question.');
    }
    return L.join('\n');
}
