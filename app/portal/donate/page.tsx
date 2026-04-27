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

  const [{ data: ov }, { data: memberRow }, { data: history }] = await Promise.all([
    // Filter explicitly by user.id. RLS scopes regular members to one row, but
    // founders can read all rows — without this filter maybeSingle() returns
    // null for any founder testing the portal, hiding their own pledge.
    supabase
      .from("member_financial_overview")
      .select("*")
      .eq("member_id", user.id)
      .maybeSingle(),
    // Source of truth for program price (founder sets this in member editor).
    supabase.from("members").select("program_price").eq("id", user.id).maybeSingle(),
    supabase
      .from("donations")
      .select("id, amount_cents, completed_at, receipt_url, kind")
      .eq("member_id", user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false }),
  ]);

  // first_name from auth metadata, falling back to first word of full_name, then "friend"
  const firstName =
    (user.user_metadata?.first_name as string | undefined) ||
    (ov?.full_name ? (ov.full_name as string).split(" ")[0] : null) ||
    "friend";

  const programPriceCents =
    memberRow?.program_price != null
      ? Math.round(Number(memberRow.program_price) * 100)
      : 0;

  // Unilateral "Pledged" amount: prefer the active commitment's number, fall
  // back to the member's program_price so the member sees what they owe even
  // before a journey/commitment is scheduled.
  const expected = ov?.journey_expected_amount_cents ?? programPriceCents;
  const paid = ov?.journey_paid_amount_cents ?? 0;
  const remaining =
    ov?.journey_remaining_amount_cents ?? Math.max(programPriceCents - paid, 0);

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
      expected={expected}
      paid={paid}
      remaining={remaining}
      journeyId={ov?.active_journey_id ?? null}
      memberId={user.id}
      history={history ?? []}
    />
  );
}
