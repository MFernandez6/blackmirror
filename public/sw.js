const CACHE = "blackmirror-v3";
const PRECACHE = ["/offline", "/login", "/inspections", "/icons/icon-192.png"];

function isAppShell(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (url.pathname.startsWith("/icons/")) return true;
  return PRECACHE.includes(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  const shell = isAppShell(url);
  if (!shell && req.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      const hashed =
        url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
      if (hashed) {
        const cached = await caches.match(req);
        if (cached) return cached;
      }
      try {
        const fresh = await fetch(req);
        if (shell && fresh.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        const cached = shell ? await caches.match(req) : null;
        if (cached) return cached;
        if (req.mode === "navigate") {
          const offline = await caches.match("/offline");
          if (offline) return offline;
        }
        return new Response("Offline", { status: 503, statusText: "Offline" });
      }
    })()
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "blackmirror-sync") {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: "BLACKMIRROR_SYNC" });
        }
      })
    );
  }
});
