import {route} from './core/router.js';
import {bindEvents} from './core/events.js';
// Entry point: wire up events, then draw the first page.
bindEvents();
addEventListener('hashchange',route);
route();
