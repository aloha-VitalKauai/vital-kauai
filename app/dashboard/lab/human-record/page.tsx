// app/dashboard/lab/human-record/page.tsx
//
// Human Record Sandbox — experiment-006 of the Human Record Lab.
//
// The first capability that becomes visible. A READ-ONLY, founder-gated, internal
// page that observes one real member through existing production data — presented
// as a calm human journey rather than a database. It accompanies the existing
// Vital Kauaʻi member journey; it never replaces it.
//
// Guarantees (verified by lib/experimental/human-record-sandbox/verify.ts and by
// inspection):
//   - Reads production only. No insert/update/delete/upsert/rpc. Never writes.
//   - No migrations, no external API calls, no AI/LLM calls.
//   - Founder-gated: middleware (/dashboard/*) + dashboard layout + verifyFounder().
//   - Not added to navigation (no DashboardTabs entry, no link anywhere).
//   - Surfaces only SAFE operational/identity fields — never medical, screening,
//     contraindication, dosing, assessment, or other Level-4 / PHI data.
//   - Deleting this folder leaves the rest of production behaving exactly as before.

import { redirect } from "next/navigation";

import { verifyFounder } from "@/lib/auth/founder-check";
import { listLenses } from "@/lib/experimental/lenses";
import { listObservations } from "@/lib/experimental/observation";
import { listRelationships } from "@/lib/experimental/relationships";
import { WEEKS } from "@/lib/integration-content/pre-ceremony-weeks";
import { currentWeekForJourney } from "@/lib/journey-emails";
import { PRE_CEREMONY_WEEKS, PRE_PNE_DETAILS } from "@/lib/journal-prompts";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Human Record — Vital Kauaʻi" };
export const dynamic = "force-dynamic";

// The first sample member. This sandbox is not specific to any one person —
// Joshua Perdue is simply the first profile used to validate the experience.
// Changing this constant points the sandbox at a different member.
const SAMPLE_MEMBER_EMAIL = "joshuaperdue2@gmail.com";

// --- safe row shapes (only fields this page is permitted to read) ------------
type SafeMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string | null;
  membership_tier: string | null;
  journey_focus: string | null;
  assigned_partner: string | null;
  integration_guide: string | null;
  ceremony_date: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  portal_unlocked: boolean | null;
  integration_unlocked: boolean | null;
  created_at: string | null;
};
type SafeProfile = {
  membership_agreement_signed: boolean | null;
  membership_agreement_signed_at: string | null;
  medical_disclaimer_signed: boolean | null;
  medical_disclaimer_signed_at: string | null;
  safety_agreement_signed: boolean | null;
  safety_agreement_signed_at: string | null;
  deposit_paid: boolean | null;
  deposit_paid_at: string | null;
  onboarding_complete: boolean | null;
  onboarding_completed_at: string | null;
  invited_at: string | null;
};
type SignedDoc = {
  document_name: string | null;
  document_version: string | null;
  signed_at: string | null;
};
type ChecklistItem = {
  item_key: string;
  completed: boolean | null;
  completed_at: string | null;
};
type Progress = {
  current_week: number | null;
  weeks_completed: number[] | null;
  last_updated: string | null;
  journal_responses: Record<string, unknown> | null;
};

// --- calm palette + type ------------------------------------------------------
const C = {
  cream: "#FBF7EE",
  warm: "#FDFAF6",
  border: "#E7E0CE",
  ink: "#2C2416",
  inkSoft: "#5C5040",
  inkFaint: "#9A8E7A",
  sage: "#6B8C6E",
  sageBg: "#EDF2EC",
  teal: "#085041",
  gold: "#B8956A",
  forest: "#1C2B1E",
};
const serif = "'Cormorant Garamond', var(--font-display, serif)";
const sans = "var(--font-body, sans-serif)";

