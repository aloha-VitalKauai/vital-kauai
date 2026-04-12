import { createClient } from "@/lib/supabase/server";
import DosingClient from "./DosingClient";

export const metadata = { title: "Dosing — Vital Kauaʻi" };

export default async function DosingPage() {
  const supabase = await createClient();

  const [{ data: dosing }, { data: batches }, { data: members }, { data: ceremonies }] =
    await Promise.all([
      supabase
        .from("dosing_records")
        .select("*, medicine_batches ( batch_code, ibogaine_pct, total_alkaloids_pct, medicine_form ), ceremony_records ( ceremony_date, status )")
        .order("administered_at", { ascending: false }),
      supabase.from("medicine_batches").select("*").order("received_date", { ascending: false }),
      supabase.from("members").select("id, full_name, email").order("full_name"),
      supabase.from("ceremony_records").select("id, ceremony_date, member_id, status").order("ceremony_date", { ascending: false }).limit(50),
    ]);

  return (
    <DosingClient
      dosing={dosing ?? []}
      batches={batches ?? []}
      members={members ?? []}
      ceremonies={ceremonies ?? []}
    />
  );
}
