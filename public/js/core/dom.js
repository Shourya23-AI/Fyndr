// Tiny DOM + formatting helpers and shared icons.
export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
export const fmt = d => new Date(d).toLocaleDateString();
export const toast = m => {
    const t = $('#toast');
    t.textContent = m;
    t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.hidden = true, 2500);
};
export const table = (h, rows) => `<div class="tbl-wrap"><table class="tbl"><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr>${rows.join('') || `<tr><td colspan="${h.length}" style="color:var(--muted)">Nothing here yet.</td></tr>`}</table></div>`;
export const pill = s => `<span class="pill ${s}">${s}</span>`;
export const LOGO = '<span class="logo-mark"><svg viewBox=\"0 0 32 32\" aria-hidden=\"true\"><path d=\"M9 26V7.5h13\"/><circle cx=\"16.2\" cy=\"16.4\" r=\"4.3\"/><path d=\"m19.4 19.6 4.6 4.6\"/></svg></span>';
export const TICK = '<svg viewBox="0 0 24 24"><path d="m5 12 4.5 4.5L19 7"/></svg>';
