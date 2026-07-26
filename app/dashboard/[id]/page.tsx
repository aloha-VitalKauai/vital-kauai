import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import MemberProfileEditor from "./MemberProfileEditor";
import { getCurrentBookingForMember } from "@/lib/api/bookings";
import { NURSE_ROLES } from "@/lib/practitioners";
import {
  canCareTeamViewJournal,
  resolveJournalSharingState,
  sanitizeProgressForFounder,
  summarizeJournalResponses,
} from "@/lib/journal-sharing";
import { extractMedicineQuestions } from "@/lib/medicine-questions";

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
    { data: labDocs },
    { data: dosing },
  ] = await Promise.all([
    supabase.from("members").select("*").eq("id", id).maybeSingle(),
    supabase.from("member_profiles").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("intake_forms")
      .select("*")
      .eq("member_id", id)
      .order("submission_date", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
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
    // Lab documents power the Member Profile Medical tab (same source as the
    // standalone ops Medical view), scoped to this member.
    supabase
      .from("lab_documents")
      .select("*")
      .eq("member_id", id)
      .order("uploaded_at", { ascending: false }),
    // Dosing records power the Member Profile Dosing tab (read-only), scoped
    // to this member. Same source as the standalone ops Dosing view.
    supabase
      .from("dosing_records")
      .select("*, medicine_batches ( batch_code, ibogaine_pct, total_alkaloids_pct, medicine_form ), ceremony_records ( ceremony_date, status )")
      .eq("member_id", id)
      .order("administered_at", { ascending: false }),
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

  // Journal-sharing consent gate. The member row (loaded via founder RLS)
  // carries journal_sharing_enabled / legacy_journal_access_enabled; only when
  // one is true may the care team see this member's journal, PNE, and
  // medicine-question responses. Enforced below by stripping response text from
  // the props when access is not allowed.
  const canViewJournal = canCareTeamViewJournal(member);
  const journalSharingState = resolveJournalSharingState(member);

  // Look up auth user ID via member_profiles (for pre/post ceremony progress)
  const { data: profileByEmail } = await supabase
    .from("member_profiles")
    .select("id")
    .eq("email", member.email)
    .maybeSingle();

  let preProgress = null;
  let postProgress = null;
  let medicineQuestions: ReturnType<typeof extractMedicineQuestions> = [];
  let medicineQuestionCount = 0;
  if (profileByEmail) {
    const [{ data: pre }, { data: post }, { data: mj }] = await Promise.all([
      supabase.from("pre_ceremony_progress").select("weeks_completed, checklist_items, journal_responses, last_updated").eq("member_id", profileByEmail.id).maybeSingle(),
      supabase.from("post_ceremony_progress").select("weeks_completed, checklist_items, weekly_tracking, journal_responses, last_updated").eq("member_id", profileByEmail.id).maybeSingle(),
      supabase.from("member_journals").select("responses").eq("member_id", profileByEmail.id).maybeSingle(),
    ]);
    preProgress = pre;
    postProgress = post;

    // Questions-for-the-Medicine: the submitted COUNT is progress metadata and
    // is shown regardless of sharing; the question TEXT is only forwarded to the
    // client when the member has shared.
    const mqGroups = extractMedicineQuestions(
      (mj?.responses as Record<string, string> | null) ?? null,
    );
    medicineQuestionCount = mqGroups.reduce((n, g) => n + g.questions.length, 0);
    if (canViewJournal) medicineQuestions = mqGroups;
  }

  // Response/reflection counts are metadata — computed from the raw maps here,
  // before response text is stripped below, so they display for every member.
  const responseSummary = summarizeJournalResponses(
    preProgress?.journal_responses as Record<string, unknown> | null,
    postProgress?.journal_responses as Record<string, unknown> | null,
  );

  // Consent gate: strip pre/post journal + PNE response text before it reaches
  // the founder's browser when the member has not shared. Progress metadata
  // (weeks_completed, last_updated, …) is kept so the dashboard still shows
  // counts, completed weeks, and last-active dates.
  const safePreProgress = sanitizeProgressForFounder(preProgress, canViewJournal);
  const safePostProgress = sanitizeProgressForFounder(postProgress, canViewJournal);

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

  // Active nurse-eligible practitioners for the Assigned Nurse dropdown.
  const { data: nurseRows } = await supabase
    .from("practitioners")
    .select("id, full_name")
    .eq("active", true)
    .in("role", NURSE_ROLES)
    .order("full_name", { ascending: true });
  const nurses = (nurseRows ?? []) as Array<{ id: string; full_name: string }>;

  const booking = await getCurrentBookingForMember(supabase, id);

  return (
    <MemberProfileEditor
      member={member}
      profile={profile}
      intake={intake}
      documents={documents ?? []}
      ceremonies={ceremonies ?? []}
      checklist={checklist ?? []}
      preProgress={safePreProgress}
      postProgress={safePostProgress}
      journalSharingState={journalSharingState}
      medicineQuestions={medicineQuestions}
      medicineQuestionCount={medicineQuestionCount}
      journalResponseCount={responseSummary.journal}
      pneReflectionCount={responseSummary.pne}
      commitment={commitment ?? undefined}
      collectedCents={collectedCents}
      tokens={tokens}
      tokenAmounts={tokenAmounts}
      donations={(memberDonationsData ?? []) as Array<{ id: string; amount_cents: number; completed_at: string | null; kind: string; metadata: Record<string, unknown> | null }>}
      journeyTitle={journeyTitle}
      journeyEndAt={journeyEndAt}
      specialists={specialists}
      nurses={nurses}
      outcomesRows={outcomesRows ?? []}
      bookedCents={bookedCents}
      expenseCents={expenseCents}
      booking={booking}
      labs={labDocs ?? []}
      dosing={dosing ?? []}
    />
  );
}
