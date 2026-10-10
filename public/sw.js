// Fyndr service worker: makes the site installable and keeps the app shell available offline.
// Strategy: network first (always fresh after a deploy), cached copy only when the network fails.
// API calls and the phone.email callback page are never touched.
const CACHE = 'fyndr-v1';
const SHELL = ['index.html', 'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    const skip = request.method !== 'GET'
        || url.origin !== self.location.origin
        || url.pathname.startsWith('/api/')
        || url.pathname.endsWith('/phone-callback.html');
    if (skip) {
        return;
    }
    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE).then(cache => cache.put(request, copy));
                }
                return response;
            })
            .catch(async () => {
                const cached = await caches.match(request);
                if (cached) {
                    return cached;
                }
                // Offline navigation to any page: show the app shell.
                return request.mode === 'navigate' ? caches.match('index.html') : Response.error();
            })
    );
});
