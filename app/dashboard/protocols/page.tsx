import ProtocolsClient from "@/components/dashboard/protocols/ProtocolsClient";

export const metadata = { title: "Protocols — Vital Kauaʻi" };

// Protocol Template Engine. Founder-gated by middleware (all /dashboard routes)
// and wrapped in the dashboard chrome by app/dashboard/layout.tsx. The
// interactive workspace talks to the founder-gated /api/admin/protocols
// endpoints and applies templates into the existing calendar_events table.
export default function ProtocolsPage() {
  return <ProtocolsClient />;
}
