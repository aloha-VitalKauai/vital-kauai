import type { Viewport } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PortalNav } from "@/components/portal-nav";
import { MobileSanctuaryDock } from "@/components/portal/MobileSanctuaryDock";

export const metadata = { title: "Member Portal — Vital Kauaʻi" };

// viewport-fit:cover lets safe-area-inset-* env() vars pick up real
// values on notched / rounded-corner devices (e.g. iPhone with
// Dynamic Island). themeColor tints Android Chrome's address bar and
// the iOS standalone-mode status bar background to forest, matching
// the portal nav. Scoped to /portal/* — marketing routes keep the
// Next.js default viewport.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1C2B1E",
};

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portal");

  return (
    // overflowX: clip prevents horizontal-overflow nightmares on small
    // viewports without breaking the sticky portal nav (clip — unlike
    // hidden — does not establish a new scroll container).
    <div style={{ overflowX: "clip" }}>
      <PortalNav email={user.email ?? ""} />
      {children}
      <MobileSanctuaryDock />
    </div>
  );
}
