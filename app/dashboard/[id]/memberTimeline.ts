/* ──────────────────────────────────────────────────────────────────
   Member Journey Timeline — read-only V1 aggregation.

   Pure utility: takes records the Member Profile already loads and folds
   them into a single chronological list of events. It uses ONLY existing
   timestamps — no new timestamps, no inference, no new tables/queries.

   Money-received events come exclusively from the `donations` ledger (the
   authoritative source the Financials card sums). The Square webhook writes
   the same payment to both donations and bookings.paid_at / deposit_paid_at,
   so those duplicate fields are intentionally NOT emitted here to avoid
   double-counting. ─────────────────────────────────────────────────── */

export type TimelineCategory =
  | "lifecycle"
  | "intake"
  | "documents"
  | "medical"
  | "financial"
  | "ceremony"
  | "dosing"
  | "integration";

export type TimelineEvent = {
  id: string;
  /** Original date/timestamp string from the source record. */
  date: string;
  /** Parsed epoch ms, for sorting. */
  ts: number;
  title: string;
  description?: string;
  category: TimelineCategory;
};

/* All-optional shapes so the profile's loosely-typed props pass straight in. */
type Dated = string | null | undefined;

export type TimelineInput = {
  member?: {
    created_at?: Dated;
    arrival_date?: Dated;
    departure_date?: Dated;
    ceremony_date?: Dated;
  } | null;
  profile?: {
    invited_at?: Dated;
    onboarding_completed_at?: Dated;
    membership_agreement_signed_at?: Dated;
    medical_disclaimer_signed_at?: Dated;
    safety_agreement_signed_at?: Dated;
  } | null;
  intake?: { submission_date?: Dated } | null;
  checklist?: Array<{
    id?: string;
    item_key?: string | null;
    completed?: boolean | null;
    completed_at?: Dated;
  }>;
  ceremonies?: Array<{
    id?: string;
    ceremony_date?: Dated;
    status?: string | null;
    guides_present?: string | null;
    medicine_form?: string | null;
  }>;
  donations?: Array<{
    id?: string;
    amount_cents?: number | null;
    completed_at?: Dated;
    kind?: string | null;
  }>;
  tokens?: Array<{ token?: string; created_at?: Dated }>;
  labs?: Array<{
    id?: string;
    lab_type?: string | null;
    status?: string | null;
    uploaded_at?: Dated;
    founder_reviewed_at?: Dated;
  }>;
  dosing?: Array<{
    id?: string;
    administered_at?: Dated;
    dose_g?: number | null;
    medicine_batches?: { batch_code?: string | null; medicine_form?: string | null } | null;
    ceremony_records?: { ceremony_date?: Dated } | null;
  }>;
  booking?: {
    created_at?: Dated;
    package_name?: string | null;
  } | null;
  preProgress?: { weeks_completed?: number[] | null; last_updated?: Dated } | null;
  postProgress?: { weeks_completed?: number[] | null; last_updated?: Dated } | null;
};

