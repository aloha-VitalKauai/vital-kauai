"use client";
import { useState } from "react";

export default function ContinueButton({ token, resume }: { token: string; resume: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    if (busy) return; // double-click cannot start a second checkout (proof #2)
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/contribute", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (res.ok && json.url) { window.location.assign(json.url); return; }
      setError(
        json.error === "provider_unavailable"
          ? "Secure checkout is temporarily unavailable. Nothing has been charged. Please try again shortly."
          : "This checkout could not be started. Nothing has been charged. Please refresh the page.",
      );
      setBusy(false);
    } catch {
      setError("Secure checkout is temporarily unavailable. Nothing has been charged.");
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" onClick={go} disabled={busy}
        style={{ width: "100%", minHeight: 48, fontSize: 14, fontWeight: 650, color: "#fff",
                 background: "#B8683D", border: 0, borderRadius: 9, cursor: busy ? "default" : "pointer" }}>
        {busy ? "Opening secure checkout…" : resume ? "Resume secure payment" : "Continue to secure payment"}
      </button>
      {error && <p style={{ color: "#A32D2D", fontSize: 13, marginTop: 10 }}>{error}</p>}
    </>
  );
}
