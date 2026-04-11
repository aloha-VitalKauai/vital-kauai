import { createClient } from "@/lib/supabase/server";
import MedicalView from "./MedicalView";

export const metadata = { title: "Medical Profiles — Vital Kauaʻi" };

export default async function MedicalPage() {
  const supabase = await createClient();

  const [{ data: members }, { data: intakes }, { data: labDocs }] = await Promise.all([
    supabase
      .from("members")
      .select("id, full_name, email, assigned_partner, status, journey_focus, ceremony_date, medical_cleared, cardiac_cleared, bp_systolic, bp_diastolic, heart_rate, medical_notes, medication_interactions")
      .order("created_at", { ascending: false }),
    supabase.from("intake_forms").select("*"),
    supabase.from("lab_documents").select("*").order("uploaded_at", { ascending: false }),
  ]);

  const intakeMap: Record<string, any> = {};
  for (const i of intakes ?? []) intakeMap[i.member_id] = i;

  const labMap: Record<string, any[]> = {};
  for (const l of labDocs ?? []) {
    labMap[l.member_id] ??= [];
    labMap[l.member_id].push(l);
  }

  const medMembers = (members ?? []).map((m) => ({
    ...m,
    intake: intakeMap[m.id] ?? null,
    labs: labMap[m.id] ?? [],
  }));

  return <MedicalView members={medMembers} />;
}
