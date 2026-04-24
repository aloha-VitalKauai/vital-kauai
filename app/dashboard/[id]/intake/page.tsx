import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  INTAKE_SECTIONS,
  collectExtraResponses,
  readIntakeValue,
} from "@/lib/intake-fields";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("full_name")
    .eq("id", id)
    .maybeSingle();
  return {
    title: member ? `${member.full_name} — Intake — Vital Kauaʻi` : "Intake — Vital Kauaʻi",
  };
}

function fmtDatetime(d: string | null | undefined) {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function humanizeKey(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/* ── Form-aesthetic colour tokens (mirrors public/intake-form-legacy.html) ── */
const COLORS = {
  forest: "#1C2B1E",
  sage: "#7A9E7E",
  sageLight: "#A8C5AC",
  gold: "#C8A96E",
  cream: "#F5F0E8",
  warmWhite: "#FDFBF7",
  textDark: "#1A1A18",
  textMid: "#3D3D38",
  textMuted: "#8B8070",
  border: "rgba(28,43,30,0.1)",
};

const SERIF = "'Cormorant Garamond', 'Cormorant', Georgia, serif";
const SANS = "'Jost', system-ui, -apple-system, sans-serif";

export default async function MemberIntakeReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: member }, { data: intake }] = await Promise.all([
    supabase.from("members").select("id, full_name, email").eq("id", id).maybeSingle(),
    supabase
      .from("intake_forms")
      .select("*")
      .eq("member_id", id)
      .order("submission_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!member) notFound();

  const intakeRecord = (intake ?? null) as Record<string, unknown> | null;
  const extras = intakeRecord ? collectExtraResponses(intakeRecord) : [];

  return (
    <div
      style={{
        background: COLORS.warmWhite,
        margin: "-1.75rem -2rem",
        padding: "0 0 80px",
        minHeight: "calc(100vh - 56px - 48px)",
        fontFamily: SANS,
        color: COLORS.textDark,
      }}
    >
      {/* Top bar — back link + member identity */}
      <div
        style={{
          background: COLORS.cream,
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "20px 2rem",
        }}
      >
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <Link
            href={`/dashboard/${member.id}`}
            style={{
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: COLORS.textMid,
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            ← Back to {member.full_name}&rsquo;s profile
          </Link>
          <div style={{ marginTop: 18 }}>
            <p
              style={{
                fontSize: 8.5,
                letterSpacing: "0.44em",
                textTransform: "uppercase",
                color: COLORS.gold,
                margin: 0,
                fontWeight: 500,
              }}
            >
              Member Intake Submission
            </p>
            <h1
              style={{
                fontFamily: SERIF,
                fontSize: "clamp(28px, 3.4vw, 42px)",
                fontWeight: 300,
                lineHeight: 1.15,
                margin: "10px 0 6px",
                color: COLORS.forest,
              }}
            >
              {member.full_name}
              <span style={{ fontStyle: "italic", color: COLORS.sage }}>&rsquo;s intake</span>
            </h1>
            <p
              style={{
                fontSize: 12.5,
                color: COLORS.textMuted,
                margin: 0,
                letterSpacing: "0.02em",
              }}
            >
              {intakeRecord?.submission_date
                ? `Submitted ${fmtDatetime(String(intakeRecord.submission_date))}`
                : intakeRecord
                  ? "Submitted (date unknown)"
                  : "Not yet submitted"}
              {member.email ? ` · ${member.email}` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "0 2rem" }}>
        {!intakeRecord ? (
          <div
            style={{
              marginTop: 64,
              padding: "48px 36px",
              background: "white",
              border: `1px solid ${COLORS.border}`,
              borderLeft: `2px solid ${COLORS.sageLight}`,
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: SERIF,
                fontSize: 24,
                fontWeight: 300,
                color: COLORS.forest,
                margin: "0 0 8px",
              }}
            >
              No intake on file <em style={{ color: COLORS.sage }}>yet</em>
            </p>
            <p style={{ fontSize: 13.5, color: COLORS.textMuted, margin: 0 }}>
              {member.full_name.split(" ")[0]} hasn&rsquo;t submitted the intake form. Once
              they do, the full submission will appear here, formatted just like the form
              they filled out.
            </p>
          </div>
        ) : (
          <div>
            {INTAKE_SECTIONS.map((sec, idx) => {
              const rows = sec.fields
                .map(
                  ([key, label]) =>
                    [key, label, readIntakeValue(intakeRecord, key)] as const,
                )
                .filter(([, , value]) => value !== "");
              if (!rows.length) return null;
              return (
                <section
                  key={sec.title}
                  style={{
                    padding: "56px 0",
                    borderBottom: `1px solid ${COLORS.border}`,
                  }}
                >
                  <p
                    style={{
                      fontSize: 8.5,
                      letterSpacing: "0.44em",
                      textTransform: "uppercase",
                      color: COLORS.gold,
                      margin: 0,
                      fontWeight: 500,
                    }}
                  >
                    Section {String(idx + 1).padStart(2, "0")}
                  </p>
                  <h2
                    style={{
                      fontFamily: SERIF,
                      fontSize: "clamp(24px, 2.6vw, 32px)",
                      fontWeight: 300,
                      lineHeight: 1.2,
                      margin: "10px 0 28px",
                      color: COLORS.forest,
                    }}
                  >
                    {renderSectionTitle(sec.title)}
                  </h2>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 22,
                    }}
                  >
                    {rows.map(([key, label, value]) => (
                      <div key={key}>
                        <label
                          style={{
                            display: "block",
                            fontSize: 12,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: COLORS.textDark,
                            marginBottom: 8,
                            fontWeight: 500,
                          }}
                        >
                          {label}
                        </label>
                        <div
                          style={{
                            padding: "13px 15px",
                            background: "white",
                            border: `1px solid ${COLORS.border}`,
                            borderLeft: `2px solid ${COLORS.sageLight}`,
                            fontFamily: SANS,
                            fontSize: 13.5,
                            lineHeight: 1.55,
                            color: COLORS.textDark,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}

            {extras.length > 0 && (
              <section
                style={{
                  padding: "56px 0",
                  borderBottom: `1px solid ${COLORS.border}`,
                }}
              >
                <p
                  style={{
                    fontSize: 8.5,
                    letterSpacing: "0.44em",
                    textTransform: "uppercase",
                    color: COLORS.gold,
                    margin: 0,
                    fontWeight: 500,
                  }}
                >
                  Additional
                </p>
                <h2
                  style={{
                    fontFamily: SERIF,
                    fontSize: "clamp(24px, 2.6vw, 32px)",
                    fontWeight: 300,
                    lineHeight: 1.2,
                    margin: "10px 0 28px",
                    color: COLORS.forest,
                  }}
                >
                  Other <em style={{ color: COLORS.sage }}>responses</em>
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                  {extras.map(([key, value]) => (
                    <div key={key}>
                      <label
                        style={{
                          display: "block",
                          fontSize: 12,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: COLORS.textDark,
                          marginBottom: 8,
                          fontWeight: 500,
                        }}
                      >
                        {humanizeKey(key)}
                      </label>
                      <div
                        style={{
                          padding: "13px 15px",
                          background: "white",
                          border: `1px solid ${COLORS.border}`,
                          borderLeft: `2px solid ${COLORS.sageLight}`,
                          fontFamily: SANS,
                          fontSize: 13.5,
                          lineHeight: 1.55,
                          color: COLORS.textDark,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div
              style={{
                padding: "40px 0 0",
                fontSize: 11,
                color: COLORS.textMuted,
                letterSpacing: "0.04em",
              }}
            >
              Founder-only review · read-only copy of the member&rsquo;s submission.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Mirrors the form's pattern of italicising the final word of each section
 * title in sage — gives the review page the same visual cadence as the
 * member-facing form without hard-coding every title twice.
 */
function renderSectionTitle(title: string) {
  const parts = title.split(" ");
  if (parts.length < 2) return title;
  const last = parts.pop()!;
  return (
    <>
      {parts.join(" ")} <em style={{ fontStyle: "italic", color: COLORS.sage }}>{last}</em>
    </>
  );
}
