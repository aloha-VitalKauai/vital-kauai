import { createClient } from "@/lib/supabase/server";
import JourneyPaymentCard from "./JourneyPaymentCard";

export default async function JourneyPaymentPage() {
  const supabase = await createClient();
  const { data: overview } = await supabase
    .from("member_financial_overview")
    .select("*")
    .single();

  if (!overview?.active_journey_id) {
    return <p>No active journey yet.</p>;
  }
  if (!overview.active_commitment_id) {
    return (
      <p>No financial commitment set for your active journey yet.</p>
    );
  }

  return (
    <JourneyPaymentCard
      journeyId={overview.active_journey_id}
      expected={overview.journey_expected_amount_cents ?? 0}
      paid={overview.journey_paid_amount_cents ?? 0}
      remaining={overview.journey_remaining_amount_cents ?? 0}
      status={overview.financial_status}
    />
  );
}
