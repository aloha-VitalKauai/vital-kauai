"use client";

import { useEffect } from "react";

// Mounts inside the portal layout. After hydration, registers the
// /sw.js service worker so members get cached static assets on repeat
// visits and the installed PWA feels a touch more continuous on weak
// connectivity. Silent on failure—SW is purely opportunistic.
//
// SW scope is "/" (default for /sw.js at root). Once registered it
// intercepts every same-origin GET, but the SW itself only acts on a
// safe static-asset whitelist (see public/sw.js), so marketing routes
// are effectively pass-through. We only TRIGGER registration from the
// portal layout so members are the first to opt in; marketing visitors
// who never enter /portal never register the SW.

export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const { protocol, hostname } = window.location;
    const isSecure =
      protocol === "https:" || hostname === "localhost" || hostname === "127.0.0.1";
    if (!isSecure) return;

    // If a service worker is already controlling this page, a newer worker
    // (deployed with a bumped cache version) will take over and fire
    // `controllerchange`. Reload once so the member lands on fresh content
    // instead of the previously cached shell. Guarded against loops, and
    // skipped on first-ever install (no prior controller) so new visitors
    // never get an extra reload.
    if (navigator.serviceWorker.controller) {
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silent. SW failure must not disrupt the member.
    });
  }, []);
  return null;
}
