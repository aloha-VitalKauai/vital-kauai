import { createClient } from "@/lib/supabase/server";
import MedicalView from "./MedicalView";

export const metadata = { title: "Medical Profiles — Vital Kauaʻi" };

export default async function MedicalPage() {
  const supabase = await createClient();

  const [{ data: members }, { data: intakes }] = await Promise.all([
    supabase
      .from("members")
      .select("id, full_name, email, assigned_partner, status, journey_focus, ceremony_date, medical_cleared, cardiac_cleared, bp_systolic, bp_diastolic, heart_rate, medical_notes, medication_interactions")
      .order("created_at", { ascending: false }),
    supabase.from("intake_forms").select("*"),
  ]);

  const intakeMap: Record<string, any> = {};
  for (const i of intakes ?? []) intakeMap[i.member_id] = i;

  const medMembers = (members ?? []).map((m) => ({
    ...m,
    intake: intakeMap[m.id] ?? null,
  }));

  return <MedicalView members={medMembers} />;
}
