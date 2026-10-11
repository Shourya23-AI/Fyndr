import { route } from './core/router.js';
import { bindEvents } from './core/events.js';
import { S } from './core/state.js';
import { fb } from './services/firebase/firebase-init.js';
import { $ } from './core/dom.js';
import { skeleton, skeletonFor } from './core/skeleton.js';
import { nav } from './features/layout/nav.js';
import { dashboard } from './features/dashboard/dashboard.js';
import { clearApiCache } from './core/api.js';
import { cachedMe } from './features/auth/load-me.js';
// Entry point. Draw the shell INSTANTLY from what this device remembers (header + page-shaped placeholders),
// then wire up events and let route() fill in the real page as soon as Firebase and the server have answered.
const hint = cachedMe();
if (hint) {
    S.me = hint; // only a hint for the header; route() replaces it with the real profile
}
nav();
$('#app').innerHTML = skeleton(skeletonFor(location.hash.slice(2), !!hint));
bindEvents();
addEventListener('hashchange', route);
route();

// Keep dashboards current: refetch when you come back to the tab and every 20 seconds while one is open.
// Skipped while you are typing or choosing something, so it never interrupts an edit.
const refreshDashboard = () => {
    const el = document.activeElement;
    if (document.hidden || !S.me || !location.hash.startsWith('#/dashboard') || (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName))) {
        return;
    }
    clearApiCache();
    dashboard().catch(() => {});
};
document.addEventListener('visibilitychange', refreshDashboard);
addEventListener('focus', refreshDashboard);
setInterval(refreshDashboard, 20000);

// Static hosting without a server (e.g. GitHub Pages with no server address set): data would only live in this browser.
// Say so clearly instead of letting devices silently disagree.
fb.ready().then(() => {
    if (fb.local && !/^(localhost|127\.|\[::1\])/.test(location.hostname)) {
        const bar = document.createElement('div');
        bar.className = 'demo-banner';
        bar.textContent = 'Demo mode: no server is connected, so data stays on THIS device only (other devices will not see it). Set the server address in index.html (see README, "GitHub Pages").';
        document.body.prepend(bar);
    }
});
