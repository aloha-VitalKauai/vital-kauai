import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "../dashboard/SignOutButton";

export const metadata = { title: "Care Team — Vital Kauaʻi" };

// The nurse portal. Only accounts with the 'nurse' role get in; everyone
// else is routed to where they belong. Data access inside is enforced by
// RLS — a nurse only ever sees members assigned to them.
export default async function NurseLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/nurse");

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleRow?.role !== "nurse") {
    redirect(roleRow?.role === "founder" ? "/dashboard" : "/portal");
  }

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
            href="/nurse"
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
            Care team
          </span>
        </div>
        <SignOutButton />
      </header>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem" }}>{children}</main>
    </div>
  );
}
