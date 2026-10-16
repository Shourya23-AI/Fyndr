import { route } from './core/router.js';
import { bindEvents } from './core/events.js';
import { S } from './core/state.js';
import { $ } from './core/dom.js';
import { skeleton, skeletonFor } from './core/skeleton.js';
import { nav } from './features/layout/nav.js';
import { dashboard } from './features/dashboard/dashboard.js';
import { clearApiCache } from './core/api.js';
import { cachedMe } from './features/auth/load-me.js';
import { initReveal } from './core/reveal.js';
import { initMotion } from './core/motion.js';
import { loadCatalog } from './features/catalog/catalog.js';
// Entry point. Draw the shell INSTANTLY from what this device remembers (header + page-shaped placeholders),
// then wire up events and let route() fill in the real page as soon as Firebase and the server have answered.
const hint = cachedMe();
if (hint) {
    S.me = hint; // only a hint for the header; route() replaces it with the real profile
}
nav();
// Start fetching the built-in jobs and courses right away, so the lists are ready when the page needs them.
loadCatalog();
$('#app').innerHTML = skeleton(skeletonFor(location.hash.slice(2), !!hint));
bindEvents();
initReveal();
initMotion();
addEventListener('hashchange', route);
route();

// Keep dashboards current: refetch when you come back to the tab and every minute while one is open.
// Skipped while you are typing or choosing something, so it never interrupts an edit.
// Admin and moderator dashboards read every user, listing and application, so they refresh at most every 10 minutes
// (a refresh every minute would use up the free Firestore read quota in under an hour).
const STAFF = /^(admin|moderator)$/;
let lastDash = 0;
const refreshDashboard = () => {
    const el = document.activeElement;
    // never wipe a half-filled "post an opportunity" form
    const typing = [...document.querySelectorAll('form[data-form=post] input[name=title], #cover-val')].some(i => i.value);
    if (typing || document.hidden || !S.me || !location.hash.startsWith('#/dashboard') || (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName))) {
        return;
    }
    if (Date.now() - lastDash < (STAFF.test(S.me.role) ? 10 * 60e3 : 20e3)) {
        return;
    }
    lastDash = Date.now();
    clearApiCache();
    dashboard().catch(() => {});
};
document.addEventListener('visibilitychange', refreshDashboard);
addEventListener('focus', refreshDashboard);
// Left open in a tab? When you come back after a few minutes, the job list reloads so jobs and courses the importer added meanwhile show up.
let leftAt = 0;
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        leftAt = Date.now();
        return;
    }
    if (leftAt && Date.now() - leftAt > 3 * 60e3 && /^(#\/?|#\/browse.*)?$/.test(location.hash)) {
        clearApiCache();
        route();
    }
    leftAt = 0;
});
setInterval(refreshDashboard, 60000); // (was 20 s: every refresh re-downloaded the dashboard data)