// --- tiny pure helpers --------------------------------------------------------
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function humanize(key: string): string {
  const s = key.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function countAnswered(resp: Record<string, unknown> | null | undefined): number {
  if (!resp || typeof resp !== "object") return 0;
  return Object.values(resp).filter(
    (v) => typeof v === "string" && v.trim().length > 0,
  ).length;
}

function isAnswered(
  resp: Record<string, unknown> | null | undefined,
  key: string,
): boolean {
  const v = resp?.[key];
  return typeof v === "string" && v.trim().length > 0;
}

// --- presentational components (pure) ----------------------------------------
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        letterSpacing: "0.28em",
        textTransform: "uppercase",
        color: C.gold,
        fontWeight: 600,
        fontFamily: sans,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: serif,
        fontSize: 30,
        fontWeight: 400,
        lineHeight: 1.15,
        color: C.ink,
        margin: 0,
      }}
    >
      {children}
    </h2>
  );
}

function Section({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 64 }}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <SectionTitle>{title}</SectionTitle>
      {intro ? (
        <p
          style={{
            fontFamily: sans,
            fontSize: 14,
            lineHeight: 1.7,
            color: C.inkFaint,
            maxWidth: 560,
            margin: "12px 0 0",
          }}
        >
          {intro}
        </p>
      ) : null}
      <div style={{ marginTop: 24 }}>{children}</div>
    </section>
  );
}

function Card({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: accent ? C.warm : C.cream,
        border: `0.5px solid ${C.border}`,
        borderRadius: 14,
        padding: "20px 22px",
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: C.inkFaint,
          fontFamily: sans,
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 15, color: C.ink, fontFamily: sans }}>
        {value || "—"}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: sans,
        fontSize: 14,
        fontStyle: "italic",
        color: C.inkFaint,
        lineHeight: 1.7,
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

function Tag({ children, tone = "sage" }: { children: React.ReactNode; tone?: "sage" | "gold" }) {
  const color = tone === "sage" ? C.sage : C.gold;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "2px 9px",
        borderRadius: 20,
        color,
        background: `${color}14`,
        border: `0.5px solid ${color}40`,
        fontFamily: sans,
      }}
    >
      {children}
    </span>
  );
}

