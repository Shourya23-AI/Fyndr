import { $ } from '../../core/dom.js';
import { SPEC } from './specimen.js';
// Logged-out home page: hero, ticker, three chapters, numbers, categories, closing wordmark.
const G = (id, a, b) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;
const ICONS = [
    `<svg viewBox="0 0 120 120" aria-hidden="true">${G('g1', '#8fc4a8', '#3f7a5f')}<path d="M60 12 100 26v30c0 28-17 46-40 54C37 102 20 84 20 56V26z" fill="url(#g1)"/><path d="M60 22 90 32v24c0 22-13 36-30 43-17-7-30-21-30-43V32z" fill="#fff" opacity=".18"/><path d="m42 60 13 13 25-27" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    `<svg viewBox="0 0 120 120" aria-hidden="true">${G('g2', '#8fc4a8', '#3f7a5f')}<circle cx="56" cy="64" r="42" fill="url(#g2)"/><circle cx="56" cy="64" r="29" fill="#fff" opacity=".9"/><circle cx="56" cy="64" r="18" fill="#4f8a6f"/><circle cx="56" cy="64" r="7" fill="#fff"/><path d="M58 62 100 20m0 0h-16m16 0v16" fill="none" stroke="#2d3330" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    `<svg viewBox="0 0 120 120" aria-hidden="true">${G('g3', '#8fc4a8', '#3f7a5f')}<path d="M10 56 108 14 76 106 54 72z" fill="url(#g3)"/><path d="M54 72 108 14 62 62z" fill="#fff" opacity=".28"/><path d="M54 72 52 98 66 82" fill="#2f6b4f"/></svg>`
];
const CHAPTERS = [
    ['Honest labels', 'Every card says where it comes from.', 'Posts from organizations are reviewed by our team before they go live. Openings read from company career pages are marked Direct from company and close when the company removes them. Search links only open a job board or course site, and we do not vouch for what you find there.', ['Posted on Fyndr: reviewed first', 'Direct from company: closes automatically', 'Search links: marked, never rated']],
    ['Matched', 'See where you actually stand.', 'Add your skills once. Fyndr compares them with open roles on your own device and tells you which ones fit and what is missing.', ['A match score for every role', 'The exact skills you still need', 'Courses that close the gap']],
    ['Applied', 'Apply without the guesswork.', 'Save what you like, apply from your profile, and follow each application from one dashboard.', ['One profile for every application', 'Save jobs and courses', 'Track every status in one place']]
];
const CATS = ['Software', 'Data & AI', 'Design', 'Marketing', 'Finance', 'Core engineering'];
const TICK = ['Every card shows its source', 'Internships', 'Jobs', 'Courses', 'Free for students', 'Find work worth doing'];
const ticker = () => { const t = TICK.map(x => `<span>${x}</span>`).join(''); return `<div class="lp-tick" aria-hidden="true"><div class="lp-tick-in">${t}${t}${t}${t}</div></div>`; };
export function landing(me) {
    const go = me ? (me.role === 'user' ? '#/jobs' : '#/dashboard') : '';
    const ctaMain = me ? `<a class="btn-primary" href="${go}">${me.role === 'user' ? 'Continue to jobs' : 'Open your dashboard'}</a>` : '<button class="btn-primary" data-act="auth" data-mode="signup">Create a free account</button>';
    $('#app').innerHTML = `<div class="lp">
<section class="container lp-hero"><div class="lp-copy"><h1>Find work worth doing</h1><p class="lead">Internships, jobs and courses in one place: reviewed posts from organizations, openings straight from company career pages, and links to job boards and course sites. Free for students.</p>
${me ? `<a class="btn-primary lp-go" href="${go}">${me.role === 'user' ? 'Continue to jobs' : 'Open your dashboard'}</a>` : `<form class="lp-search" role="search" onsubmit="return false"><input type="search" aria-label="Search by role or city" placeholder="Search a role or city…" /><button type="submit" class="btn-primary" data-act="auth" data-mode="signup">Find</button></form>`}
<p class="desc">Hiring? <a class="link" href="#/organizations">Register your organization</a>${me ? '' : ' · Have an account? <button class="link" data-act="auth" data-mode="signin">Sign in</button>'}</p></div>
<div class="lp-visual"><img src="img/students.jpg" width="1330" height="628" alt="Students working together on laptops" /><div class="lp-card">${SPEC()}</div></div></section>
${ticker()}
<section class="container lp-chapters">${CHAPTERS.map((c, i) => `<article class="lp-ch"><div class="lp-ico">${ICONS[i]}</div><div><span class="lp-n">0${i + 1}</span><h2>${c[0]}</h2><h3>${c[1]}</h3><p>${c[2]}</p><ul>${c[3].map(x => `<li>${x}</li>`).join('')}</ul></div></article>`).join('')}</section>
<section class="container lp-nums"><div><b data-count="7900" data-suf="+">7,900+</b><span>jobs and courses to browse</span></div><div><b data-count="16">16</b><span>course providers</span></div><div><b data-count="4">4</b><span>job boards searched</span></div></section>
<section class="container lp-cats"><h2>Start with what you study</h2><div>${CATS.map(c => `<button data-act="auth" data-mode="signup">${c}</button>`).join('')}</div></section>
<section class="lp-end"><div class="container"><div class="lp-word" aria-hidden="true">Fyndr</div><div class="cta">${ctaMain}<a class="btn-line" href="#/organizations">For organizations</a></div></div></section></div>`;
    import('../../core/motion.js').then(m => m.landingMotion());
}
