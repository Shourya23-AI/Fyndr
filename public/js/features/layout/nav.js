import { S, isStaff } from '../../core/state.js';
import { $, esc, LOGO } from '../../core/dom.js';
import { fb } from '../../services/firebase/firebase-init.js';
import { side, MENU_ICON } from './sidebar.js';
export const avatar = (m, big) => m.photo ? `<img class="who-av${big ? ' big' : ''}" src="${m.photo}" alt="">` : `<span class="who-av${big ? ' big' : ''}">${esc((m.orgName || m.name || m.email || '?')[0].toUpperCase())}</span>`;
export const markNav = r => document.querySelectorAll('.nav-links a, .side-links a').forEach(a => {
    const on = a.dataset.r === (['login', 'register', 'forgot'].includes(r) ? '' : r);
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
});
export function nav() {
    $('#nav').innerHTML = `<button class="menu-btn" data-act="menu" aria-label="Open menu" aria-expanded="false" aria-controls="side">${MENU_ICON}</button><a class="logo" href="#/">${LOGO}Fyndr</a><div class="nav-links">${S.me ? `<a href="#/jobs" data-r="jobs">Jobs &amp; Internships</a><a href="#/courses" data-r="courses">Courses</a><a href="#/library" data-r="library">Library</a><a href="#/community" data-r="community">Community</a><a href="#/groups" data-r="groups">Groups</a><a href="#/liked" data-r="liked">Liked</a>` : '<a href="#/library" data-r="library">Library</a><a href="#/organizations" data-r="organizations">For organizations</a>'}</div>
<div class="nav-actions"><button class="icon-btn" data-act="theme" aria-label="Toggle dark mode">◐</button>${S.me ? `<div class="me-wrap"><button class="who" data-act="me" aria-haspopup="dialog" aria-expanded="false" aria-label="Your profile">${avatar(S.me)}<span class="who-name">${esc(S.me.orgName || S.me.name)}</span></button></div>${!isStaff(S.me) ? (S.me.phoneVerified ? '<span class="tag tag-verified">Phone verified</span>' : '<a class="tag tag-warn" href="#/phone">Verify phone</a>') : ''}`
        : fb.user() ? `<button class="button button-dark button-small" data-act="logout">Log out</button>` : `<button class="button button-dark button-small" data-act="auth" data-mode="signin">Sign in</button>`}</div>`;
    side();
}
