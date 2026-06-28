// Vital Kauaʻi member portal service worker.
//
// Goal: lightweight shell continuity. Cache only static, content-hashed
// assets so repeat loads feel a touch quicker and the installed PWA
// stays visually intact during weak connectivity. Everything dynamic —
// HTML pages, /api/*, /auth/*, Supabase, Stripe, member data — passes
// through to network on every request, so auth and data are always
// fresh.
//
// Kill switch (if anything goes wrong post-deploy): replace this file
// with a SW that calls self.registration.unregister() inside activate,
// then deploy. Existing SWs on member devices will fetch the new file
// on next page load, install it, activate it, and unregister
// themselves. A subsequent deploy can restore behavior or leave the
// site SW-free.

const CACHE_NAME = "vk-shell-v2";

self.addEventListener("install", () => {
  // Activate the new SW immediately. Safe because we don't precache
  // anything that could become stale.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Take control of any open tabs immediately.
      await self.clients.claim();
      // Wipe any caches from older SW versions (different CACHE_NAME).
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("vk-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k)),
      );
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET. Everything else (POST/PUT/PATCH/DELETE) bypasses
  // the SW entirely — auth + writes always hit network.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Cross-origin (Supabase, Stripe, Vercel analytics, etc.) — pass through.
  if (url.origin !== self.location.origin) return;

  // Server endpoints, auth callbacks, and Next.js dynamic internals —
  // never cache, always pass through.
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/auth/")) return;
  if (url.pathname.startsWith("/_next/data/")) return;
  if (url.pathname.startsWith("/_next/image")) return;

  // Safe-to-cache whitelist. Everything else (HTML pages, RSC payloads,
  // server actions, etc.) passes through to network.
  const isCacheable =
    url.pathname.startsWith("/_next/static/") || // content-hashed JS/CSS bundles + fonts
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/apple-icon" ||
    /\.(woff2?|ttf|otf|svg|png|jpe?g|gif|webp|ico)$/i.test(url.pathname);

  if (!isCacheable) return;

  // Cache-first for these. Fall back to network on miss; cache the
  // response if it's ok. Network errors propagate normally so the
  // browser shows its standard failure UI.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      const fresh = await fetch(req);
      if (fresh.ok) {
        // Don't await — let the cache write happen in the background.
        cache.put(req, fresh.clone()).catch(() => {});
      }
      return fresh;
    })(),
  );
});
