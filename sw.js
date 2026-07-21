// FinPlan service worker — enables "Install as app" on Android/Chrome and basic offline use.
// All your financial data still lives only in the page's memory / your JSON backups;
// this worker only caches the app SHELL (html/css/js/icons), never your data.
const CACHE_NAME = 'finplan-shell-v66';
const SHELL_FILES = [
  './finplan.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// Cache-first for same-origin shell files; everything else (e.g. Chart.js CDN, Google APIs)
// goes to the network as normal since those aren't part of the private data path.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // let CDN/Google requests pass through untouched
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
