import { createClient } from "@/lib/supabase/server";
import DonateClient from "./DonateClient";

export const metadata = { title: "Donate — Vital Kaua\u02BBi" };

export default async function DonatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Layout already guards auth; this is defensive.
  if (!user) return null;

  const { data: ov } = await supabase
    .from("member_financial_overview")
    .select("*")
    .maybeSingle();

  const { data: history } = await supabase
    .from("donations")
    .select("id, amount_cents, completed_at, receipt_url, kind")
    .eq("member_id", user.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  // first_name from auth metadata, falling back to first word of full_name, then "friend"
  const firstName =
    (user.user_metadata?.first_name as string | undefined) ||
    (ov?.full_name ? (ov.full_name as string).split(" ")[0] : null) ||
    "friend";

  let state: "no-commitment" | "pay-toward-pledge" | "complete";
  if (!ov?.active_commitment_id) {
    state = "no-commitment";
  } else if (
    (ov.journey_remaining_amount_cents ?? 1) === 0 ||
    ov.financial_status === "paid"
  ) {
    state = "complete";
  } else {
    state = "pay-toward-pledge";
  }

  return (
    <DonateClient
      state={state}
      firstName={firstName}
      expected={ov?.journey_expected_amount_cents ?? 0}
      paid={ov?.journey_paid_amount_cents ?? 0}
      remaining={ov?.journey_remaining_amount_cents ?? 0}
      journeyId={ov?.active_journey_id ?? null}
      history={history ?? []}
    />
  );
}
