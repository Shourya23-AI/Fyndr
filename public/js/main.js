import { route } from './core/router.js';
import { bindEvents } from './core/events.js';
import { S } from './core/state.js';
import { $ } from './core/dom.js';
import { skeleton, skeletonFor } from './core/skeleton.js';
import { nav } from './features/layout/nav.js';
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
