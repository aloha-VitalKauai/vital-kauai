import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor wrapper for Vital Kauaʻi.
//
// The native iOS shell loads the live production deployment via
// server.url — no local web build is bundled. This preserves the
// entire Next.js architecture (App Router, middleware, Supabase auth,
// server actions, /api/*, server-rendered pages) and the existing
// PWA service worker. Web/PWA users see no change.
//
// Launch target: /portal — the member portal experience, not the
// public marketing root. The installed native app is for members and
// founders; opening straight into /portal skips the marketing-site
// indirection. Existing middleware redirects unauthed visitors to
// /login, so first-launch sign-in still works the same way.
//
// Trade-off: the installed native app needs network on launch (no
// offline cold-start). The PWA service worker still caches static
// assets once loaded, so the WebView gets the same shell-continuity
// the browser PWA does.
//
// App Store note: Apple's Review Guideline 4.2 may flag pure
// "wrapped website" apps. Foundation only here — adding native
// features (biometric login, native camera for labs, push
// notifications) is a separate later PR before submission.
//
// webDir is required by the Capacitor schema. PR #14b created the
// out/ directory + a tiny fallback page; cap sync copies that
// fallback into the native bundle as a no-network safety net.

const config: CapacitorConfig = {
  appId: "com.vitalkauai.app",
  appName: "Vital Kauaʻi",
  webDir: "out",
  server: {
    url: "https://vital-kauai.vercel.app/portal",
    cleartext: false,
  },
};

export default config;
