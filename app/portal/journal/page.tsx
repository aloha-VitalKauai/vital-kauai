import { redirect } from "next/navigation";

export const metadata = { title: "Iboga Journey Journal — Vital Kauaʻi" };

// Comprehensive Journal is hidden while we re-do the weekly prompts and
// re-wire the cross-week sync. The page is intentionally redirected to the
// dashboard so direct hits / bookmarks don't land on stale content. The
// JournalClient component still lives at ./JournalClient.tsx — to restore,
// re-enable this body:
//
//   import { createClient } from "@/lib/supabase/server";
//   import JournalClient from "./JournalClient";
//   const supabase = await createClient();
//   const { data: { user } } = await supabase.auth.getUser();
//   if (!user) redirect("/login");
//   return <JournalClient />;

export default function JournalPage() {
  redirect("/portal");
}
