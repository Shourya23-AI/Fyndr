// Tiny DOM + formatting helpers and shared icons.
export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
// A web address that is safe to put in an href: plain https, no spaces or quotes. Anything else (javascript:, data:, http:) becomes ''.
// esc() alone is NOT enough for links: href="javascript:..." runs when clicked even though it contains no < or ".
export const safeUrl = u => (typeof u === 'string' && u.length <= 600 && /^https:\/\/[^\s"<>`\\]+$/i.test(u) ? u : '');
export const fmt = d => new Date(d).toLocaleDateString();
export const toast = m => {
    const t = $('#toast');
    t.textContent = m;
    t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.hidden = true, 2500);
};
export const table = (h, rows, empty = 'Nothing here yet.') => `<div class="tbl-wrap"><table class="tbl"><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr>${rows.join('') || `<tr><td colspan="${h.length}" class="st-none" style="color:var(--muted)">${empty}</td></tr>`}</table></div>`;
export const pill = s => `<span class="pill ${s}">${s}</span>`;
export const LOGO = '<img class="logo-img logo-light" src="img/logo.png" alt="Fyndr" width="128" height="41" decoding="async"><img class="logo-img logo-darkmode" src="img/logo-dark.png" alt="" aria-hidden="true" width="128" height="41" decoding="async">';
export const TICK = '<svg viewBox="0 0 24 24"><path d="m5 12 4.5 4.5L19 7"/></svg>';
