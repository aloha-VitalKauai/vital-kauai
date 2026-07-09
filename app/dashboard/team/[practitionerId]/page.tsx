import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PractitionerDetailClient from "./PractitionerDetailClient";
import type { Practitioner, PractitionerDocument } from "@/lib/practitioners";

export async function generateMetadata({ params }: { params: Promise<{ practitionerId: string }> }) {
  const { practitionerId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("practitioners")
    .select("full_name")
    .eq("id", practitionerId)
    .maybeSingle();
  return { title: data ? `${data.full_name} — Team — Vital Kauaʻi` : "Team — Vital Kauaʻi" };
}

export default async function PractitionerPage({
  params,
}: {
  params: Promise<{ practitionerId: string }>;
}) {
  const { practitionerId } = await params;
  const supabase = await createClient();

  const [{ data: practitioner }, { data: documents }] = await Promise.all([
    supabase
      .from("practitioners")
      .select("id, full_name, email, phone, role, engagement_type, active, notes, created_at, auth_user_id")
      .eq("id", practitionerId)
      .maybeSingle(),
    supabase
      .from("practitioner_documents")
      .select("id, practitioner_id, doc_type, title, file_name, file_path, file_size_bytes, version, signed_at, expires_at, notes, created_at")
      .eq("practitioner_id", practitionerId)
      .order("created_at", { ascending: false }),
  ]);

  if (!practitioner) notFound();

  return (
    <PractitionerDetailClient
      practitioner={practitioner as Practitioner}
      documents={(documents ?? []) as PractitionerDocument[]}
    />
  );
}
