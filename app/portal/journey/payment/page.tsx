import { createClient } from "@/lib/supabase/server";
import { isSquareActive } from "@/lib/payment-provider";
import { getCurrentBookingForAuthUser } from "@/lib/api/bookings";
import JourneyPaymentCard from "./JourneyPaymentCard";

export default async function JourneyPaymentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const provider: "stripe" | "square" = isSquareActive() ? "square" : "stripe";

  if (provider === "square") {
    // Bookings-first read. The Square webhook keeps amount_paid_cents and
    // payment_status in sync; the portal renders straight off the row.
    const booking = await getCurrentBookingForAuthUser(supabase, user.email ?? "");
    if (!booking) {
      return <p>No active booking yet.</p>;
    }
    const expected = booking.amount_due_cents ?? 0;
    const paid = booking.amount_paid_cents ?? 0;
    return (
      <JourneyPaymentCard
        provider="square"
        journeyId={booking.journey_id ?? booking.id}
        bookingId={booking.id}
        expected={expected}
        paid={paid}
        remaining={Math.max(expected - paid, 0)}
        status={booking.payment_status === "paid" ? "paid" : booking.payment_status}
      />
    );
  }

  // Stripe path (default). Untouched from PR 1 — reads the legacy
  // member_financial_overview view.
  const { data: overview } = await supabase
    .from("member_financial_overview")
    .select("*")
    .eq("member_id", user.id)
    .maybeSingle();

  if (!overview?.active_journey_id) {
    return <p>No active journey yet.</p>;
  }
  if (!overview.active_commitment_id) {
    return <p>No financial commitment set for your active journey yet.</p>;
  }

  return (
    <JourneyPaymentCard
      provider="stripe"
      journeyId={overview.active_journey_id}
      expected={overview.journey_expected_amount_cents ?? 0}
      paid={overview.journey_paid_amount_cents ?? 0}
      remaining={overview.journey_remaining_amount_cents ?? 0}
      status={overview.financial_status}
    />
  );
}
