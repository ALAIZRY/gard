const CACHE_NAME = 'rama-pharmacy-cache-v3';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './pwa-icon.svg'
];

// Install Event: Safe Pre-caching with Graceful Error Handling
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Pre-caching core app shell for offline availability...');
      for (const asset of CORE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[SW] Pre-cache skipped for ${asset}:`, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Offline-first with dynamic caching & navigation fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  // Bypass service worker interception for Vite dev server, source files, and hot reload modules
  if (
    url.includes('/@vite/') ||
    url.includes('/@fs/') ||
    url.includes('/src/') ||
    url.includes('/node_modules/') ||
    url.includes('?v=') ||
    url.includes('hot-update')
  ) {
    return;
  }

  // For HTML navigation requests: Try Network first, fallback to cached index.html
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match('./index.html') || await caches.match('./');
          if (cached) return cached;
          return new Response(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>صيدلية راما - وضع الأوفلاين</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: white; text-align: center; padding: 40px 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 30px; max-width: 400px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h1 { color: #10b981; font-size: 22px; margin-bottom: 10px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
    button { background: #059669; color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: bold; cursor: pointer; margin-top: 20px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>صيدلية راما - وضع العمل بدون إنترنت</h1>
    <p>أنت الآن تستخدم التطبيق أوفلاين. جميع بياناتك المجرودة والأصناف محفوظة بوشاطة الذاكرة المحلية للجوال.</p>
    <button onclick="location.reload()">إعادة تحميل التطبيق</button>
  </div>
</body>
</html>`, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        })
    );
    return;
  }

  // For all other static assets (JS, CSS, images, fonts): Cache First, fallback to Network with dynamic caching
  event.respondWith(
    caches.match(event.request, { ignoreSearch: false }).then(async (cachedResponse) => {
      if (cachedResponse) {
        // Background revalidation
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
            }
          })
          .catch(() => { /* silent offline */ });
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      } catch (err) {
        return new Response('', { status: 404 });
      }
    })
  );
});
