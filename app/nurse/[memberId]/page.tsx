import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import MedicalNotesLog from "@/components/dashboard/MedicalNotesLog";
import LabDocumentsList from "./LabDocumentsList";

export const dynamic = "force-dynamic";

const CARD: React.CSSProperties = {
  background: "#fff",
  border: "0.5px solid rgba(0,0,0,0.1)",
  borderRadius: 10,
  padding: "1.25rem",
};

const LABEL: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#6B6B67",
  marginBottom: 12,
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  const has = value !== null && value !== undefined && `${value}`.trim() !== "";
  return (
    <div>
      <p style={{ fontSize: 12, color: "#6B6B67", margin: "0 0 2px" }}>{label}</p>
      <p style={{ fontSize: 13, color: has ? "#1A1A18" : "#9E9E9A", margin: 0, whiteSpace: "pre-wrap" }}>
        {has ? value : "—"}
      </p>
    </div>
  );
}

export default async function NurseMemberPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: member }, { data: intake }, { data: labs }, { data: me }] = await Promise.all([
    supabase.from("nurse_member_medical").select("*").eq("id", memberId).maybeSingle(),
    supabase
      .from("intake_forms")
      .select("*")
      .eq("member_id", memberId)
      .order("submission_date", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lab_documents")
      .select("id, lab_type, file_name, file_path, status, uploaded_at")
      .eq("member_id", memberId)
      .order("uploaded_at", { ascending: false }),
    supabase
      .from("practitioners")
      .select("full_name")
      .eq("auth_user_id", user?.id ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle(),
  ]);

  // The view returns nothing for members not assigned to this nurse — RLS by
  // construction, so an unassigned member's URL is simply a 404.
  if (!member) notFound();

  const nurseName = me?.full_name ?? "Nurse";

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link
          href="/nurse"
          style={{
            fontSize: 12,
            color: "#6B6B67",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 12,
          }}
        >
          &larr; Members in your care
        </Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <h1
            style={{
              fontFamily: "var(--font-display, serif)",
              fontSize: 30,
              fontWeight: 400,
              letterSpacing: "-0.02em",
              color: "#1A1A18",
              margin: 0,
            }}
          >
            {member.full_name}
          </h1>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { label: "Medical", ok: !!member.medical_cleared },
              { label: "Cardiac", ok: !!member.cardiac_cleared },
            ].map((c) => (
              <span
                key={c.label}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "4px 12px",
                  borderRadius: 99,
                  background: c.ok ? "#E1F5EE" : "#FAEEDA",
                  color: c.ok ? "#085041" : "#854F0B",
                }}
              >
                {c.label} {c.ok ? "cleared" : "pending"}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div style={CARD}>
            <p style={LABEL}>Overview</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <Field label="Status" value={member.status} />
              <Field label="Journey focus" value={member.journey_focus} />
              <Field label="Ceremony date" value={fmtDate(member.ceremony_date)} />
              <Field label="Arrival" value={fmtDate(member.arrival_date)} />
              <Field label="Departure" value={fmtDate(member.departure_date)} />
              <Field label="Phone" value={member.phone} />
              <Field label="Email" value={member.email} />
            </div>
          </div>

          <div style={CARD}>
            <p style={LABEL}>Vitals &amp; clearance</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <Field
                label="Blood pressure"
                value={
                  member.bp_systolic && member.bp_diastolic
                    ? `${member.bp_systolic}/${member.bp_diastolic}`
                    : null
                }
              />
              <Field label="Resting heart rate" value={member.heart_rate} />
              <Field label="Medication interactions" value={member.medication_interactions} />
              <Field label="Clinical notes (summary)" value={member.medical_notes} />
            </div>
          </div>

          {intake ? (
            <div style={CARD}>
              <p style={LABEL}>Intake — medical</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <Field label="Date of birth" value={fmtDate(intake.date_of_birth)} />
                  <Field label="Submitted" value={fmtDate(intake.submission_date)} />
                  <Field label="Emergency contact" value={intake.emergency_contact} />
                  <Field label="Emergency phone" value={intake.emergency_phone} />
                  <Field label="Physician" value={intake.physician_name} />
                  <Field label="Physician phone" value={intake.physician_phone} />
                </div>
                <Field label="Health history" value={intake.health_history} />
                <Field label="Heart conditions" value={intake.heart_conditions} />
                <Field label="Current medications" value={intake.current_medications} />
                <Field label="Supplements" value={intake.current_supplements ?? intake.supplements} />
                <Field label="Psychiatric history" value={intake.psychiatric_history} />
                <Field label="Mental health status" value={intake.mental_health_status} />
                <Field label="Substance history" value={intake.substance_history} />
                <Field
                  label="Previous psychedelic experience"
                  value={intake.previous_psychedelic_experience ?? intake.previous_psychedelic_exp}
                />
                <Field label="Iboga contraindications" value={intake.iboga_contraindications} />
                <Field label="Dietary restrictions" value={intake.dietary_restrictions} />
              </div>
            </div>
          ) : (
            <div style={CARD}>
              <p style={{ fontSize: 13, color: "#9E9E9A", margin: 0 }}>No intake form on file yet.</p>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <MedicalNotesLog memberId={memberId} authorName={nurseName} authorRole="nurse" />
          <LabDocumentsList labs={labs ?? []} />
        </div>
      </div>
    </div>
  );
}
