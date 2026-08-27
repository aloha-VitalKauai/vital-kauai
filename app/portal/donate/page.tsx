/**
 * PR 8 (D-085): the Member Contribution Portal — V2 only.
 *
 * Every figure on this page comes from the four member-safe finance_api views,
 * read under the member's own session (finance.current_member_id() is the
 * boundary). There is no legacy read, no fallback, and no client arithmetic: a
 * failed read renders an explicit unavailable state, never $0, because a zero
 * is a fact while a failed read is unknown.
 *
 * FINANCE_V2_CHECKOUT_READY gates checkout issuance only — figures remain
 * readable when payment is paused.
 */

import { createClient } from "@/lib/supabase/server";
import ContributionPortalClient from "./ContributionPortalClient";

export const metadata = { title: "Your Contribution—Vital Kauaʻi" };
export const dynamic = "force-dynamic";

export type MemberOverview = {
  contribution_cents: number;
  contribution_received_cents: number;
  additional_gifts_received_cents: number;
  net_received_cents: number;
  refunded_cents: number;
  remaining_cents: number;
  payable_remaining_cents: number;
  active_agreement_count: number;
};

export type MemberAgreement = {
  agreement_id: string;
  journey_id: string | null;
  purpose: string;
  contribution_cents: number;
  received_cents: number;
  refunded_cents: number;
  remaining_cents: number;
  payable_remaining_cents: number;
  payment_state: string;
  lifecycle_status: string | null;
};

export type MemberActivity = {
  entry_id: string;
  agreement_id: string;
  journey_id: string | null;
  purpose: string;
  entry_type: string;
  amount_cents: number;
  occurred_at: string;
};

export type MemberAttempt = {
  attempt_id: string;
  agreement_id: string;
  amount_cents: number;
  status: string;
  expires_at: string | null;
  completed_at: string | null;
};

export default async function ContributionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // layout guards auth; defensive

  const fin = supabase.schema("finance_api");
  const [overviewRes, agreementsRes, activityRes, attemptsRes, journeysRes] = await Promise.all([
    fin.from("member_contribution_overview").select("*").returns<MemberOverview[]>(),
    fin.from("member_contribution_agreements").select("*").returns<MemberAgreement[]>(),
    fin.from("member_payment_activity").select("*")
      .order("occurred_at", { ascending: false }).limit(50).returns<MemberActivity[]>(),
    fin.from("member_checkout_status").select("*")
      .in("status", ["creating", "open"]).returns<MemberAttempt[]>(),
    supabase.from("journeys").select("id, start_at"),
  ]);

  // Unknown is not zero: a failed canonical read renders an explicit error.
  const overview = overviewRes.error ? null : (overviewRes.data?.[0] ?? null);
  const agreements = agreementsRes.error ? null : (agreementsRes.data ?? []);
  const activity = activityRes.error ? null : (activityRes.data ?? []);
  const liveAttempts = attemptsRes.error ? [] : (attemptsRes.data ?? []);

  const journeyDates = new Map<string, string | null>();
  for (const j of (journeysRes.data ?? []) as { id: string; start_at: string | null }[]) {
    journeyDates.set(j.id, j.start_at);
  }

  return (
    <ContributionPortalClient
      overview={overview}
      agreements={agreements?.map((a) => ({
        ...a,
        journeyStartAt: a.journey_id ? (journeyDates.get(a.journey_id) ?? null) : null,
      })) ?? null}
      activity={activity}
      liveAttempts={liveAttempts}
      attemptsFailed={Boolean(attemptsRes.error)}
      checkoutReady={process.env.FINANCE_V2_CHECKOUT_READY === "true"}
    />
  );
}
