// FinPlan service worker — enables "Install as app" on Android/Chrome and basic offline use.
// All your financial data still lives only in the page's memory / your JSON backups;
// this worker only caches the app SHELL (html/css/js/icons), never your data.
const CACHE_NAME = 'finplan-shell-v76';
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

// Best-effort daily payment reminder via Periodic Background Sync — genuinely best-effort, not
// guaranteed: Chromium-only, only for an installed PWA, and the browser (not FinPlan) decides
// both whether to grant this at all and how often it actually fires. A Service Worker has no
// access to the app's localStorage, so it can't recompute due/overdue items live — instead it
// reads a small snapshot the app itself writes to Cache Storage every time it's opened, which
// means this notification reflects data as of the last time you actually had FinPlan open, not
// a live check. If the tag below doesn't match what your browser fires (naming isn't fully
// standardized across implementations yet), this handler simply never runs and the app's own
// on-open/on-focus/hourly checks are what you get instead — which is the reliable path anyway.
self.addEventListener('periodicsync', (event) => {
  if (event.tag !== 'finplan-daily-payment-check') return;
  event.waitUntil(
    caches.open('finplan-alerts-v1')
      .then(cache => cache.match('/__alerts-summary'))
      .then(res => res ? res.json() : null)
      .then(summary => {
        if (!summary || !summary.enabled || !summary.total) return;
        const title = summary.overdueCount>0
          ? `⚠ ${summary.overdueCount} payment(s) overdue`
          : `🔔 ${summary.total} payment(s) coming up`;
        const lines = summary.items.map(i => `${i.name} (${i.kind}): ${i.isOverdue?'was due':'due'} ${i.dueDate}`);
        const body = lines.join('\n') + (summary.total > summary.items.length ? `\n+${summary.total - summary.items.length} more` : '')
          + '\n\n(as of your last visit — open FinPlan for the latest)';
        return self.registration.showNotification(title, { body, icon: './icon-192.png' });
      })
      .catch(()=>{})
  );
});
