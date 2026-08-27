"use client";

import { useEffect, useState } from "react";
import {
  authenticate,
  checkAvailability,
  dismissEnrollPrompt,
  isEnrolled,
  isEnrollPromptDismissed,
  isNativeIOS,
  setEnrolled,
  type BiometryKind,
} from "@/lib/biometric";

// Subtle, one-time opt-in surface for biometric unlock. Renders only
// inside the Capacitor native iOS shell, only when the device has
// biometrics available, and only when the user has neither enrolled
// nor previously dismissed the prompt. After enrollment it removes
// itself; after dismissal it never returns on this device.
//
// Web, PWA, and desktop browsers always render null (the
// isNativeIOS() short-circuit happens before any state is set, so
// React commits a null render and never schedules further work).
//
// The interaction is two soft links—Enable and Not now—instead of
// a modal, banner, or pulsing button. Enabling triggers a verification
// authenticate() call so the user feels Face ID succeed once before
// the flag is persisted. If verification is cancelled the flag stays
// off and the prompt remains for next launch.

export function BiometricEnrollPrompt() {
  const [shouldShow, setShouldShow] = useState(false);
  const [kind, setKind] = useState<BiometryKind>("none");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function probe() {
      if (!isNativeIOS()) return;
      if (isEnrolled()) return;
      if (isEnrollPromptDismissed()) return;
      const info = await checkAvailability();
      if (cancelled) return;
      if (!info.available) return;
      setKind(info.kind);
      setShouldShow(true);
    }
    probe();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!shouldShow) return null;

  const label =
    kind === "faceId" ? "Face ID" : kind === "touchId" ? "Touch ID" : "biometric unlock";

  async function handleEnable() {
    setBusy(true);
    const ok = await authenticate(`Confirm ${label} to enable quick re-entry`);
    if (ok) {
      setEnrolled(true);
      setShouldShow(false);
    } else {
      setBusy(false);
    }
  }

  function handleDismiss() {
    dismissEnrollPrompt();
    setShouldShow(false);
  }

  return (
    <div
      style={{
        background: "#F5F0E8",
        borderBottom: "1px solid rgba(28, 43, 30, 0.08)",
        padding: "16px 24px calc(16px + env(safe-area-inset-bottom) * 0)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        fontFamily: "'Jost', system-ui, sans-serif",
        color: "#1C2B1E",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 400,
          lineHeight: 1.5,
          opacity: 0.85,
        }}
      >
        Use {label} to re-enter Vital Kauaʻi quickly next time.
      </p>
      <div
        style={{
          display: "flex",
          gap: 24,
          fontSize: 12,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <button
          type="button"
          onClick={handleEnable}
          disabled={busy}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "#1C2B1E",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.4 : 1,
            fontFamily: "inherit",
            fontSize: "inherit",
            letterSpacing: "inherit",
            textTransform: "inherit",
            fontWeight: 500,
          }}
        >
          Enable
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={busy}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "#1C2B1E",
            opacity: 0.5,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "inherit",
            letterSpacing: "inherit",
            textTransform: "inherit",
            fontWeight: 400,
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
