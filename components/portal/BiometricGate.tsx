"use client";

import { useEffect, useState, type ReactNode } from "react";
import { authenticate, isEnrolled, isNativeIOS, setEnrolled } from "@/lib/biometric";
import { createClient } from "@/lib/supabase/client";

// Cold-launch biometric unlock for the Capacitor iOS shell.
//
// Wraps the portal layout's children. On every cold launch the gate
// runs a single client-side check: are we inside the native iOS shell
// AND has the user previously opted into biometric unlock on this
// device? If both, show a quiet forest overlay and prompt the OS
// for Face ID / Touch ID. On success the overlay fades out and the
// running Supabase session continues unchanged. On failure or cancel
// the user is signed out and routed through the existing /login flow.
//
// Web, PWA, and any non-iOS shell never enter the locked state — the
// useEffect short-circuits at isNativeIOS(), so the children render
// exactly as they did before this wrapper existed. There is no
// network call, no Capacitor bridge call, no overlay render.
//
// Architectural notes:
// - The overlay is rendered ON TOP of children, not in place of them.
//   This means there is a single React tree at all times (no remount
//   on unlock, no lost scroll position, no re-fetched data).
// - Biometric is a *local convenience layer*. The Supabase session
//   inside the WebView is the source of truth; this gate just decides
//   whether to allow the device-holder to use it.
// - On failure we sign out before redirecting so middleware does not
//   bounce the user straight back to the gate.

export function BiometricGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!isNativeIOS()) return;
      if (!isEnrolled()) return;
      setLocked(true);
      const ok = await authenticate("Unlock Vital Kauaʻi");
      if (cancelled) return;
      if (ok) {
        setLocked(false);
        return;
      }
      // Failure path: clear the enrollment flag so the user is not
      // trapped in a Face-ID-then-cancel-then-redirect-then-login
      // loop after a passcode change or repeated mismatches. They
      // can re-enable from the prompt after signing back in.
      setEnrolled(false);
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch {
        // Silent — we redirect either way.
      }
      window.location.replace("/login?error=biometric");
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {children}
      {locked && <LockOverlay />}
    </>
  );
}

// Calm forest fullscreen overlay. Italic Cormorant brand mark on the
// same #1C2B1E used by the no-network fallback page, so the WebView
// has visual continuity from launch → fallback → gate → portal. No
// spinner, no "verifying" copy, no security-theater. The OS Face ID
// sheet floats on top.
function LockOverlay() {
  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#1C2B1E",
        color: "#F5F0E8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <span
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
          fontStyle: "italic",
          fontWeight: 300,
          fontSize: "clamp(64px, 14vw, 112px)",
          opacity: 0.85,
          lineHeight: 1,
        }}
      >
        V
      </span>
    </div>
  );
}
