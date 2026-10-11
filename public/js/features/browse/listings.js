import { S } from '../../core/state.js';
import { $ } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { card } from './card.js';
const PAGE = 24; // cards drawn at a time (keeps the page light when there are many listings)
const EMPTY = '<div class="empty"><b>No matches yet</b><p>Try fewer keywords or a different location.</p><button class="button button-dark button-small" data-act="clear">Clear search</button></div>';
export function drawListings(n = PAGE) {
    const all = S.lall || [];
    S.lshown = n;
    $('#grid').innerHTML = all.slice(0, n).map(l => card(l)).join('') + (all.length > n ? `<div class="more"><button class="button" data-act="more">Show more (${all.length - n})</button></div>` : '') || EMPTY;
    $('#grid').removeAttribute('aria-busy');
}
export async function loadListings(mineP) {
    $('#grid').setAttribute('aria-busy', 'true');
    $('#grid').innerHTML = '<div class="sk"></div>'.repeat(3);
    const type = S.f.type || (S.scope === 'courses' ? 'Course' : 'Job,Internship');
    const qs = new URLSearchParams(Object.entries({ ...S.f, type }).filter(([, v]) => v)).toString();
    const [ls] = await Promise.all([api('/listings?' + qs), mineP]);
    S.lall = ls;
    drawListings();
}
