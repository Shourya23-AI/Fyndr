// Built-in catalog: ~1,350 course topics and ~320 job and internship roles, each with links to the providers' and job boards' own search pages.
// They load from public/catalog/*.json (compact rows, see group.js), are merged into every listings request in core/api.js,
// so browse, search, suggestions and the saved list all see them. The files are fetched once, grouped in the browser and kept in memory.
// If a file is missing the site simply shows what it has.
//
// These are SEARCH LINKS, not postings (see group.js and origin.js): they have no stored openings, so nothing about them can expire.
import { groupCourses, groupJobs } from './group.js';
const FILES = [['catalog/catalog-courses.json', groupCourses], ['catalog/catalog-jobs.json', groupJobs]];
let mem = null;
let legacy = new Map(); // old per-row ids ("cat_c123", "cat_j456") -> the id of the grouped listing that replaced them
const url = f => {
    try {
        return new URL(f, document.baseURI).href;
    } catch {
        return f;
    }
};
export function loadCatalog() {
    if (!mem) {
        mem = Promise.all(FILES.map(([f, group]) => fetch(url(f)).then(r => {
            if (!r.ok) {
                console.warn('Fyndr catalog file not found: ' + f + ' (HTTP ' + r.status + '). Make sure public/catalog/ is uploaded.');
                return { rows: [] };
            }
            return r.json();
        }).then(d => group(d.rows || [])).catch(() => ({ list: [], legacy: new Map() })))).then(parts => {
            legacy = new Map(parts.flatMap(p => [...p.legacy]));
            migrateSaved();
            return parts.flatMap(p => p.list);
        });
    }
    return mem;
}
const words = q => String(q || '').toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean);
// The text a search looks in. Catalog listings search their title, skills and provider names only (not the explanation text every card shares).
const hayOf = x => {
    if (x._hay) {
        return x._hay;
    }
    const t = (x.title + ' ' + x.orgName + ' ' + (x.skills || []).join(' ') + ' ' + (x.links ? x.links.map(k => k.n).join(' ') : x.description)).toLowerCase();
    try {
        Object.defineProperty(x, '_hay', { value: t, enumerable: false, configurable: true });
    } catch { }
    return t;
};
// Same rules as the server's listing search: type, free text, location.
export function filterCatalog(rows, qs) {
    const q = new URLSearchParams(qs || '');
    const ws = words(q.get('q'));
    const t = q.get('type');
    const l = (q.get('loc') || '').toLowerCase();
    const types = t ? t.split(',') : null;
    return rows.filter(x => (!types || types.includes(x.type)) && (!ws.length || (() => { const hay = hayOf(x); return ws.every(w => hay.includes(w)); })()) && (!l || String(x.location).toLowerCase().includes(l)));
}
// Real listings first (newest first), then the catalog: with a search, the best title matches lead; without one, the catalog keeps its own order.
export const mergeCatalog = (rows, cat, path) => {
    const qs = path.includes('?') ? path.slice(path.indexOf('?') + 1) : '';
    const have = new Set(rows.map(r => r.id));
    const ws = words(new URLSearchParams(qs).get('q'));
    const rel = x => (ws.length ? ws.filter(w => x.title.toLowerCase().includes(w)).length : 0);
    const found = filterCatalog(cat, qs).filter(x => !have.has(x.id)).sort((a, b) => rel(b) - rel(a) || String(b.created).localeCompare(String(a.created)));
    return rows.slice().sort((a, b) => String(b.created).localeCompare(String(a.created))).concat(found);
};
// Saved catalog items live on this device (they are not documents in the database).
const KEY = 'fyndr-catsaved';
const readSaved = () => {
    try {
        return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
        return [];
    }
};
const writeSaved = a => {
    try {
        localStorage.setItem(KEY, JSON.stringify(a));
    } catch { }
};
// Items saved before grouping were saved per provider or per board ("cat_c123"): they now point at the role or topic's single listing.
function migrateSaved() {
    const a = readSaved();
    if (!a.some(id => legacy.has(id))) {
        return;
    }
    writeSaved([...new Set(a.map(id => legacy.get(id) || id))]);
}
export const catSaved = () => readSaved();
export function toggleCatSaved(id) {
    const a = readSaved();
    const saved = !a.includes(id);
    writeSaved(saved ? a.concat(id) : a.filter(x => x !== id));
    return { saved };
}
