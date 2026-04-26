"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PortalNav } from "@/components/portal-nav";

export default function PortalContactPage() {
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserEmail(user.email ?? "");
    })();
  }, [supabase]);

  return (
    <div style={{ minHeight: "100vh", background: "#0E1A10", color: "#F5F0E8" }}>
      <PortalNav email={userEmail} currentPage="contact" />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "80px 32px 100px" }}>
        <p style={{ fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase", color: "#C8A96E", fontWeight: 600, margin: "0 0 16px" }}>
          Contact
        </p>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(36px, 5vw, 52px)", fontWeight: 300, color: "#F5F0E8", margin: "0 0 24px", lineHeight: 1.1 }}>
          We Are <em style={{ fontStyle: "italic", color: "#A8C5AC" }}>Here for You</em>
        </h1>
        <p style={{ fontSize: 15, color: "rgba(245,240,232,0.78)", lineHeight: 1.85, marginBottom: 48, maxWidth: 580 }}>
          You are never alone in this. Rachel and Josh are present throughout your preparation,
          ceremony, and integration, and reachable for whatever arises.
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
          <p style={{ fontSize: 13, color: "rgba(245,240,232,0.55)", lineHeight: 1.7, marginTop: 20, marginBottom: 0 }}>
            Text or call anytime. We hold this work as personally as you do.
          </p>
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
          <p style={{ fontSize: 12, color: "rgba(245,240,232,0.45)", lineHeight: 1.65, margin: 0 }}>
            We carry the on-island contacts and full directions in your arrival packet, this is a
            quick reference.
          </p>
        </section>
      </main>
    </div>
  );
}
