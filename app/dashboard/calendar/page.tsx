import CalendarClient from "@/components/dashboard/calendar/CalendarClient";

export const metadata = { title: "Calendar — Vital Kauaʻi" };

// Internal operations calendar. Founder-gated by middleware (which protects all
// /dashboard routes) and wrapped in the dashboard chrome by
// app/dashboard/layout.tsx. The interactive grid + CRUD live in the client
// island, which talks to the founder-gated /api/admin/calendar endpoints.
export default function CalendarPage() {
  return <CalendarClient />;
}