/* ── Small display helpers ─────────────────────────────────────── */
function money(dollars: number) {
  return "$" + Number(dollars).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function humanize(key: string | null | undefined) {
  if (!key) return "";
  return key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

const LAB_LABELS: Record<string, string> = {
  ekg: "EKG / QTc",
  thyroid: "Thyroid Panel",
  liver: "Liver Panel",
  magnesium: "Magnesium",
  stress_test: "Cardiac Stress Test",
  cyp450: "CYP450",
  cmp: "CMP",
};
function labLabel(type: string | null | undefined) {
  if (!type) return "Lab";
  return LAB_LABELS[type] ?? humanize(type);
}

function donationKindLabel(kind: string | null | undefined) {
  switch (kind) {
    case "initial_membership":
      return "Initial membership";
    case "journey_contribution":
      return "Journey contribution";
    case "additional_gift":
      return "Additional gift";
    case "monthly_membership":
      return "Monthly membership";
    default:
      return "Contribution";
  }
}

/* ── Aggregator ────────────────────────────────────────────────── */
export function buildMemberTimeline(input: TimelineInput): TimelineEvent[] {
  const out: TimelineEvent[] = [];

  const add = (
    id: string,
    date: Dated,
    title: string,
    category: TimelineCategory,
    description?: string,
  ) => {
    if (!date) return;
    const ts = new Date(date).getTime();
    if (Number.isNaN(ts)) return;
    out.push({ id, date, ts, title, category, description });
  };

  const m = input.member ?? {};
  const p = input.profile ?? {};

  /* Lifecycle */
  add("member-created", m.created_at, "Member created", "lifecycle");
  add("member-invited", p.invited_at, "Member invited", "lifecycle", "Portal invitation sent");
  add("onboarding-completed", p.onboarding_completed_at, "Onboarding completed", "lifecycle");

  /* Intake */
  add("intake-completed", input.intake?.submission_date, "Intake completed", "intake");
  for (const item of input.checklist ?? []) {
    if (item.completed && item.completed_at && !(item.item_key ?? "").startsWith("post_")) {
      add(
        `checklist-${item.id ?? item.item_key}`,
        item.completed_at,
        `Readiness: ${humanize(item.item_key)}`,
        "intake",
      );
    }
  }

  /* Documents (canonical agreement timestamps) */
  add("doc-membership", p.membership_agreement_signed_at, "Membership agreement signed", "documents");
  add("doc-medical-disclaimer", p.medical_disclaimer_signed_at, "Medical disclaimer signed", "documents");
  add("doc-safety", p.safety_agreement_signed_at, "Participant safety & consent signed", "documents");

  /* Medical (labs) */
  for (const lab of input.labs ?? []) {
    add(`lab-up-${lab.id}`, lab.uploaded_at, `Lab uploaded: ${labLabel(lab.lab_type)}`, "medical");
    if (lab.founder_reviewed_at) {
      const verb =
        lab.status === "approved" ? "approved" : lab.status === "flagged" ? "flagged" : "reviewed";
      add(
        `lab-rev-${lab.id}`,
        lab.founder_reviewed_at,
        `Lab ${verb}: ${labLabel(lab.lab_type)}`,
        "medical",
      );
    }
  }

  /* Financial — donations ledger is the single source for money received */
  add("booking-created", input.booking?.created_at, "Booking created", "financial", input.booking?.package_name ?? undefined);
  for (const t of input.tokens ?? []) {
    add(`token-${t.token}`, t.created_at, "Payment link sent", "financial");
  }
  for (const d of input.donations ?? []) {
    add(
      `donation-${d.id}`,
      d.completed_at,
      `Contribution received — ${donationKindLabel(d.kind)}`,
      "financial",
      d.amount_cents != null ? money(d.amount_cents / 100) : undefined,
    );
  }

  /* Ceremony */
  const ceremonies = input.ceremonies ?? [];
  for (const c of ceremonies) {
    const completed = c.status === "Complete";
    const desc =
      [
        c.guides_present ? `Guide: ${c.guides_present}` : null,
        c.medicine_form ? `Medicine: ${c.medicine_form}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || undefined;
    add(
      `ceremony-${c.id}`,
      c.ceremony_date,
      completed ? "Ceremony completed" : "Ceremony scheduled",
      "ceremony",
      desc,
    );
  }
  if (ceremonies.length === 0) {
    add("ceremony-scheduled", m.ceremony_date, "Ceremony scheduled", "ceremony");
  }
  // Arrival/departure are founder-entered planned dates (scheduling), so they
  // are hedged as "scheduled" — parity with the ceremony-date event above.
  add("arrival", m.arrival_date, "Arrival scheduled", "lifecycle");
  add("departure", m.departure_date, "Departure scheduled", "lifecycle");

  /* Dosing */
  for (const dz of input.dosing ?? []) {
    const date = dz.administered_at ?? dz.ceremony_records?.ceremony_date;
    const desc =
      [
        dz.dose_g != null ? `${dz.dose_g} g` : null,
        dz.medicine_batches?.batch_code ? `Batch ${dz.medicine_batches.batch_code}` : null,
        dz.medicine_batches?.medicine_form ?? null,
      ]
        .filter(Boolean)
        .join(" · ") || undefined;
    add(`dosing-${dz.id}`, date, "Medicine administered", "dosing", desc);
  }

  /* Integration (last-active timestamps; week counts have no per-week stamp) */
  if (input.preProgress?.last_updated) {
    const w = input.preProgress.weeks_completed?.length ?? 0;
    add("pre-progress", input.preProgress.last_updated, "Pre-ceremony preparation", "integration", `${w}/6 weeks complete`);
  }
  if (input.postProgress?.last_updated) {
    const w = input.postProgress.weeks_completed?.length ?? 0;
    add("post-progress", input.postProgress.last_updated, "Post-ceremony integration", "integration", `${w}/6 weeks complete`);
  }

  /* Most recent first */
  out.sort((a, b) => b.ts - a.ts);
  return out;
}
