"use client";

import { useState, type CSSProperties } from "react";
import SiteFooter from "@/components/SiteFooter";

export default function PortalContactPage() {
  const [delState, setDelState] = useState<
    "idle" | "confirm" | "sending" | "sent" | "error"
  >("idle");

  async function requestDeletion() {
    setDelState("sending");
    try {
      const res = await fetch("/api/account-deletion", { method: "POST" });
      setDelState(res.ok ? "sent" : "error");
    } catch {
      setDelState("error");
    }
  }

  const delBtn: CSSProperties = {
    fontSize: 11,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    fontWeight: 600,
    padding: "12px 22px",
    borderRadius: 4,
    background: "transparent",
    color: "#F5F0E8",
    border: "1px solid rgba(168,197,172,0.4)",
    cursor: "pointer",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0E1A10", color: "#F5F0E8" }}>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "80px 32px 100px" }}>
        <p style={{ fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase", color: "#C8A96E", fontWeight: 600, margin: "0 0 16px" }}>
          Contact
        </p>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(36px, 5vw, 52px)", fontWeight: 300, color: "#F5F0E8", margin: "0 0 24px", lineHeight: 1.1 }}>
          We Are <em style={{ fontStyle: "italic", color: "#A8C5AC" }}>Here for You</em>
        </h1>
        <p style={{ fontSize: 15, color: "rgba(245,240,232,0.78)", lineHeight: 1.85, marginBottom: 48, maxWidth: 580 }}>
          We are with you. Reach out anytime.
        </p>

        {/* Reach Us Directly */}
        <section
          style={{
            background: "rgba(245,240,232,0.04)",
            border: "1px solid rgba(168,197,172,0.18)",
            borderRadius: 12,
            padding: "32px 36px",
            marginBottom: 24,
          }}
        >
          <p style={{ fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", color: "#C8A96E", fontWeight: 600, margin: "0 0 18px" }}>
            Reach Us Directly
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 14 }}>
            <li style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: "#F5F0E8" }}>Rachel</span>
              <a href="tel:+18088555033" style={{ fontSize: 16, color: "#E2CFA0", textDecoration: "none", letterSpacing: "0.04em" }}>808-855-5033</a>
            </li>
            <li style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: "#F5F0E8" }}>Josh</span>
              <a href="tel:+16233308017" style={{ fontSize: 16, color: "#E2CFA0", textDecoration: "none", letterSpacing: "0.04em" }}>623-330-8017</a>
            </li>
            <li style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid rgba(168,197,172,0.12)", paddingTop: 14, marginTop: 4 }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: "#F5F0E8" }}>Email</span>
              <a href="mailto:aloha@vitalkauai.com" style={{ fontSize: 14, color: "#E2CFA0", textDecoration: "none", letterSpacing: "0.04em" }}>aloha@vitalkauai.com</a>
            </li>
          </ul>
        </section>

        {/* While on Kaua‘i */}
        <section
          style={{
            background: "rgba(184,105,74,0.06)",
            border: "1px solid rgba(184,105,74,0.22)",
            borderRadius: 12,
            padding: "28px 32px",
          }}
        >
          <p style={{ fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", color: "#D4917A", fontWeight: 600, margin: "0 0 14px" }}>
            While You Are on Kauaʻi
          </p>
          <p style={{ fontSize: 14, color: "rgba(245,240,232,0.72)", lineHeight: 1.75, margin: "0 0 12px" }}>
            For urgent medical support during your stay, also call <strong style={{ color: "#F5F0E8" }}>911</strong> or
            reach <strong style={{ color: "#F5F0E8" }}>Wilcox Medical Center</strong> in Līhuʻe.
          </p>
        </section>

        {/* Your account — deletion request */}
        <section
          style={{
            background: "rgba(245,240,232,0.04)",
            border: "1px solid rgba(168,197,172,0.18)",
            borderRadius: 12,
            padding: "28px 32px",
            marginTop: 24,
          }}
        >
          <p style={{ fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", color: "#C8A96E", fontWeight: 600, margin: "0 0 14px" }}>
            Your Account
          </p>
          <p style={{ fontSize: 14, color: "rgba(245,240,232,0.72)", lineHeight: 1.75, margin: "0 0 18px" }}>
            You can request deletion of your account at any time. We&rsquo;ll remove your account and member data and confirm with you by email.
          </p>
          {delState === "sent" ? (
            <p style={{ fontSize: 14, color: "#A8C5AC", lineHeight: 1.7, margin: 0 }}>
              Your request has been received. Our team will remove your account and follow up by email.
            </p>
          ) : delState === "confirm" ? (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={requestDeletion}
                style={{ ...delBtn, background: "#A32D2D", borderColor: "#A32D2D" }}
              >
                Confirm deletion request
              </button>
              <button type="button" onClick={() => setDelState("idle")} style={delBtn}>
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setDelState("confirm")}
                disabled={delState === "sending"}
                style={delBtn}
              >
                {delState === "sending" ? "Submitting…" : "Request account deletion"}
              </button>
              {delState === "error" && (
                <p style={{ fontSize: 13, color: "#E8A79B", lineHeight: 1.7, margin: "12px 0 0" }}>
                  We couldn&rsquo;t submit that just now. Please email{" "}
                  <a href="mailto:aloha@vitalkauai.com" style={{ color: "#E2CFA0" }}>aloha@vitalkauai.com</a>.
                </p>
              )}
            </>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
