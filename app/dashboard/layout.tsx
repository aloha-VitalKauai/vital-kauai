import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "./SignOutButton";
import DashboardTabs from "./DashboardTabs";

export const metadata = { title: "Dashboard — Vital Kauaʻi" };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8" }}>
      <header
        style={{
          background: "#fff",
          borderBottom: "0.5px solid rgba(0,0,0,0.1)",
          padding: "0 2rem",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a
            href="/"
            style={{
              fontFamily: "var(--font-display, serif)",
              fontSize: 18,
              letterSpacing: "-0.01em",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            Vital Kaua&#699;i
          </a>
          <span
            style={{
              fontSize: 10,
              color: "#085041",
              background: "#E1F5EE",
              padding: "2px 8px",
              borderRadius: 99,
              fontWeight: 500,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              fontFamily: "var(--font-body, sans-serif)",
            }}
          >
            Founder
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/portal" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", background: "none", border: "0.5px solid rgba(0,0,0,0.2)", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "var(--font-body, sans-serif)", color: "#3d3d3a", textDecoration: "none" }}>Member Portal</a>
          <a href="/dashboard/ops" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", background: "#0E0C0A", border: "0.5px solid rgba(0,0,0,0.35)", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "var(--font-body, sans-serif)", color: "#F0EBE0", textDecoration: "none" }}>Ops Dashboard</a>
          <a href="/founders/outcomes" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", background: "#0E0C0A", border: "0.5px solid rgba(0,0,0,0.35)", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "var(--font-body, sans-serif)", color: "#F0EBE0", textDecoration: "none" }}>Outcomes Portal</a>
          <span style={{ fontSize: 13, color: "#6B6B67", fontFamily: "var(--font-body, sans-serif)" }}>{user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <DashboardTabs />
      <main style={{ padding: "1.75rem 2rem", maxWidth: 1300, margin: "0 auto" }}>{children}</main>
    </div>
  );
}
