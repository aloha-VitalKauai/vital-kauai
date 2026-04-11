import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalHomePage } from "@/components/portal-home-page";

export default async function PortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/portal");
  }

  return <PortalHomePage userEmail={user.email ?? ""} userId={user.id} />;
}