// --- page ---------------------------------------------------------------------
export default async function HumanRecordSandboxPage() {
  // Defense-in-depth on top of middleware + dashboard layout.
  const founder = await verifyFounder();
  if (!founder) redirect("/login");

  const supabase = await createClient();

  // READ-ONLY: a single member by email, safe fields only.
  const { data: memberRow } = await supabase
    .from("members")
    .select(
      "id, full_name, email, status, membership_tier, journey_focus, assigned_partner, integration_guide, ceremony_date, arrival_date, departure_date, portal_unlocked, integration_unlocked, created_at",
    )
    .ilike("email", SAMPLE_MEMBER_EMAIL)
    .maybeSingle();
  const member = (memberRow as SafeMember | null) ?? null;

  let profile: SafeProfile | null = null;
  let documents: SignedDoc[] = [];
  let checklist: ChecklistItem[] = [];
  let prePct: Progress | null = null;
  let postPct: Progress | null = null;

  if (member?.id) {
    const [p, docs, cl, preP, postP] = await Promise.all([
      supabase
        .from("member_profiles")
        .select(
          "membership_agreement_signed, membership_agreement_signed_at, medical_disclaimer_signed, medical_disclaimer_signed_at, safety_agreement_signed, safety_agreement_signed_at, deposit_paid, deposit_paid_at, onboarding_complete, onboarding_completed_at, invited_at",
        )
        .eq("id", member.id)
        .maybeSingle(),
      supabase
        .from("signed_documents")
        .select("document_name, document_version, signed_at")
        .eq("member_id", member.id)
        .order("signed_at", { ascending: false }),
      supabase
        .from("member_checklist")
        .select("item_key, completed, completed_at")
        .eq("member_id", member.id)
        .eq("completed", true)
        .order("completed_at", { ascending: true }),
      supabase
        .from("pre_ceremony_progress")
        .select("current_week, weeks_completed, last_updated, journal_responses")
        .eq("member_id", member.id)
        .maybeSingle(),
      supabase
        .from("post_ceremony_progress")
        .select("current_week, weeks_completed, last_updated, journal_responses")
        .eq("member_id", member.id)
        .maybeSingle(),
    ]);
    profile = (p.data as SafeProfile | null) ?? null;
    documents = (docs.data as SignedDoc[] | null) ?? [];
    checklist = (cl.data as ChecklistItem[] | null) ?? [];
    prePct = (preP.data as Progress | null) ?? null;
    postPct = (postP.data as Progress | null) ?? null;
  }

  // Current week of the existing curriculum — derived from the member's ceremony
  // date if known, otherwise Week One. The curriculum is read, never rewritten.
  const cw = member?.ceremony_date
    ? currentWeekForJourney(member.ceremony_date)
    : null;
  const weekIdx =
    cw && cw.arc === "pre" && WEEKS[cw.week_idx] ? cw.week_idx : 0;
  const week = WEEKS[weekIdx];

  const weekPrompts = (PRE_CEREMONY_WEEKS[weekIdx]?.prompts ?? []).map((p, j) => ({
    q: p.q,
    answered: isAnswered(prePct?.journal_responses, p.key ?? `w${weekIdx}-p${j}`),
  }));
  const weekPractice = PRE_PNE_DETAILS[weekIdx]?.practice ?? "";

  const reflectionCount =
    countAnswered(prePct?.journal_responses) +
    countAnswered(postPct?.journal_responses);
  const weeksCompleted =
    (prePct?.weeks_completed?.length ?? 0) +
    (postPct?.weeks_completed?.length ?? 0);

  const observations = listObservations();
  const relationships = listRelationships();
  const lenses = listLenses();

  const displayName = member?.full_name || "This member";

  return (
    <div
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "8px 4px 80px",
        fontFamily: sans,
      }}
    >
      {/* Sandbox banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 36,
          paddingBottom: 18,
          borderBottom: `0.5px solid ${C.border}`,
        }}
      >
        <Tag tone="gold">Human Record Lab</Tag>
        <Tag tone="sage">Sandbox</Tag>
        <span
          style={{
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: C.inkFaint,
          }}
        >
          Read-only · Internal · Experiment-006
        </span>
      </div>

      {/* Header */}
      <header style={{ marginBottom: 56 }}>
        <Eyebrow>A Human Journey</Eyebrow>
        <h1
          style={{
            fontFamily: serif,
            fontSize: 48,
            fontWeight: 300,
            lineHeight: 1.05,
            color: C.ink,
            margin: 0,
          }}
        >
          {displayName}
        </h1>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.75,
            color: C.inkSoft,
            maxWidth: 600,
            marginTop: 18,
          }}
        >
          The Human Record accompanies the existing Vital Kauaʻi journey. The
          curriculum remains the source of truth; what follows is context
          gathered around it — observed read-only and held with care.
        </p>
      </header>

      {/* Identity */}
      <Section
        eyebrow="Identity"
        title="Who they are"
        intro="Operational identity, drawn directly from the production record."
      >
        {member ? (
          <Card>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "0 28px",
              }}
            >
              <Field label="Name" value={member.full_name} />
              <Field label="Email" value={member.email} />
              <Field
                label="Journey status"
                value={member.status ? <Tag>{member.status}</Tag> : "—"}
              />
              <Field label="Membership" value={member.membership_tier} />
              <Field label="Journey focus" value={member.journey_focus} />
              <Field label="Guide" value={member.assigned_partner} />
              <Field label="Integration guide" value={member.integration_guide} />
              <Field label="Member since" value={fmtDate(member.created_at)} />
            </div>
          </Card>
        ) : (
          <Card>
            <Empty>
              No production record is linked to the sample address yet. The
              journey and laboratory context below still render; identity will
              appear once a member record exists.
            </Empty>
          </Card>
        )}
      </Section>

      {/* Current Journey — the existing curriculum, unchanged */}
      <Section
        eyebrow="Current Journey"
        title="This week's principle"
        intro="The existing Vital Kauaʻi curriculum, displayed exactly as the program holds it."
      >
        <Card accent>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: C.gold }}>
              Week {weekIdx + 1}
            </span>
            <span style={{ fontSize: 12, color: C.inkFaint }}>{week.theme}</span>
          </div>
          <div
            style={{
              fontFamily: serif,
              fontSize: 40,
              fontWeight: 400,
              color: C.teal,
              margin: "8px 0 4px",
            }}
          >
            {week.principleName}
          </div>
          <div
            style={{
              fontFamily: serif,
              fontSize: 24,
              fontStyle: "italic",
              color: C.ink,
              marginBottom: 16,
            }}
          >
            “{week.principle}”
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.8, color: C.inkSoft, maxWidth: 620 }}>
            {week.title} {week.subtitle}
          </div>
        </Card>
      </Section>

      {/* Context — operational status */}
      <Section
        eyebrow="Context"
        title="Where they stand"
        intro="Observed operational progress — only what already exists."
      >
        {member ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <Card>
              <Field label="Journey status" value={member.status} />
              <Field label="Ceremony" value={fmtDate(member.ceremony_date)} />
              <Field label="Arrival" value={fmtDate(member.arrival_date)} />
              <Field
                label="Access"
                value={[
                  member.portal_unlocked ? "Portal" : null,
                  member.integration_unlocked ? "Integration" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              />
            </Card>
            <Card>
              <Field
                label="Onboarding"
                value={profile?.onboarding_complete ? "Complete" : "In progress"}
              />
              <Field label="Membership agreement" value={profile?.membership_agreement_signed ? fmtDate(profile.membership_agreement_signed_at) : "Open"} />
              <Field label="Medical disclaimer" value={profile?.medical_disclaimer_signed ? fmtDate(profile.medical_disclaimer_signed_at) : "Open"} />
              <Field label="Safety agreement" value={profile?.safety_agreement_signed ? fmtDate(profile.safety_agreement_signed_at) : "Open"} />
            </Card>
          </div>
        ) : (
          <Card>
            <Empty>Operational context will appear once a member record exists.</Empty>
          </Card>
        )}
      </Section>

      {/* Observations — Capability 003 */}
      <Section
        eyebrow="Observations · Capability 003"
        title="What the lab observes"
        intro="Typed, immutable descriptions of production objects. Observational only."
      >
        <div style={{ display: "grid", gap: 12 }}>
          {observations.map((o) => (
            <Card key={o.object_name}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontFamily: serif, fontSize: 19, color: C.ink }}>{o.object_name}</span>
                <Tag>{o.object_category}</Tag>
              </div>
              <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.6 }}>
                {o.notes}
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {o.current_capabilities.map((c) => (
                  <Tag key={c} tone="sage">{c}</Tag>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* Relationships — Capability 004 */}
      <Section
        eyebrow="Relationships · Capability 004"
        title="How things connect"
        intro="Descriptive connections between observed objects — they state how things relate."
      >
        <Card>
          <div style={{ display: "grid", gap: 12 }}>
            {relationships.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  fontSize: 14,
                  color: C.ink,
                  paddingBottom: 10,
                  borderBottom: `0.5px solid ${C.border}`,
                }}
              >
                <span style={{ fontFamily: serif, fontSize: 17 }}>{r.source_object}</span>
                <Tag tone="gold">{r.relationship_type.replace(/_/g, " ")}</Tag>
                <span style={{ fontFamily: serif, fontSize: 17 }}>{r.target_object}</span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* Evidence — existing production artifacts, made discoverable */}
      <Section
        eyebrow="Evidence"
        title="What already exists"
        intro="Existing production artifacts connected to this member, made discoverable and held as they are."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          <Card>
            <div style={{ fontFamily: serif, fontSize: 18, color: C.ink, marginBottom: 12 }}>
              Signed documents
            </div>
            {documents.length ? (
              documents.map((d, i) => (
                <div key={`${d.document_name}-${i}`} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 14, color: C.ink }}>{d.document_name || "Document"}</div>
                  <div style={{ fontSize: 12, color: C.inkFaint }}>{fmtDate(d.signed_at)}</div>
                </div>
              ))
            ) : (
              <Empty>None recorded yet.</Empty>
            )}
          </Card>
          <Card>
            <div style={{ fontFamily: serif, fontSize: 18, color: C.ink, marginBottom: 12 }}>
              Completed milestones
            </div>
            {checklist.length ? (
              checklist.map((c) => (
                <div key={c.item_key} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 14, color: C.ink }}>{humanize(c.item_key)}</div>
                  <div style={{ fontSize: 12, color: C.inkFaint }}>{fmtDate(c.completed_at)}</div>
                </div>
              ))
            ) : (
              <Empty>None recorded yet.</Empty>
            )}
          </Card>
          <Card>
            <div style={{ fontFamily: serif, fontSize: 18, color: C.ink, marginBottom: 12 }}>
              Reflections
            </div>
            <div style={{ fontSize: 36, fontFamily: serif, color: C.teal, lineHeight: 1 }}>
              {reflectionCount}
            </div>
            <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 6 }}>
              {reflectionCount === 1 ? "reflection written" : "reflections written"}
              {weeksCompleted ? ` · ${weeksCompleted} weeks engaged` : ""}
            </div>
          </Card>
        </div>
      </Section>

      {/* Lenses — Capability 005 */}
      <Section
        eyebrow="Lenses · Capability 005"
        title="Available perspectives"
        intro="Optional interpretive frameworks, held as metadata only. Observed reality always remains primary; every perspective stays optional."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          {lenses.map((l) => (
            <Card key={l.id}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontFamily: serif, fontSize: 19, color: C.ink }}>{l.name}</span>
                <Tag>{l.category}</Tag>
              </div>
              <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.6 }}>
                {l.description}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* Context for This Week — surfaces existing artifacts only */}
      <Section
        eyebrow="Context for This Week"
        title="What may be worth revisiting"
        intro="Existing artifacts that relate to this week's principle, surfaced as they are. Interpretation stays with the people who know this human."
      >
        <div style={{ display: "grid", gap: 14 }}>
          <Card accent>
            <div style={{ fontFamily: serif, fontSize: 18, color: C.ink, marginBottom: 12 }}>
              Relevant reflections — Week {weekIdx + 1}, {week.principleName}
            </div>
            {weekPrompts.length ? (
              weekPrompts.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    marginBottom: 12,
                  }}
                >
                  <span style={{ marginTop: 2 }}>
                    <Tag tone={p.answered ? "sage" : "gold"}>
                      {p.answered ? "Answered" : "Open"}
                    </Tag>
                  </span>
                  <span style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.6 }}>
                    {p.q}
                  </span>
                </div>
              ))
            ) : (
              <Empty>This week holds no journal prompts.</Empty>
            )}
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            <Card>
              <div style={{ fontFamily: serif, fontSize: 18, color: C.ink, marginBottom: 10 }}>
                Relevant practice
              </div>
              {weekPractice ? (
                <div style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.6 }}>{weekPractice}</div>
              ) : (
                <Empty>No practice is paired with this week.</Empty>
              )}
            </Card>
            <Card>
              <div style={{ fontFamily: serif, fontSize: 18, color: C.ink, marginBottom: 10 }}>
                Relevant documents
              </div>
              {documents.length ? (
                <div style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.8 }}>
                  {documents.map((d, i) => (
                    <div key={i}>{d.document_name || "Document"}</div>
                  ))}
                </div>
              ) : (
                <Empty>None recorded yet.</Empty>
              )}
            </Card>
          </div>
        </div>
      </Section>

      {/* Future placeholder */}
      <section
        style={{
          marginTop: 24,
          padding: "28px 26px",
          borderRadius: 14,
          background: C.forest,
          color: "rgba(245,240,232,0.92)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "rgba(200,169,110,0.9)",
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          Future Capabilities
        </div>
        <div style={{ fontFamily: serif, fontSize: 26, fontWeight: 300, marginBottom: 6 }}>
          Context Engine
        </div>
        <div style={{ fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(168,197,172,0.85)" }}>
          Not Yet Implemented
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.75, color: "rgba(245,240,232,0.7)", maxWidth: 560, marginTop: 16 }}>
          Personalization is intentionally deferred. For now the Human Record
          observes and surfaces what already exists. Interpretation stays in the
          hands of the people who know this human.
        </p>
      </section>
    </div>
  );
}
