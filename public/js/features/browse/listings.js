import { S } from '../../core/state.js';
import { $ } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { card } from './card.js';
import { catKey, monogram } from './banner.js';
import { companyFor, isListed, careersCard } from './careers.js';
import { rankForMe } from '../suggestions/personal.js';
import { virtualCourses, virtualJobs, providerLinks, jobLinks, cleanQuery } from '../catalog/meta.js';
import { cityIn } from './place.js';
import { esc } from '../../core/dom.js';
import { byPlace, bySuit } from './filters.js';
import { preferFor, cleanStudy } from '../suggestions/study.js';
export const PAGE = 48; // cards drawn at a time; the next batch loads by itself as you scroll (see core/autoload.js)
const EMPTY = '<div class="empty"><b>No matches yet</b><p>Try fewer keywords, another category or a different location.</p><button class="button button-dark button-small" data-act="clear">Clear search</button></div>';
// The list after the category chip is applied.
export const visible = () => (S.cat ? (S.lall || []).filter(l => catKey(l) === S.cat) : (S.lall || []));
export function drawListings(n = PAGE) {
    const all = visible();
    S.lshown = n;
    // "Not listed on Fyndr" card for well-known companies (see careers.js): first item of the results, even when nothing else matched.
    const note = S.cnote || '';
    $('#grid').innerHTML = note + all.slice(0, n).map(l => card(l, S.smatch && S.smatch[l.id])).join('') + (all.length > n ? `<div class="more"><button class="button" data-act="more">Show more (${all.length - n})</button></div>` : '') || (note ? '' : EMPTY);
    $('#grid').removeAttribute('aria-busy');
    const c = $('#count');
    if (c) {
        c.textContent = (all.length ? `${all.length.toLocaleString()} ${all.length === 1 ? 'result' : 'results'}${S.fitSort ? ', best fit for your profile first' : ''}` : '') + (S.fnote ? (all.length ? ' · ' : '') + S.fnote : '');
    }
}
// Adds the next batch of cards under the ones already drawn (no full redraw, so the page does not jump or reload pictures).
export function drawMore() {
    const all = visible();
    const from = S.lshown || PAGE;
    const to = from + PAGE;
    const g = $('#grid');
    if (!g || from >= all.length) {
        return;
    }
    g.querySelector('.more')?.remove();
    g.insertAdjacentHTML('beforeend', all.slice(from, to).map(l => card(l, S.smatch && S.smatch[l.id])).join('') + (all.length > to ? `<div class="more"><button class="button" data-act="more">Show more (${all.length - to})</button></div>` : ''));
    S.lshown = to;
}
export async function loadListings(mineP) {
    $('#grid').setAttribute('aria-busy', 'true');
    $('#grid').innerHTML = '<div class="sk"></div>'.repeat(3);
    const type = S.f.type || (S.scope === 'courses' ? 'Course' : 'Job,Internship');
    const jobs = S.scope !== 'courses';
    const f = { ...S.f, type };
    if (jobs && S.pf.place === 'near') {
        delete f.loc; // the city typed there is where "near me" starts from, not a word the listing must contain
    }
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
    let [ls] = await Promise.all([api('/listings?' + qs), mineP]);
    S.fnote = '';
    S.smatch = null;
    S.fitSort = false;
    if (jobs) {
        ls = await byPlace(ls);
        if (S.pf.fit && S.me?.role === 'user' && S.me.onboarded) {
            ls = await bySuit(ls);
        }
    }
    S.lall = S.pf.fit && jobs && S.fitSort ? ls : await forMe(ls);
    if (!S.fitSort && !S.f.q && S.me?.role === 'user' && S.me.onboarded) {
        // no search and no "suitable for me" ranking: put what suits their year and semester first (internships early on, jobs near the end; UG or PG courses)
        try {
            const { profile } = await api('/profile');
            S.lall = preferFor(S.lall, cleanStudy(profile));
        } catch { }
    }
    S.cnote = await careersNote(ls);
    if (S.scope === 'courses' && cleanQuery(S.f.q).length > 1) {
        // Whatever was typed gets a card: a link row for every provider, and (when few courses matched) one card per provider for that exact search.
        S.cnote = courseFind(S.f.q, ls.length);
        if (ls.length < 12) {
            const have = new Set(ls.map(x => x.id));
            S.lall = S.lall.concat(virtualCourses(S.f.q).filter(x => !have.has(x.id)));
        }
    }
    if (jobs && cleanQuery(S.f.q).length > 1) {
        // Same for jobs: whatever was typed gets a link row for every job board, and (when few jobs matched) one card per board for that exact search.
        const city = cityIn(S.f.loc);
        S.cnote = jobFind(S.f.q, city && city[0], ls.length) + (S.cnote || '');
        if (ls.length < 12 && S.pf.place !== 'near') {
            const have = new Set(ls.map(x => x.id));
            S.lall = S.lall.concat(virtualJobs(S.f.q, city && city[0]).filter(x => !have.has(x.id) && (!S.f.type || x.type === S.f.type)));
        }
    }
    drawListings();
}
// "Looking for X?" card for the Jobs page: where to find openings for anything searched, whether or not Fyndr lists it.
function jobFind(q, city, found) {
    const t = cleanQuery(q);
    return `<article class="cfind"><h3>Looking for “${esc(t)}”${city ? ' in ' + esc(city) : ''}?</h3><p>${found ? `${found.toLocaleString()} matching ${found === 1 ? 'listing is' : 'listings are'} below. ` : 'Nothing on Fyndr matches this exact search yet, but you can look on any of these. '}Each link opens that job board's own live search, so you see what is open today.</p>
<div class="cf-links">${jobLinks(t, city).map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow"><b>${esc(n)}</b><span>live search</span></a>`).join('')}</div></article>`;
}
// "Looking for X?" card for the Courses page: where to find a course on anything searched, whether or not Fyndr lists it.
function courseFind(q, found) {
    const t = cleanQuery(q);
    return `<article class="cfind"><h3>Looking for “${esc(t)}”?</h3><p>${found ? `${found.toLocaleString()} matching ${found === 1 ? 'course is' : 'courses are'} below. ` : 'Fyndr has no listing for this exact topic yet, but you can find it on any of these. '}Each link opens that provider’s own search for it, so you can compare level, price and certificate there.</p>
