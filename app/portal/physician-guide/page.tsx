import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PhysicianGuideClient from "./PhysicianGuideClient";

export const metadata = { title: "Physician Reference Guide — Vital Kauaʻi" };

export default async function PhysicianGuidePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portal/physician-guide");
  return <PhysicianGuideClient />;
}
