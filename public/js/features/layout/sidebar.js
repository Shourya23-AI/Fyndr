import { S, isStaff } from '../../core/state.js';
import { esc, LOGO } from '../../core/dom.js';
import { fb } from '../../services/firebase/firebase-init.js';
// Phone menu: a sidebar that slides in from the left (opened by the three-lines button in the top bar). On a wide screen the same links sit in the top bar instead.
const I = {
    jobs: '<path d="M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8M3 13h18"/>',
    courses: '<path d="M3 9.5 12 5l9 4.5-9 4.5zM7 12v4.2c0 1 2.2 2.3 5 2.3s5-1.3 5-2.3V12"/>',
    library: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v17H5.5A1.5 1.5 0 0 0 4 21.5zM20 4.5A1.5 1.5 0 0 0 18.5 3H13v17h5.5a1.5 1.5 0 0 1 1.5 1.5z"/>',
    groups: '<path d="M12 3 4 6v5.5c0 4.5 3.2 8 8 9.5 4.8-1.5 8-5 8-9.5V6zM9 12l2 2 4-4"/>',
    community: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6a3 3 0 0 1 0 6M17.5 14.2A5.5 5.5 0 0 1 21 19"/>',
    liked: '<path d="M12 20.5S3.5 15 3.5 9.3A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 2.7C20.5 15 12 20.5 12 20.5z"/>',
    dash: '<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/>',
    me: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    org: '<path d="M4 20V6l8-3 8 3v14M9 20v-5h6v5M8 9h2M14 9h2M8 12h2M14 12h2"/>',
    theme: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    doc: '<path d="M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h5M9.5 15.5h5"/>',
    lock: '<path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
    mail: '<path d="M4 6h16v12H4zM4 7l8 6 8-6"/>',
    get: '<path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14"/>',
    out: '<path d="M10 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M15 8l4 4-4 4M19 12H9"/>',
    in: '<path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M9 8l-4 4 4 4M5 12h10"/>'
};
const ic = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;
const link = (href, r, k, text) => `<a href="${href}" data-r="${r}" data-act="sideclose">${ic(k)}<span>${text}</span></a>`;
export const MENU_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

function html() {
    const me = S.me;
    const main = [link('#/jobs', 'jobs', 'jobs', 'Jobs &amp; Internships'), link('#/courses', 'courses', 'courses', 'Courses'), link('#/library', 'library', 'library', 'Library')];
    if (me) {
        main.push(link('#/community', 'community', 'community', 'Community'), link('#/groups', 'groups', 'groups', 'Groups'), link('#/liked', 'liked', 'liked', 'Liked'));
    }
    const more = me
        ? [link('#/dashboard', 'dashboard', 'dash', 'Dashboard'), me.role === 'user' ? link('#/profile', 'profile', 'me', 'My profile') : '']
        : [link('#/organizations', 'organizations', 'org', 'For organizations')];
    const who = me ? `<div class="side-who"><b>${esc(me.orgName || me.name || me.email || '')}</b><span>${esc(me.email || '')}</span></div>` : '';
    const sign = me || fb.user() ? `<button data-act="logout">${ic('out')}<span>Log out</span></button>` : `<button data-act="auth" data-mode="signin">${ic('in')}<span>Sign in</span></button>`;
    return `<div class="side-back" data-act="sideclose"></div>
<aside class="side" id="side" aria-label="Menu" inert><div class="side-top"><a class="logo" href="#/" data-act="sideclose">${LOGO}Fyndr</a><button class="icon-btn side-x" data-act="sideclose" aria-label="Close menu">✕</button></div>${who}
<nav class="side-links" aria-label="Main">${main.join('')}</nav><nav class="side-links side-more" aria-label="Account">${more.join('')}</nav>
<nav class="side-links side-legal" aria-label="Legal">${link('#/terms', 'terms', 'doc', 'Terms &amp; Conditions')}${link('#/privacy', 'privacy', 'lock', 'Privacy Policy')}${link('#/contact', 'contact', 'mail', 'Contact Us')}</nav>
<div class="side-foot"><button data-act="theme">${ic('theme')}<span>Dark / light mode</span></button>${sign}<div class="side-end"><span>© 2026 Fyndr</span><button class="install-btn install-round" type="button" data-act="install-app" aria-label="Get the app" title="Get the app">${ic('get')}</button></div></div></aside>`;
}
export function side() {
    let root = document.getElementById('side-root');
    if (!root) {
        root = document.createElement('div');
        root.id = 'side-root';
        document.body.append(root);
    }
    root.className = '';
    root.innerHTML = html();
    document.querySelectorAll('[data-act=menu]').forEach(b => b.setAttribute('aria-expanded', 'false'));
}
export const sideOpen = () => !!document.querySelector('#side-root.open');
export function openSide() {
    const root = document.getElementById('side-root');
    if (!root) {
        return;
    }
    root.classList.add('open');
    root.querySelector('.side').removeAttribute('inert');
    document.body.classList.add('side-lock');
    document.querySelectorAll('[data-act=menu]').forEach(b => b.setAttribute('aria-expanded', 'true'));
    const first = root.querySelector('.side-links a');
    first && first.focus({ preventScroll: true });
}
export function closeSide(refocus) {
    const root = document.getElementById('side-root');
    if (!root || !root.classList.contains('open')) {
        return;
    }
    root.classList.remove('open');
    root.querySelector('.side').setAttribute('inert', '');
    document.body.classList.remove('side-lock');
    const btn = document.querySelector('[data-act=menu]');
    btn && btn.setAttribute('aria-expanded', 'false');
    if (refocus && btn) {
        btn.focus({ preventScroll: true });
    }
}
