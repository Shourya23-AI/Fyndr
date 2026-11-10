import { esc } from '../../core/dom.js';
// Empty, error and loading states (Part 3, step 3). Every one says what is going on AND what to do next.
// `actions` is a list of { label, href } (a link) or { label, act } (a button handled in states.actions.js); the first is the main one.
const btn = (a, i) => (a.href
    ? `<a class="button${i ? '' : ' button-dark'} button-small" href="${esc(a.href)}">${esc(a.label)}</a>`
    : `<button type="button" class="button${i ? '' : ' button-dark'} button-small" data-act="${esc(a.act)}">${esc(a.label)}</button>`);
export const emptyHtml = ({ title, text = '', actions = [] }) => `<div class="empty st-empty"><b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ''}${actions.length ? `<div class="st-cta">${actions.map(btn).join('')}</div>` : ''}</div>`;
// A table row's worth of empty message (the table helper puts it in one cell).
export const emptyCell = (text, link) => `${esc(text)}${link ? ` <a href="${esc(link.href)}">${esc(link.label)}</a>` : ''}`;
// A page or panel that failed to load: plain words, never the raw error, and a way to try again.
export const FRIENDLY = [[/offline|network|failed to fetch|unavailable|timeout|timed out|reach/i, 'We could not reach Fyndr. Check your internet connection.'], [/permission|insufficient|denied/i, 'Your account is not allowed to open this page.'], [/log ?in|sign ?in|auth/i, 'Please sign in again.']];
export const friendly = m => (FRIENDLY.find(([re]) => re.test(String(m || ''))) || [0, 'Something went wrong on our side. Nothing you typed was lost.'])[1];
export const errorHtml = (message, { retry = 'retry', home = true } = {}) => `<div class="container page"><div class="empty st-empty st-error" role="alert"><b>This page did not load</b><p>${esc(friendly(message))}</p><div class="st-cta"><button type="button" class="button button-dark button-small" data-act="${esc(retry)}">Try again</button>${home ? '<a class="button button-small" href="#/jobs">Go to jobs</a>' : ''}</div></div></div>`;
// "Loading..." text with a spoken status for screen readers.
export const loadingText = (what = 'Loading') => `<p class="desc" role="status" aria-live="polite">${esc(what)}…</p>`;
