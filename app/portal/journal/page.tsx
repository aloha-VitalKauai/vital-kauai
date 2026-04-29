import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import JournalClient from "./JournalClient";

export const metadata = { title: "Comprehensive Journal — Vital Kauaʻi" };

export default async function JournalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portal/journal");
  return <JournalClient />;
}
