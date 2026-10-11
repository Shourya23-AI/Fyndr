import { S } from '../../core/state.js';
import { $ } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { card } from './card.js';
import { catKey, monogram } from './banner.js';
import { companyFor, isListed, careersCard } from './careers.js';
import { rankForMe } from '../suggestions/personal.js';
const PAGE = 24; // cards drawn at a time (keeps the page light when there are many listings)
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
        c.textContent = all.length ? `${all.length.toLocaleString()} ${all.length === 1 ? 'result' : 'results'}${S.fitSort ? ', best fit for your profile first' : ''}` : '';
    }
}
export async function loadListings(mineP) {
    $('#grid').setAttribute('aria-busy', 'true');
    $('#grid').innerHTML = '<div class="sk"></div>'.repeat(3);
    const type = S.f.type || (S.scope === 'courses' ? 'Course' : 'Job,Internship');
    const qs = new URLSearchParams(Object.entries({ ...S.f, type }).filter(([, v]) => v)).toString();
    const [ls] = await Promise.all([api('/listings?' + qs), mineP]);
    S.lall = await forMe(ls);
    S.cnote = await careersNote(ls);
    drawListings();
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
