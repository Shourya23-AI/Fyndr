// Built-in catalog: thousands of courses (and, from Part 3, jobs and internships) that load from public/data/*.json.
// They are merged into every listings request in core/api.js, so browse, search, suggestions and the saved list all see them.
// The files are fetched once, expanded in the browser, and kept in memory. If a file is missing the site simply shows what it has.
import { expandCourse } from './meta.js';
const FILES = [['data/catalog-courses.json', expandCourse]];
let mem = null;
const url = f => {
    try {
        return new URL(f, document.baseURI).href;
    } catch {
        return f;
    }
};
export function loadCatalog() {
    if (!mem) {
        mem = Promise.all(FILES.map(([f, expand]) => fetch(url(f)).then(r => (r.ok ? r.json() : { rows: [] })).then(d => (d.rows || []).map(expand)).catch(() => []))).then(a => a.flat());
    }
    return mem;
}
// Same rules as the server's listing search: type, free text, location.
export function filterCatalog(rows, qs) {
    const q = new URLSearchParams(qs || '');
    const s = (q.get('q') || '').toLowerCase();
    const t = q.get('type');
    const l = (q.get('loc') || '').toLowerCase();
    const types = t ? t.split(',') : null;
    return rows.filter(x => (!types || types.includes(x.type)) && (!s || (x.title + ' ' + x.orgName + ' ' + x.description).toLowerCase().includes(s)) && (!l || String(x.location).toLowerCase().includes(l)));
}
export const mergeCatalog = (rows, cat, path) => {
    const qs = path.includes('?') ? path.slice(path.indexOf('?') + 1) : '';
    const have = new Set(rows.map(r => r.id));
    return rows.concat(filterCatalog(cat, qs).filter(x => !have.has(x.id))).sort((a, b) => String(b.created).localeCompare(String(a.created)));
};
// Saved catalog items live on this device (they are not documents in the database).
const KEY = 'fyndr-catsaved';
export const catSaved = () => {
    try {
        return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
        return [];
    }
};
export function toggleCatSaved(id) {
    const a = catSaved();
    const saved = !a.includes(id);
    try {
        localStorage.setItem(KEY, JSON.stringify(saved ? a.concat(id) : a.filter(x => x !== id)));
    } catch { }
    return { saved };
}