<div class="cf-links">${providerLinks(t).map(([n, what, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow"><b>${esc(n)}</b><span>${esc(what)}</span></a>`).join('')}</div></article>`;
}
// Card telling people that a big company they searched for hires on its own careers page. Only on the jobs page, only when the search
// names such a company and Fyndr has no real openings from it. (When the Internships / Jobs tab is on, the other kind is checked too,
// so the card never claims "nothing here" about a company whose jobs are just hidden by the tab.)
async function careersNote(shown) {
    const c = S.scope === 'courses' ? null : companyFor(S.f.q);
    if (!c) {
        return '';
    }
    let rows = shown;
    if (S.f.type) {
        try {
            rows = await api('/listings?' + new URLSearchParams({ q: S.f.q, type: 'Job,Internship' }));
        } catch { }
    }
    return isListed(c, rows) ? '' : careersCard(c, monogram);
}
// A search by a signed-in candidate with a finished profile comes back in the order that fits them best, with a match % on each card.
// Browsing without a search keeps the normal newest-first order, and so does the Courses page.
async function forMe(ls) {
    S.smatch = null;
    S.fitSort = false;
    if (S.scope === 'courses' || !S.f.q || S.me?.role !== 'user' || !S.me.onboarded) {
        return ls;
    }
    try {
        const { profile } = await api('/profile');
        const r = rankForMe(ls, profile, S.f.q);
        if (Object.keys(r.match).length) {
            S.smatch = r.match;
            S.fitSort = true;
            return r.rows;
        }
    } catch { } // the plain list is still fine
    return ls;
}
