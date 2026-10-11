import { S } from '../../core/state.js';
import { $, esc } from '../../core/dom.js';
import { skeleton } from '../../core/skeleton.js';
import { api } from '../../core/api.js';
import { railHTML, rail } from '../suggestions/rail.js';
import { loadListings } from './listings.js';
import { CAT_CHIPS } from './banner.js';
// Signed-in listing pages. scope 'jobs' = jobs + internships (#/jobs), scope 'courses' = courses only (#/courses).
export async function browse(scope = 'jobs') {
    if (S.scope !== scope) {
        S.f.type = '';
        S.cat = '';
    }
    S.scope = scope;
    const courses = scope === 'courses';
    // Saved items load IN PARALLEL with the listings; the page itself is drawn at once.
    const mineP = S.me?.role === 'user' ? api('/my').then(x => {
        S.mine = x;
    }).catch(() => { }) : Promise.resolve();
    const chips = `<div class="chips-row" role="group" aria-label="Category">${[['', 'All']].concat(CAT_CHIPS).map(([k, t]) => `<button class="chip-c ${(S.cat || '') === k ? 'on' : ''}" data-act="cat" data-id="${k}">${t}</button>`).join('')}</div>`;
    $('#app').innerHTML = `${railHTML()}<section class="hero hero-compact container"><div><h1>${courses ? 'Courses to build your skills' : 'Jobs &amp; internships for you'}</h1><p class="lead">${courses ? 'Free and paid courses for UG, PG and intern learners.' : 'Roles for students, freshers and interns, checked before you see them.'}</p>
<form class="search-box" data-form="search"><label class="search-field"><input name="q" type="search" aria-label="Search" placeholder="${courses ? 'Course, skill or provider' : 'Role, skill or company'}" value="${esc(S.f.q)}"></label><label class="search-field"><input name="loc" aria-label="Location" placeholder="Remote or city" value="${esc(S.f.loc)}"></label><button class="search-button">Search</button></form></div></section>
<section class="container page" id="browse"><div class="list-head"><div><h2>${courses ? 'All courses' : 'All jobs &amp; internships'}</h2><p class="desc"><span id="count"></span></p></div>${courses ? '' : `<div class="tabs">${[['', 'All'], ['Job', 'Jobs'], ['Internship', 'Internships']].map(([v, t]) => `<button class="${S.f.type === v ? 'active' : ''}" data-act="tab" data-id="${v}">${t}</button>`).join('')}</div>`}</div>${chips}<div class="opportunity-grid" id="grid"></div></section>`;
    mineP.then(() => rail()).catch(() => { });
    loadListings(mineP).catch(e => {
        console.error('Listings failed to load:', e);
        $('#grid').innerHTML = '<div class="empty"><b>Could not load listings</b><p>' + esc((e && e.message) || 'Check your connection and try again.') + '</p><button class="button button-dark button-small" data-act="clear">Retry</button></div>';
    });
}
