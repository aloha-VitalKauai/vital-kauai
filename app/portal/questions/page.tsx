import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import QuestionsClient from "./QuestionsClient";

export const metadata = { title: "Questions for the Medicine — Vital Kauaʻi" };

export default async function QuestionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <QuestionsClient />;
}
