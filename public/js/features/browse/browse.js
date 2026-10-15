import { S } from '../../core/state.js';
import { $, esc } from '../../core/dom.js';
import { skeleton } from '../../core/skeleton.js';
import { api } from '../../core/api.js';
import { railHTML, rail } from '../suggestions/rail.js';
import { loadListings } from './listings.js';
import { CAT_CHIPS } from './banner.js';
import { searchTerms } from '../suggestions/personal.js';
import { filterRow } from './filters.js';
import { adviceFor, cleanStudy } from '../suggestions/study.js';
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
<form class="search-box" data-form="search"><label class="search-field"><input name="q" type="search" aria-label="Search" placeholder="${courses ? 'Course, skill or provider' : 'Role, skill or company'}" value="${esc(S.f.q)}"></label><label class="search-field"><input name="loc" aria-label="Location" placeholder="Remote or city" value="${esc(S.f.loc)}"></label><button class="search-button">Search</button></form>${courses ? '' : '<div class="try-row" id="try" hidden></div>' + filterRow()}</div></section>
<section class="container page" id="browse"><div class="list-head"><div><h2>${courses ? 'All courses' : 'All jobs &amp; internships'}</h2><p class="desc"><span id="count"></span></p></div>${courses ? '' : `<div class="tabs">${[['', 'All'], ['Job', 'Jobs'], ['Internship', 'Internships']].map(([v, t]) => `<button class="${S.f.type === v ? 'active' : ''}" data-act="tab" data-id="${v}">${t}</button>`).join('')}</div>`}</div>${chips}<div class="opportunity-grid" id="grid"></div></section>`;
    mineP.then(() => rail()).catch(() => { });
    tryChips(courses);
    studyStrip();
    loadListings(mineP).catch(e => {
        console.error('Listings failed to load:', e);
        $('#grid').innerHTML = '<div class="empty"><b>Could not load listings</b><p>' + esc((e && e.message) || 'Check your connection and try again.') + '</p><button class="button button-dark button-small" data-act="clear">Retry</button></div>';
    });
}

// "Try:" searches made from the person's own profile (skills, headline, field, city), shown under the search box.
async function tryChips(courses) {
    if (courses || S.me?.role !== 'user' || !S.me.onboarded) {
        return;
    }
    try {
        const { profile } = await api('/profile');
        const el = $('#try');
        const terms = searchTerms(profile, S.f.q);
        if (el && terms.length) {
            el.innerHTML = '<span>Try:</span>' + terms.map(t => `<button type="button" class="try-chip" data-act="trysearch" data-id="${esc(t)}">${esc(t)}</button>`).join('');
            el.hidden = false;
        }
    } catch { } // chips are a nicety
}

// "For your semester" strip: what suits the person's year of study, as one-tap searches. Shown on both pages for signed-in candidates who gave their year.
async function studyStrip() {
    if (S.me?.role !== 'user' || !S.me.onboarded) {
        return;
    }
    try {
        const { profile } = await api('/profile');
        const a = adviceFor(cleanStudy(profile));
        const host = document.querySelector('.hero > div');
        if (!a || !host || document.getElementById('study')) {
            return;
        }
        const t = S.scope === 'courses' ? a.topics : a.topics.slice(0, 6).map(x => x);
        host.insertAdjacentHTML('beforeend', `<div class="try-row" id="study"><span><b>${esc(a.label)}</b>: ${esc(a.title)}.</span>${t.map(x => `<button type="button" class="try-chip" data-act="trysearch" data-id="${esc(x)}">${esc(x)}</button>`).join('')}</div>`);
    } catch { } // a nicety
}
