import { $, esc } from '../../core/dom.js';
import { isStaff } from '../../core/state.js';
// Landing page for people who are signed in (the page the Fyndr logo opens): a greeting, the next steps, the career guide, and quiet ways back into the site.
// Nothing here about signing up or in. (Signed-out visitors get the page in landing.js, which has no career guide.)
// Set in its own typefaces (Young Serif for headings, Onest for text; loaded in index.html and applied only inside .mh, see css/components/member.css).
const LINKS = [
    ['#/jobs', 'Jobs & Internships', 'Openings matched to your skills and your stage of study.'],
    ['#/courses', 'Courses', 'Free and paid courses from 16 providers.'],
    ['#/library', 'Library', 'Free books to read online, with a reader built in.'],
    ['#/community', 'Community', 'Ask questions and learn from other students.'],
    ['#/groups', 'Groups', 'Study and interest groups you can chat in.'],
    ['#/liked', 'Liked', 'Everything you saved, in one place.']
];
// These four really are a sequence, so they are numbered.
const STEPS = [
    ['Tell the guide your dream job', 'guide-jump', ''],
    ['Keep your skills up to date', '', '#/profile'],
    ['Find openings that match you', '', '#/jobs'],
    ['Follow your applications', '', '#/dashboard']
];
const step = ([t, act, href], i) => {
    const inner = `<i>${i + 1}</i><span>${t}</span>`;
    return `<li>${act ? `<button type="button" class="mh-step" data-act="${act}">${inner}</button>` : `<a class="mh-step" href="${href}">${inner}</a>`}</li>`;
};

export function memberLanding(me) {
    const first = String(me.orgName || me.name || '').trim().split(/\s+/)[0];
    const hi = first ? `Good to see you, ${esc(first)}.` : 'Welcome back.';
    if (me.role !== 'user') {
        const go = isStaff(me) || me.role === 'org' ? '#/dashboard' : '#/jobs';
        $('#app').innerHTML = `<div class="lp mh"><header class="container mh-top mh-solo"><div class="mh-hello"><h1>${hi}</h1><p>Everything for your account is in your dashboard.</p><div class="mh-actions"><a class="btn-primary" href="${go}">Open your dashboard</a></div></div></header></div>`;
        import('../../core/motion.js').then(m => m.landingMotion());
        return;
    }
    const verify = me.phoneVerified ? '' : '<a class="mh-note" href="#/phone">One more step: verify your phone number to apply for roles. <u>Verify now</u></a>';
    $('#app').innerHTML = `<div class="lp mh">
<header class="container mh-top"><div class="mh-hello"><h1>${hi}</h1><p>Pick up where you left off, or tell the career guide your dream job and see what to learn first.</p>
<div class="mh-actions"><a class="btn-primary" href="#/jobs">Browse jobs &amp; internships</a><a class="mh-textlink" href="#/courses">Explore courses</a></div>${verify}</div>
<nav class="mh-next" aria-label="Your next steps"><h2>Your next steps</h2><ol class="mh-steps">${STEPS.map(step).join('')}</ol></nav></header>
<section class="container lp-guide" id="guide" aria-label="Career guide"></section>
<section class="container mh-jump" aria-labelledby="mh-jump-h"><h2 id="mh-jump-h">Jump back in</h2><ul class="mh-list">${LINKS.map(l => `<li><a class="mh-link" href="${l[0]}"><b>${l[1].replace('&', '&amp;')}</b><span>${l[2]}</span></a></li>`).join('')}</ul></section>
<footer class="container mh-foot"><a class="link" href="#/profile">Edit your profile</a><a class="link" href="#/dashboard">Open your dashboard</a></footer></div>`;
    import('../../core/motion.js').then(m => m.landingMotion());
    import('../guide/guide.view.js').then(m => m.mountGuide(me)).catch(() => { });
}
