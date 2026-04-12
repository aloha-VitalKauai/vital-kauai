import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import WhatToBringClient from "./WhatToBringClient";

export const metadata = { title: "What to Bring — Vital Kauaʻi" };

export default async function WhatToBringPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <WhatToBringClient />;
}
