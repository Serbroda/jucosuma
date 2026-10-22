// Jucosuma has no offline cache: an earlier precaching service worker kept serving outdated builds.
// Browsers that still have it installed fetch this file on their next update check; it removes itself
// and the old caches and reloads the open windows.
self.addEventListener('install', () => {
    self.skipWaiting();
});
self.addEventListener('activate', () => {
    self.registration.unregister()
        .then(() => self.caches.keys())
        .then((names) => Promise.all(names.map((name) => self.caches.delete(name))))
        .then(() => self.clients.matchAll({type: 'window'}))
        .then((clients) => clients.forEach((client) => client.navigate(client.url)));
});
