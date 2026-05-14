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
//
// allowNavigation: explicit whitelist of hostnames the WKWebView
// is allowed to navigate to in-app. Without this list, Capacitor's
// navigation policy handler bounces unrecognized hosts to Safari
// via UIApplication.shared.open — which is what was rendering the
// Safari URL bar / back / refresh / menu chrome at the bottom of
// the simulator after PR #16. The implicit hostname parsed from
// server.url should cover the primary domain, but being explicit
// means any preview alias, vercel.live edge helper, Supabase auth
// callback, Stripe checkout return, or analytics redirect stays
// inside the WebView. Wildcards are supported.
//
// If a domain is missing from this list, the WebView will boot the
// affected URL out to Safari and the user will see the system browser
// chrome around it — the exact symptom we are fixing. Add new domains
// here when wiring features that navigate cross-origin.

const config: CapacitorConfig = {
  appId: "com.vitalkauai.app",
  appName: "Vital Kauaʻi",
  webDir: "out",
  server: {
    url: "https://vital-kauai.vercel.app/portal",
    cleartext: false,
    allowNavigation: [
      "vital-kauai.vercel.app",
      "*.vercel.app",
      "*.supabase.co",
      "*.supabase.in",
    ],
  },
};

export default config;
