import { S } from '../../core/state.js';
import { $, esc, LOGO } from '../../core/dom.js';
import { fb } from '../../services/firebase/firebase-init.js';
export const avatar = (m, big) => m.photo ? `<img class="who-av${big ? ' big' : ''}" src="${m.photo}" alt="">` : `<span class="who-av${big ? ' big' : ''}">${esc((m.orgName || m.name || m.email || '?')[0].toUpperCase())}</span>`;
export const markNav = r => document.querySelectorAll('.nav-links a').forEach(a => {
    const on = a.dataset.r === (['login', 'register', 'forgot'].includes(r) ? '' : r);
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
});
export function nav() {
    $('#nav').innerHTML = `<a class="logo" href="#/">${LOGO}Fyndr</a><div class="nav-links">${S.me ? `<a href="#/jobs" data-r="jobs">Jobs &amp; Internships</a><a href="#/courses" data-r="courses">Courses</a>` : '<a href="#/organizations" data-r="organizations">For organizations</a>'}</div>
<div class="nav-actions"><button class="icon-btn" data-act="theme" aria-label="Toggle dark mode">◐</button>${S.me ? `<div class="me-wrap"><button class="who" data-act="me" aria-haspopup="dialog" aria-expanded="false" aria-label="Your profile">${avatar(S.me)}<span class="who-name">${esc(S.me.orgName || S.me.name)}</span></button></div>${S.me.role !== 'admin' ? (S.me.phoneVerified ? '<span class="tag tag-verified">Phone verified</span>' : '<a class="tag tag-warn" href="#/phone">Verify phone</a>') : ''}`
        : fb.user() ? `<button class="button button-dark button-small" data-act="logout">Log out</button>` : `<button class="button button-dark button-small" data-act="auth" data-mode="signin">Sign in</button>`}</div>`;
}
