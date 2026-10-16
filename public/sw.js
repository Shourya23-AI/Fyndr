// Fyndr service worker: instant repeat visits + installable + app shell works offline.
//
//  - Pages and static files (HTML, JS, CSS, images): "stale while revalidate". The saved copy is shown at once and a fresh copy is
//    fetched in the background for next time. This is what makes reloads feel instant.
//  - Public config (/api/firebase-config, /api/phone-config): same strategy.
//  - All other /api calls and the phone.email callback page are never touched (always live data).
//  - __BUILD__ is replaced by the server with a hash of the site files, so every deploy gets its own cache and the old one is deleted.
// On static hosting (GitHub Pages) nothing replaces the token above, so the cache name is a fixed label.
// CHANGE THE LABEL below whenever you publish a new version, so visitors drop the old cached files.
const BUILD = '__BUILD__';
const CACHE = 'fyndr-' + (BUILD.indexOf('__') === 0 ? 'static-2026-10-16-tracker-v25' : BUILD);
const SHELL = ['./', 'index.html', 'css/app.css', 'js/main.js', 'favicon.svg', 'icons/icon-192.png'];
const CONFIG_API = ['/api/firebase-config', '/api/phone-config'];

self.addEventListener('install', event => {
    // Pre-save the shell. A missing file must not block installing, so each one is added on its own.
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => Promise.all(SHELL.map(u => cache.add(u).catch(() => {}))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
            .then(() => self.clients.matchAll({ type: 'window' }))
            .then(list => list.forEach(c => c.postMessage({ type: 'fyndr-updated' })))
    );
});

// Answer from cache immediately, refresh the cache in the background.
async function staleWhileRevalidate(event, key) {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key);
    const network = fetch(event.request)
        .then(response => {
            if (response && response.ok) {
                cache.put(key, response.clone());
            }
            return response;
        })
        .catch(() => null);
    if (cached) {
        event.waitUntil(network); // keep the worker alive until the background refresh finishes
        return cached;
    }
    return (await network) || Response.error();
}

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }
    if (url.pathname.endsWith('/phone-callback.html')) {
        return;
    }
    if (url.pathname.startsWith('/api/')) {
        if (CONFIG_API.includes(url.pathname)) {
            event.respondWith(staleWhileRevalidate(event, request));
        }
        return;
    }
    if (request.mode === 'navigate') {
        // Every page address is the same single-page app: show the saved shell now, refresh it behind the scenes.
        // (A reset-password / callback style query string must not be cached as a separate page.)
        event.respondWith(
            staleWhileRevalidate(event, new Request(new URL('index.html', self.registration.scope).href)).then(r => r.type === 'error' ? caches.match('index.html') || r : r)
        );
        return;
    }
    event.respondWith(staleWhileRevalidate(event, request));
});
