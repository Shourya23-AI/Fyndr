// The jobs page filter row: WHERE (Anywhere / Near me / Remote) and FIT (Suitable for me), plus the work that turns them into a list.
import { S } from '../../core/state.js';
import { rankForMe } from '../suggestions/personal.js';
import { nearRows, remoteRows, originFrom, locate, NEAR_KM } from './place.js';
import { isActive } from '../listings/refine.js';
const PLACES = [['any', 'Anywhere'], ['near', 'Near me'], ['remote', 'Remote']];
export const filterRow = () => `<div class="jf" role="group" aria-label="Filter jobs">${PLACES.map(([k, t]) => `<button type="button" class="jf-b ${S.pf.place === k ? 'on' : ''}" data-act="place" data-id="${k}" aria-pressed="${S.pf.place === k}">${t}</button>`).join('')}<span class="jf-sep" aria-hidden="true"></span><button type="button" class="jf-b jf-fit ${S.pf.fit ? 'on' : ''}" data-act="fit" aria-pressed="${S.pf.fit}">Suitable for me</button></div>`;
export const paintFilters = () => {
    document.querySelectorAll('.jf [data-act=place]').forEach(b => {
        b.classList.toggle('on', b.dataset.id === S.pf.place);
        b.setAttribute('aria-pressed', String(b.dataset.id === S.pf.place));
    });
    const f = document.querySelector('.jf [data-act=fit]');
    if (f) {
        f.classList.toggle('on', S.pf.fit);
        f.setAttribute('aria-pressed', String(S.pf.fit));
    }
};
let device; // the city found from this device's position, kept in memory only for this visit
export const hooks = { profile: null }; // (tests replace this)
const profileOf = async () => {
    try {
        return hooks.profile ? await hooks.profile() : (await (await import('../../core/api.js')).api('/profile')).profile || null;
    } catch {
        return null;
    }
};
// rows -> rows for the chosen place. Sets S.fnote (the line shown under the heading).
export async function byPlace(rows) {
    const mode = S.pf.place;
    S.fnote = '';
    S.pf.city = ''; // the city job-board links should look in (set below for "Near me")
    if (mode === 'remote') {
        S.fnote = 'Remote and work-from-home only';
        return remoteRows(rows);
    }
    if (mode !== 'near') {
        return rows;
    }
    let profileLocations = '';
    if (!S.f.loc && !device && S.me?.role === 'user') {
        profileLocations = ((await profileOf()) || {}).locations || '';
    }
    let o = originFrom({ typed: S.f.loc, device, profileLocations });
    if (!o || o.how === 'profile') {
        const here = await locate(); // asks the browser; a "no" falls back to the profile city
        if (here.city) {
            device = here.city;
            o = { city: here.city, how: 'device' };
        } else if (!o) {
            S.fnote = here.far ? 'Your location is far from the cities we list. Type a city in the Location box, or pick Anywhere or Remote.' : 'Allow location, or type a city in the Location box, to see jobs near you.';
            return [];
        }
    }
    S.pf.city = o.city[0];
    const out = nearRows(rows, o.city);
    S.fnote = `Within ${NEAR_KM} km of ${o.city[0]}${o.how === 'device' ? ' (found from your device, never stored)' : o.how === 'profile' ? ' (from your profile)' : ''}${out.length ? '' : '. Nothing here yet: try Anywhere or Remote'}`;
    return out;
}
// rows -> only the ones that suit this person, best first (match % on each card). Needs a signed-in candidate with a finished profile.
export async function bySuit(rows) {
    const profile = await profileOf();
    const r = rankForMe(rows, profile, S.f.q);
    if (!Object.keys(r.match).length) {
        S.fnote = (S.fnote ? S.fnote + ' · ' : '') + 'Add skills to your profile to see jobs that suit you';
        return rows;
    }
    S.smatch = r.match;
    S.fitSort = true;
    const jobs = r.rows.filter(l => l.type !== 'Course');
    const good = jobs.filter(l => (r.match[l.id] || {}).score >= 45);
    const shown = good.length >= 6 ? good : jobs.slice(0, 20); // few strong matches: show the closest ones instead of an empty page
    S.fnote = (S.fnote ? S.fnote + ' · ' : '') + (good.length >= 6 ? 'Only jobs that suit your profile' : 'Closest matches to your profile');
    return shown;
}

// Second row: stipend / duration / source for jobs, price / certificate / source for courses. data-act="rf", data-id="key:value".
const GROUPS = {
    jobs: [['Source', 'src', [['', 'All'], ['direct', 'Direct from company']]], ['Stipend', 'pay', [['', 'Any'], ['any', 'Stated'], ['10', '₹10k+/mo'], ['25', '₹25k+/mo']]], ['Duration', 'dur', [['', 'Any'], ['short', 'Up to 2 mo'], ['mid', '3 to 6 mo'], ['long', '6+ mo']]]],
    courses: [['Price', 'price', [['', 'Any'], ['free', 'Has free option'], ['allfree', 'Fully free']]], ['Source', 'src', [['', 'All']]]]
};
export const refineRow = scope => {
    const courses = scope === 'courses';
    const g = GROUPS[courses ? 'courses' : 'jobs'].filter(x => x[2].length > 1);
    const btn = (k, v, t) => `<button type="button" class="jf-b ${(S.rf[k] || '') === v ? 'on' : ''}" data-act="rf" data-id="${k}:${v}" aria-pressed="${(S.rf[k] || '') === v}">${t}</button>`;
    const flag = (k, t) => `<button type="button" class="jf-b ${S.rf[k] ? 'on' : ''}" data-act="rf" data-id="${k}:flag" aria-pressed="${!!S.rf[k]}">${t}</button>`;
    return `<div class="jf rf" role="group" aria-label="More filters">${g.map(([label, k, opts], i) => `${i ? '<span class="jf-sep" aria-hidden="true"></span>' : ''}<span class="rf-l">${label}</span>${opts.map(([v, t]) => btn(k, v, t)).join('')}`).join('')}${courses ? flag('cert', 'Has certificate') : flag('remote', 'Remote only')}${isActive(S.rf) ? '<button type="button" class="jf-b rf-clear" data-act="rfclear">Clear filters</button>' : ''}</div>`;
};
