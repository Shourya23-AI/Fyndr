import { S } from '../../core/state.js';
import { esc } from '../../core/dom.js';
import { card } from '../browse/card.js';
import { suggestFor } from './engine.js';
import { confidenceOf } from './insights.js';
// "For you" page of the candidate dashboard: where you stand, your strengths, the role you are closest to, jobs and internships to apply to,
// a short learning roadmap with courses, and what to add to your profile. Worked out in the browser from the profile the person typed.
const FIRST = 6;
const cards = rows => rows.map(({ l, m }) => {
    S.match[l.id] = m;
    return card(l, m);
}).join('');
const RING = { strong: 'var(--green)', good: 'var(--green)', building: 'var(--muted)' };

export function foryouTab(d, listings, { lastSeen = 0 } = {}) {
    const head = '<div class="dash-head"><h2>For you</h2><p class="desc">Jobs, internships and courses matched to your qualifications, skills and preferences.</p></div>';
    const p = d.profile || {};
    if (!S.me.onboarded) {
        return `${head}<div class="nudge"><div><h3>Finish your profile to see your matches</h3><p class="desc">Add your qualification, skills and the places you would work in. Browsing and applying never need this.</p></div><a class="button button-dark button-small" href="#/profile">Complete profile</a></div>`;
    }
    S.match = {};
    const r = suggestFor(p, listings, { saved: S.mine.saved, applied: S.mine.applications.map(a => a.listingId), lastSeen, limit: 200, courseLimit: 12 });
    const c = confidenceOf(p, r);
    const tips = c.tips.length ? `<div class="panel fy-tips"><h3>Make your profile work harder</h3><ul>${c.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul><a class="button button-small" href="#/profile">Update profile</a></div>` : '';
    if (!r.ready) {
        return `${head}<div class="panel fy-hero"><div><h3>Add your skills to unlock matches</h3><p class="desc">We rank jobs and courses by the skills you list. Add at least a few, and we will show what fits you and what to learn next.</p></div></div>${tips}`;
    }
    const n = S.fyn || FIRST;
    const jobs = r.picks.slice(0, n);
    const good = c.counts.strong + c.counts.good;
    const strengths = c.strengths.length ? `<p class="fy-line"><span>Your strengths</span>${c.strengths.map(s => `<b class="why-tag on" title="Asked for by ${s.count} of your top matches">${esc(s.label)}</b>`).join('')}</p>` : '';
    const next = c.next ? `<p class="fy-line"><span>Learn next</span><b class="why-tag add">${esc(c.next.label)}</b><i>${esc(c.next.text)}</i></p>` : '';
    const hero = `<div class="panel fy-hero" data-level="${c.level}"><div class="fy-ring" style="--c:${RING[c.level]}"><b>${good}</b><span>good or better</span></div><div class="fy-hero-text"><h3>${esc(c.headline)}</h3><p class="desc">${esc(c.sub)}</p>${strengths}${next}</div></div>`;
    const closest = c.closest ? `<div class="panel fy-closest"><div><h3>Closest to ready</h3><p><b>${esc(c.closest.l.title)}</b> · ${esc(c.closest.l.orgName)}</p><p class="desc">${esc(c.closest.text)}</p></div><button class="button button-dark button-small" data-act="view" data-id="${c.closest.l.id}">See details</button></div>` : '';
    S.match[c.closest?.l.id] = c.closest?.m;
    const jobsHtml = jobs.length
        ? `<h3 class="fy-h">Jobs and internships for you</h3><div class="opportunity-grid">${cards(jobs)}</div>${r.picks.length > n ? `<div class="more"><button class="button" data-act="fymore">Show more (${r.picks.length - n})</button></div>` : ''}`
        : '<div class="empty"><b>No strong matches yet</b><p>Follow the learning steps below and add more skills, and they will appear.</p></div>';
    const steps = c.steps.slice(0, 3).map((u, i) => `<div class="fy-step"><div class="fy-step-head"><span class="fy-num">${i + 1}</span><div><b>Learn ${esc(u.label)}</b><p class="desc">Asked for by ${u.count} of your closest matches.</p></div></div>${u.courses.length ? `<div class="opportunity-grid">${cards(u.courses)}</div>` : '<p class="desc fy-nocourse">No course for this is listed yet. New courses are added automatically, so check back soon.</p>'}</div>`).join('');
    const road = steps ? `<h3 class="fy-h">Your learning roadmap</h3><p class="desc">The fastest way to more and better matches, in order.</p>${steps}` : '';
    const shown = new Set(c.steps.slice(0, 3).flatMap(u => u.courses.map(x => x.l.id)));
    const more = r.courses.filter(x => !shown.has(x.l.id)).slice(0, 6);
    const coursesHtml = more.length ? `<h3 class="fy-h">More courses picked for you</h3><div class="opportunity-grid">${cards(more)}</div>` : '';
    return `${head}${hero}${closest}${jobsHtml}${road}${coursesHtml}${tips}<p class="sg-note">Matched on your device from the details you typed. No resume is read and no AI is involved. A match is a guide, not a promise.</p>`;
}
