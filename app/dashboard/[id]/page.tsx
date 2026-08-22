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

  // PR 9 (D-086): the Financials tab and timeline are served entirely by the V2
  // panel, which reads canonical founder-safe views under the founder session.
  // Nothing financial is loaded here any more. The journey/cohort title stays
  // because it is scheduling context, not a financial fact.
  let journeyTitle: string | null = null;
  let journeyEndAt: string | null = null;
  {
    const { data: journey } = await supabase
      .from("journeys")
      .select("end_at, cohort_id")
      .eq("member_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
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


  // PR 9 (D-086): financial timeline events, projected server-side from
  // founder-safe V2 views. Only a label, a timestamp and a formatted amount
  // cross into the client — no provider id, actor or raw metadata.
  const fin = supabase.schema("finance_api");
  // Lifecycle rows are keyed by agreement, not by member, so they MUST be
  // restricted to this member's agreements explicitly. The agreement ids come
  // from a member-scoped query — deriving them from the activity rows would
  // yield an empty set for a member with no payments yet, and an empty set is
  // not a safe filter input.
  const [{ data: v2Activity }, { data: v2Agreements }] = await Promise.all([
    fin.from("founder_payment_activity").select("id, entry_type, amount_cents, occurred_at, member_id")
      .eq("member_id", id).order("occurred_at", { ascending: false }).limit(50),
    fin.from("agreement_balances").select("agreement_id").eq("member_id", id),
  ]);
  const agreementIds = ((v2Agreements ?? []) as Array<{ agreement_id: string }>)
    .map((a) => a.agreement_id);
  const { data: v2Lifecycle } = agreementIds.length
    ? await fin.from("founder_lifecycle_history")
        .select("id, agreement_id, to_status, occurred_at")
        .in("agreement_id", agreementIds)
    : { data: [] as Array<{ id: string; agreement_id: string; to_status: string; occurred_at: string }> };
  const ENTRY_LABEL: Record<string, string> = {
    stripe_payment: "Card payment",
    external_payment: "Recorded payment",
    refund: "Refund or correction",
    reversal: "Refund or correction",
  };
  const LIFECYCLE_LABEL: Record<string, string> = {
    draft: "Contribution created",
    active: "Contribution activated",
    fulfilled: "Contribution fulfilled",
    canceled: "Contribution canceled",
    waived: "Contribution waived",
  };
  const financeEvents = [
    ...((v2Activity ?? []) as Array<{ id: string; entry_type: string; amount_cents: number; occurred_at: string }>)
      .map((e) => ({
        id: `v2-ledger-${e.id}`,
        at: e.occurred_at,
        label: ENTRY_LABEL[e.entry_type] ?? "Payment activity",
        detail: `$${Math.abs(e.amount_cents / 100).toLocaleString("en-US")}${e.amount_cents < 0 ? " returned" : ""}`,
      })),
    ...((v2Lifecycle ?? []) as Array<{ id: string; agreement_id: string; to_status: string; occurred_at: string }>)
      .map((l) => ({
        id: `v2-lifecycle-${l.id}`,
        at: l.occurred_at,
        label: LIFECYCLE_LABEL[l.to_status] ?? "Contribution updated",
      })),
  ];

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
      journeyTitle={journeyTitle}
      journeyEndAt={journeyEndAt}
      specialists={specialists}
      nurses={nurses}
      outcomesRows={outcomesRows ?? []}
      booking={booking}
      financeEvents={financeEvents}
      labs={labDocs ?? []}
      dosing={dosing ?? []}
    />
  );
}
