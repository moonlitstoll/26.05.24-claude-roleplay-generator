/* Opens the app without internet.
 *
 * Saved scripts and audio already live on the device (IndexedDB); this worker keeps the app's own
 * screen files there too.
 * - Page: server first, stored copy if the server fails or takes more than 3 seconds.
 * - /_next/static files: stored copy first. Their names contain a content hash, so they never change.
 * - /api is never touched: AI and version checks always go to the server.
 *
 * The build id comes from the registration URL (/sw.js?v=...), so each deployment installs a new copy.
 */
const BUILD_ID = new URL(self.location.href).searchParams.get('v') || 'local';
const SHELL_PREFIX = 'shell-';
const SHELL = SHELL_PREFIX + BUILD_ID;
const READY_MARK = '/__offline-ready';
const PAGE = '/';
const NAV_TIMEOUT_MS = 3000;
const EXTRA_FILES = ['/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/favicon.ico'];

const isHtml = (res) => (res.headers.get('content-type') || '').includes('text/html');

// A missing file answered with an HTML page must not be stored as JS or CSS: it would break the app offline.
async function store(cache, path) {
  const res = await fetch(path, { cache: 'reload' });
  if (!res.ok) throw new Error('[sw] ' + path + ' ' + res.status);
  if (isHtml(res)) throw new Error('[sw] got HTML for ' + path);
  await cache.put(path, res);
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    try {
      const pageRes = await fetch(PAGE, { cache: 'reload' });
      if (!pageRes.ok || !isHtml(pageRes)) throw new Error('[sw] page ' + pageRes.status);
      const html = await pageRes.clone().text();
      await cache.put(PAGE, pageRes);
      // Every script and stylesheet the page needs is named in its HTML.
      const assets = new Set(
        (html.match(/\/_next\/static\/[^"'\\\s<>)]+\.(?:js|css|woff2)/g) || []).map((path) => path.split('?')[0])
      );
      await Promise.all([...assets, ...EXTRA_FILES].map((path) => store(cache, path)));
      // Written last, so "ready" in Settings means everything really was stored.
      await cache.put(READY_MARK, new Response(BUILD_ID, {
        headers: { 'content-type': 'text/plain', 'x-stored-at': String(Date.now()) },
      }));
    } catch (e) {
      await caches.delete(SHELL); // no half-filled copy; the next app start tries again
      throw e;
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Keep this copy and the one before it: a page still open on the old version may need its files.
    const older = (await caches.keys()).filter((key) => key.startsWith(SHELL_PREFIX) && key !== SHELL);
    const stamped = await Promise.all(older.map(async (key) => {
      const cache = await caches.open(key);
      const mark = await cache.match(READY_MARK);
      return { key, time: Number(mark && mark.headers.get('x-stored-at')) || 0 };
    }));
    stamped.sort((a, b) => b.time - a.time);
    await Promise.all(stamped.slice(1).map(({ key }) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function navigate(request) {
  const cached = await caches.match(PAGE, { cacheName: SHELL });
  if (!cached) return fetch(request);
  return new Promise((resolve) => {
    let done = false;
    const finish = (res) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(res);
    };
    const timer = setTimeout(() => finish(cached), NAV_TIMEOUT_MS);
    fetch(request).then((res) => finish(res && res.ok ? res : cached), () => finish(cached));
  });
}

async function staticFile(request) {
  const hit = await caches.match(request.url, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && !isHtml(res)) {
    const copy = res.clone();
    caches.open(SHELL).then((cache) => cache.put(new URL(request.url).pathname, copy)).catch(() => {});
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(navigate(request));
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || EXTRA_FILES.includes(url.pathname)) {
    event.respondWith(staticFile(request));
  }
});
