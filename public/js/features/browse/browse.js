import { S } from '../../core/state.js';
import { $, esc, TICK } from '../../core/dom.js';
import { skeleton } from '../../core/skeleton.js';
import { api } from '../../core/api.js';
import { SPEC } from '../home/specimen.js';
import { suggest } from '../suggestions/suggest.js';
import { loadListings } from './listings.js';
// Signed-in listing pages. scope 'jobs' = jobs + internships (#/jobs), scope 'courses' = courses only (#/courses).
export async function browse(scope = 'jobs') {
    if (S.scope !== scope) {
        S.f.type = '';
    }
    S.scope = scope;
    const courses = scope === 'courses';
    // Saved items load IN PARALLEL with the listings; the page itself is drawn at once.
    const mineP = S.me?.role === 'user' ? api('/my').then(x => {
        S.mine = x;
    }).catch(() => { }) : Promise.resolve();
    $('#app').innerHTML = `<section class="hero container"><div>${courses ? '<h1>Courses from organizations we have checked.</h1><p class="lead">Learn a skill with providers our team has verified. Every course listing is reviewed before it appears.</p>' : '<h1>Every listing is checked before you see it.</h1><p class="lead">Internships and jobs from organizations our team has verified. Apply without second-guessing.</p>'}
<form class="search-box" data-form="search"><label class="search-field"><input name="q" type="search" aria-label="Search" placeholder="${courses ? 'Course, skill or provider' : 'Role, skill or company'}" value="${esc(S.f.q)}"></label><label class="search-field"><input name="loc" aria-label="Location" placeholder="Remote or city" value="${esc(S.f.loc)}"></label><button class="search-button">Search</button></form>
</div>
${courses ? '' : SPEC()}</section>
${S.me?.role === 'user' && !courses ? '<section class="container sugg" id="sugg"></section>' : ''}<section class="container page" id="browse"><h2>${courses ? 'Latest courses' : 'Jobs &amp; internships'}</h2><p class="desc">Every listing here has been reviewed.</p>${courses ? '' : `<div class="tabs">${[['', 'All'], ['Job', 'Jobs'], ['Internship', 'Internships']].map(([v, t]) => `<button class="${S.f.type === v ? 'active' : ''}" data-act="tab" data-id="${v}">${t}</button>`).join('')}</div>`}<div class="opportunity-grid" id="grid"></div></section>
${courses ? '' : `<section class="container how"><h2>Four checks between a posting and your screen.</h2><div class="rows">${[['Verified organization', 'A person on our team confirms who the organization is before it can post.'], ['Reviewed listing', 'New postings wait in a review queue and appear only after an admin approves them.'], ['Confirmed email', 'Every account verifies its email address before it can do anything.'], ['Confirmed phone', 'Candidates verify a phone before applying, organizations before posting. One number, one account.']].map(([t, d]) => `<div class="row"><span class="ck">${TICK}</span><b>${t}</b><p>${d}</p></div>`).join('')}</div></section>`}`;
    if (S.me?.role === 'user' && !courses) {
        mineP.then(() => suggest()).catch(() => { });
    }
    loadListings(mineP).catch(() => {
        $('#grid').innerHTML = '<div class="empty"><b>Could not load listings</b><p>Check your connection and try again.</p><button class="button button-dark button-small" data-act="clear">Retry</button></div>';
    });
}
