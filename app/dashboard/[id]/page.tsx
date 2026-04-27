import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import MemberProfileEditor from "./MemberProfileEditor";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("full_name")
    .eq("id", id)
    .maybeSingle();
  return { title: member ? `${member.full_name} — Vital Kauaʻi` : "Member — Vital Kauaʻi" };
}

export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: member },
    { data: profile },
    { data: intake },
    { data: documents },
    { data: ceremonies },
    { data: checklist },
    { data: commitment },
    { data: memberDonationsData },
    { data: privateCeremonyRows },
  ] = await Promise.all([
    supabase.from("members").select("*").eq("id", id).maybeSingle(),
    supabase.from("member_profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("intake_forms").select("*").eq("member_id", id).maybeSingle(),
    supabase.from("signed_documents").select("*").eq("member_id", id).order("signed_at", { ascending: false }),
    supabase.from("ceremony_records").select("*").eq("member_id", id).order("ceremony_date", { ascending: false }),
    supabase.from("member_checklist").select("*").eq("member_id", id).order("created_at", { ascending: true }),
    supabase
      .from("financial_commitments")
      .select("id, expected_amount_cents, status, journey_id, kind")
      .eq("member_id", id)
      .in("status", ["draft", "active", "partially_paid", "paid", "waived"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("donations")
      .select("id, amount_cents, completed_at, kind, metadata, status")
      .eq("member_id", id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(25),
    supabase
      .from("private_ceremony_summary")
      .select("booked_cents, expense_cents")
      .eq("member_id", id),
  ]);

  // Roll up booked + expenses across this member's private ceremony journeys so
  // the profile's Program Price / Cost of Service cards mirror the Financials
  // → Private Ceremony tab. Null when the member has no private journeys yet —
  // the editor falls back to the manually-entered members.program_price /
  // cost_of_service in that case.
  const pcRows = (privateCeremonyRows ?? []) as Array<{
    booked_cents: number | null;
    expense_cents: number | null;
  }>;
  const bookedCents = pcRows.length
    ? pcRows.reduce((sum, r) => sum + (r.booked_cents ?? 0), 0)
    : null;
  const expenseCents = pcRows.length
    ? pcRows.reduce((sum, r) => sum + (r.expense_cents ?? 0), 0)
    : null;

  if (!member) notFound();

  // Look up auth user ID via member_profiles (for pre/post ceremony progress)
  const { data: profileByEmail } = await supabase
    .from("member_profiles")
    .select("id")
    .eq("email", member.email)
    .maybeSingle();

  let preProgress = null;
  let postProgress = null;
  if (profileByEmail) {
    const [{ data: pre }, { data: post }] = await Promise.all([
      supabase.from("pre_ceremony_progress").select("weeks_completed, checklist_items, journal_responses, last_updated").eq("member_id", profileByEmail.id).maybeSingle(),
      supabase.from("post_ceremony_progress").select("weeks_completed, checklist_items, weekly_tracking, journal_responses, last_updated").eq("member_id", profileByEmail.id).maybeSingle(),
    ]);
    preProgress = pre;
    postProgress = post;
  }

  // Outcomes timeline — every approved member with a scheduled ceremony has rows here.
  const { data: outcomesRows } = await supabase
    .from("member_assessment_status")
    .select("ceremony_id, ceremony_date, timepoint, timepoint_label, sort_order, status, submitted_at, phq9_total, phq9_severity, gad7_total, gad7_severity")
    .eq("member_id", id)
    .order("sort_order", { ascending: true });

  // Financial detail: allocations, tokens, journey+cohort title
  let collectedCents = 0;
  let tokens: Array<{ token: string; expires_at: string; consumed_at: string | null; created_at: string }> = [];
  let journeyTitle: string | null = null;
  let journeyEndAt: string | null = null;

  if (commitment) {
    const [{ data: allocs }, { data: toks }] = await Promise.all([
      supabase
        .from("payment_allocations")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select("allocated_amount_cents, donation:donations(status)" as any)
        .eq("commitment_id", commitment.id),
      supabase
        .from("payment_tokens")
        .select("token, expires_at, consumed_at, created_at")
        .eq("commitment_id", commitment.id)
        .order("created_at", { ascending: false }),
    ]);

    collectedCents = ((allocs ?? []) as unknown as Array<{ allocated_amount_cents: number; donation: { status: string } | null }>)
      .filter((r) => r.donation?.status === "completed")
      .reduce((sum, r) => sum + r.allocated_amount_cents, 0);

    tokens = (toks ?? []) as typeof tokens;

    // Journey → cohort title
    if (commitment.journey_id) {
      const { data: journey } = await supabase
        .from("journeys")
        .select("end_at, cohort_id")
        .eq("id", commitment.journey_id)
        .maybeSingle();

      if (journey?.cohort_id) {
        const { data: cohort } = await supabase
          .from("cohorts")
          .select("title, end_at")
          .eq("id", journey.cohort_id)
          .maybeSingle();
        journeyTitle = (cohort as { title?: string | null })?.title ?? null;
        journeyEndAt = (cohort as { end_at?: string | null })?.end_at ?? journey.end_at ?? null;
      } else {
        journeyEndAt = journey?.end_at ?? null;
      }
    }
  }

  // Build token → donation amount map (consumed tokens show what was paid)
  const tokenAmounts: Record<string, number> = {};
  for (const d of memberDonationsData ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tokenUsed = (d.metadata as any)?.token_used;
    if (tokenUsed && d.amount_cents) {
      tokenAmounts[tokenUsed] = d.amount_cents;
    }
  }

  // Active integration specialists for the Assigned Partner dropdown.
  const { data: specialistRows } = await supabase
    .from("integration_specialists")
    .select("name")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  const specialists = (specialistRows ?? []).map((s) => s.name);

  return (
    <MemberProfileEditor
      member={member}
      profile={profile}
      intake={intake}
      documents={documents ?? []}
      ceremonies={ceremonies ?? []}
      checklist={checklist ?? []}
      preProgress={preProgress}
      postProgress={postProgress}
      commitment={commitment ?? undefined}
      collectedCents={collectedCents}
      tokens={tokens}
      tokenAmounts={tokenAmounts}
      donations={(memberDonationsData ?? []) as Array<{ id: string; amount_cents: number; completed_at: string | null; kind: string; metadata: Record<string, unknown> | null }>}
      journeyTitle={journeyTitle}
      journeyEndAt={journeyEndAt}
      specialists={specialists}
      outcomesRows={outcomesRows ?? []}
      bookedCents={bookedCents}
      expenseCents={expenseCents}
    />
  );
}
