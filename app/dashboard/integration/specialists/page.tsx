import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import SpecialistsClient from "./SpecialistsClient";

export const metadata = { title: "Integration Specialists — Vital Kauaʻi" };

export default async function SpecialistsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("integration_specialists")
    .select("id, name, email, photo_url, bio, calendly_url, active, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9E9E9A", marginBottom: 3 }}>
        <Link href="/dashboard/integration" style={{ color: "inherit", textDecoration: "none" }}>← Integration</Link>
      </p>
      <h1 style={{ fontFamily: "var(--font-display, serif)", fontSize: 26, fontWeight: 400, letterSpacing: "-0.02em", color: "#1A1A18", marginBottom: "1.25rem" }}>
        Integration Specialists
      </h1>
      <p style={{ fontSize: 13, color: "#6B6B67", maxWidth: 640, marginBottom: "1.5rem" }}>
        Specialists added here appear in the Guide dropdown on the Integration page.
        When assigned, a member sees the specialist's photo and a "Book a Session" link
        to their Calendly on their portal home page.
      </p>
      <SpecialistsClient specialists={data ?? []} />
    </div>
  );
}
