import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PortalNav } from "@/components/portal-nav";

export const metadata = { title: "Post-Ceremony Integration — Vital Kauaʻi" };

export default async function PostCeremonyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div style={{ minHeight: "100vh", background: "#FDFBF7", fontFamily: "'Jost', sans-serif", fontWeight: 300 }}>
      <PortalNav />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "120px 40px", textAlign: "center" }}>
        <span style={{ fontSize: 9, letterSpacing: "0.42em", textTransform: "uppercase", color: "#C8A96E", display: "block", marginBottom: 20 }}>Integration</span>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 42, fontWeight: 300, color: "#1A1A18", lineHeight: 1.1, marginBottom: 24 }}>
          Post-Ceremony<br /><em style={{ fontStyle: "italic", color: "#7A9E7E" }}>Integration</em>
        </h1>
        <p style={{ fontSize: 15, color: "#8B8070", lineHeight: 1.85, marginBottom: 40 }}>
          This section will open after your ceremony is complete. Your integration guide will walk with you through the weeks and months that follow &mdash; this is where the deepest work takes root.
        </p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(122,158,126,0.08)", border: "1px solid rgba(122,158,126,0.15)", borderRadius: 8, padding: "12px 24px" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#C8A96E" }} />
          <span style={{ fontSize: 13, color: "#8B8070" }}>Coming soon &mdash; unlocks after ceremony</span>
        </div>
      </div>
    </div>
  );
}
