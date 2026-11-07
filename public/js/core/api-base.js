// Where the Fyndr server lives. Empty = the same site that served this page (normal Node hosting).
// For GitHub Pages (static files only) put your hosted server's address in <meta name="fyndr-api"> in index.html,
// for example  https://fyndr.onrender.com  (no trailing slash). Every device then shares ONE database.
export const API_BASE = (document.querySelector('meta[name=fyndr-api]')?.content || '').trim().replace(/\/+$/, '');
