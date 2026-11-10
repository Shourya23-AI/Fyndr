import { S } from '../../core/state.js';
import { loadBox, unread } from './notify.rules.js';
// The bell in the header (candidates only). `refreshBell()` redraws just the bell, so the rest of the header is left alone.
const uid = () => (S.me && (S.me.id || S.me.email)) || 'me';
export const bellHtml = () => {
    if (!S.me || S.me.role !== 'user') {
        return '';
    }
    let n = 0;
    try {
        n = unread(loadBox(localStorage, uid()));
    } catch { }
    return `<a class="icon-btn nt-bell" href="#/notifications" data-r="notifications" aria-label="Notifications${n ? `, ${n} unread` : ''}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7.5 2 7.5H4S6 15 6 9zM10 20a2 2 0 0 0 4 0"/></svg>${n ? `<b class="nt-count" aria-hidden="true">${n > 9 ? '9+' : n}</b>` : ''}</a>`;
};
export function refreshBell() {
    const el = document.querySelector('.nt-bell');
    if (el) {
        el.outerHTML = bellHtml();
    }
}
