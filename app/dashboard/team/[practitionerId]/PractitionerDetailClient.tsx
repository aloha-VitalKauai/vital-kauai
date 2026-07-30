"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  upsertPractitioner,
  deletePractitioner,
  recordPractitionerDocument,
  deletePractitionerDocument,
} from "../actions";
import {
  PRACTITIONER_ROLES,
  ENGAGEMENT_TYPES,
  DOC_TYPES,
  REQUIRED_DOC_TYPES,
  NURSE_ROLES,
  docTypeLabel,
  paperworkStatus,
  type Practitioner,
  type PractitionerDocument,
} from "@/lib/practitioners";

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
  marginBottom: 6,
  display: "block",
};

const INPUT: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  padding: "8px 10px",
  border: "0.5px solid rgba(0,0,0,0.15)",
  borderRadius: 6,
  fontSize: 14,
  fontFamily: "var(--font-body, sans-serif)",
  color: "#1A1A18",
  background: "#fff",
  outline: "none",
};

const BTN: React.CSSProperties = {
  background: "#085041",
  color: "#fff",
  border: 0,
  borderRadius: 8,
  padding: "8px 16px",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "var(--font-body, sans-serif)",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PractitionerDetailClient({
  practitioner,
  documents,
}: {
  practitioner: Practitioner;
  documents: PractitionerDocument[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [pending, startTransition] = useTransition();

  const [draft, setDraft] = useState({
    id: practitioner.id,
    full_name: practitioner.full_name,
    email: practitioner.email ?? "",
    phone: practitioner.phone ?? "",
    role: practitioner.role,
    engagement_type: practitioner.engagement_type,
    active: practitioner.active,
    notes: practitioner.notes ?? "",
  });
  const [detailsMsg, setDetailsMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [nurseSending, setNurseSending] = useState(false);
  const [nurseMsg, setNurseMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState({
    doc_type: "membership_agreement",
    title: "",
    version: "",
    signed_at: "",
    expires_at: "",
    notes: "",
  });
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function saveDetails() {
    setDetailsMsg(null);
    startTransition(async () => {
      const res = await upsertPractitioner(draft);
      setDetailsMsg(
        res.ok ? { kind: "ok", text: "Saved" } : { kind: "err", text: res.error }
      );
      if (res.ok) router.refresh();
    });
  }

  function removePractitioner() {
    if (
      !confirm(
        `Remove ${practitioner.full_name} and all their stored documents? This cannot be undone.`
      )
    )
      return;
    startTransition(async () => {
      const res = await deletePractitioner(practitioner.id);
      if (!res.ok) {
        setDetailsMsg({ kind: "err", text: res.error });
        return;
      }
      router.push("/dashboard/team");
    });
  }

  async function sendNurseAccess() {
    setNurseSending(true);
    setNurseMsg(null);
    try {
      const res = await fetch("/api/nurse-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ practitioner_id: practitioner.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNurseMsg({ kind: "err", text: data.error || "Something went wrong" });
      } else if (data.warning) {
        setNurseMsg({ kind: "err", text: data.warning });
      } else {
        setNurseMsg({ kind: "ok", text: `Login link sent to ${practitioner.email}` });
        router.refresh();
      }
    } catch {
      setNurseMsg({ kind: "err", text: "Network error — try again" });
    } finally {
      setNurseSending(false);
    }
  }

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadMsg({ kind: "err", text: "Choose a file first" });
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setUploadMsg({ kind: "err", text: "File is over 25 MB" });
      return;
    }
    setUploading(true);
    setUploadMsg(null);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${practitioner.id}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from("practitioner-documents")
      .upload(path, file);
    if (upErr) {
      setUploading(false);
      setUploadMsg({ kind: "err", text: upErr.message });
      return;
    }

    const res = await recordPractitionerDocument({
      practitioner_id: practitioner.id,
      doc_type: upload.doc_type,
      title: upload.title,
      file_name: file.name,
      file_path: path,
      file_size_bytes: file.size,
      version: upload.version,
      signed_at: upload.signed_at || null,
      expires_at: upload.expires_at || null,
      notes: upload.notes,
    });
    setUploading(false);
    if (!res.ok) {
      // Roll back the orphaned storage object so a retry starts clean.
      await supabase.storage.from("practitioner-documents").remove([path]);
      setUploadMsg({ kind: "err", text: res.error });
      return;
    }
    setUpload({ doc_type: upload.doc_type, title: "", version: "", signed_at: "", expires_at: "", notes: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploadMsg({ kind: "ok", text: "Document saved" });
    router.refresh();
  }

  async function viewFile(filePath: string) {
    const { data } = await supabase.storage
      .from("practitioner-documents")
      .createSignedUrl(filePath, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  function removeDocument(doc: PractitionerDocument) {
    if (!confirm(`Delete "${doc.title || doc.file_name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deletePractitionerDocument(doc.id);
      if (!res.ok) {
        setUploadMsg({ kind: "err", text: res.error });
        return;
      }
      router.refresh();
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const paperwork = paperworkStatus(documents, today);
  const docsOnFileByType = new Map(
    documents
      .filter((d) => !d.expires_at || d.expires_at >= today)
      .map((d) => [d.doc_type, d] as const)
  );

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link
          href="/dashboard/team"
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
          &larr; Back to team
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
            {practitioner.full_name}
          </h1>
          <span
            style={{
              background: practitioner.active ? "#E1F5EE" : "#F1EFE8",
              color: practitioner.active ? "#085041" : "#6B6B67",
              padding: "4px 12px",
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {practitioner.role} · {practitioner.active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          gap: 16,
        }}
      >
        {/* Details card */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div style={CARD}>
            <p style={{ ...LABEL, marginBottom: 16 }}>Details</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={LABEL}>Name</label>
                <input
                  style={INPUT}
                  value={draft.full_name}
                  onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                />
              </div>
              <div>
                <label style={LABEL}>Email</label>
                <input
                  style={INPUT}
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
              </div>
              <div>
                <label style={LABEL}>Phone</label>
                <input
                  style={INPUT}
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                />
              </div>
              <div>
                <label style={LABEL}>Role</label>
                <select
                  style={INPUT}
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                >
                  {PRACTITIONER_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                  {!PRACTITIONER_ROLES.includes(draft.role as (typeof PRACTITIONER_ROLES)[number]) && (
                    <option value={draft.role}>{draft.role}</option>
                  )}
                </select>
              </div>
              <div>
                <label style={LABEL}>Engagement</label>
                <select
                  style={INPUT}
                  value={draft.engagement_type}
                  onChange={(e) => setDraft({ ...draft, engagement_type: e.target.value })}
                >
                  {ENGAGEMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={LABEL}>Notes</label>
                <textarea
                  style={{ ...INPUT, minHeight: 60, resize: "vertical" }}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  placeholder="Internal notes"
                />
              </div>
              <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1A1A18", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={draft.active}
                    onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                    style={{ accentColor: "#085041" }}
                  />
                  Active
                </label>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
              <button onClick={saveDetails} disabled={pending} style={{ ...BTN, background: pending ? "#9E9E9A" : "#085041" }}>
                {pending ? "Saving…" : "Save details"}
              </button>
              {detailsMsg && (
                <span style={{ fontSize: 12, color: detailsMsg.kind === "ok" ? "#085041" : "#A32D2D" }}>
                  {detailsMsg.text}
                </span>
              )}
              <button
                onClick={removePractitioner}
                disabled={pending}
                style={{
                  marginLeft: "auto",
                  background: "transparent",
                  color: "#A32D2D",
                  border: "0.5px solid rgba(163,45,45,0.35)",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "var(--font-body, sans-serif)",
                }}
              >
                Remove
              </button>
            </div>
          </div>

          {/* Nurse portal access — shown for clinically-eligible roles */}
          {NURSE_ROLES.includes(practitioner.role) && (
            <div style={CARD}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ ...LABEL, marginBottom: 0 }}>Doctor portal access</p>
                <span
                  style={{
                    background: practitioner.auth_user_id ? "#E1F5EE" : "#F1EFE8",
                    color: practitioner.auth_user_id ? "#085041" : "#6B6B67",
                    padding: "3px 10px",
                    borderRadius: 99,
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {practitioner.auth_user_id ? "Login enabled" : "No login yet"}
                </span>
              </div>
              <p style={{ fontSize: 13, color: "#6B6B67", margin: "0 0 12px", lineHeight: 1.5 }}>
                A doctor login opens the care-team portal at /nurse: the medical profile,
                intake form, labs, and notes log for members assigned to them — and
                nothing else. Assign members from their profile&rsquo;s &ldquo;Assigned doctor&rdquo; field.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <button
                  onClick={sendNurseAccess}
                  disabled={nurseSending || !practitioner.email}
                  style={{
                    ...BTN,
                    background: nurseSending || !practitioner.email ? "#9E9E9A" : "#085041",
                    cursor: nurseSending || !practitioner.email ? "not-allowed" : "pointer",
                  }}
                >
                  {nurseSending
                    ? "Sending…"
                    : practitioner.auth_user_id
                      ? "Resend login link"
                      : "Enable login & send setup link"}
                </button>
                {!practitioner.email && (
                  <span style={{ fontSize: 12, color: "#854F0B" }}>Add an email above first.</span>
                )}
                {nurseMsg && (
                  <span style={{ fontSize: 12, color: nurseMsg.kind === "ok" ? "#085041" : "#A32D2D" }}>
                    {nurseMsg.text}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Upload card */}
          <div style={CARD}>
            <p style={{ ...LABEL, marginBottom: 16 }}>Add a signed document</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
              <div>
                <label style={LABEL}>Document type</label>
                <select
                  style={INPUT}
                  value={upload.doc_type}
                  onChange={(e) => setUpload({ ...upload, doc_type: e.target.value })}
                >
                  {DOC_TYPES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={LABEL}>Title (optional)</label>
                <input
                  style={INPUT}
                  value={upload.title}
                  onChange={(e) => setUpload({ ...upload, title: e.target.value })}
                  placeholder="Defaults to file name"
                />
              </div>
              <div>
                <label style={LABEL}>Date signed</label>
                <input
                  style={INPUT}
                  type="date"
                  max={today}
                  value={upload.signed_at}
                  onChange={(e) => setUpload({ ...upload, signed_at: e.target.value })}
                />
              </div>
              <div>
                <label style={LABEL}>Expires (if any)</label>
                <input
                  style={INPUT}
                  type="date"
                  value={upload.expires_at}
                  onChange={(e) => setUpload({ ...upload, expires_at: e.target.value })}
                />
              </div>
              <div>
                <label style={LABEL}>Version (optional)</label>
                <input
                  style={INPUT}
                  value={upload.version}
                  onChange={(e) => setUpload({ ...upload, version: e.target.value })}
                  placeholder="e.g. 2026-v1"
                />
              </div>
              <div>
                <label style={LABEL}>Note (optional)</label>
                <input
                  style={INPUT}
                  value={upload.notes}
                  onChange={(e) => setUpload({ ...upload, notes: e.target.value })}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={LABEL}>File (PDF or image, up to 25 MB)</label>
                <input ref={fileInputRef} type="file" accept=".pdf,image/*" style={{ fontSize: 13 }} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
              <button
                onClick={handleUpload}
                disabled={uploading}
                style={{ ...BTN, background: uploading ? "#9E9E9A" : "#085041" }}
              >
                {uploading ? "Uploading…" : "Upload document"}
              </button>
              {uploadMsg && (
                <span style={{ fontSize: 12, color: uploadMsg.kind === "ok" ? "#085041" : "#A32D2D" }}>
                  {uploadMsg.text}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Documents on file */}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Required paperwork checklist */}
          <div style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ ...LABEL, marginBottom: 0 }}>Required paperwork</p>
              <span
                style={{
                  background: paperwork.complete ? "#E1F5EE" : "#FAEEDA",
                  color: paperwork.complete ? "#085041" : "#854F0B",
                  padding: "3px 10px",
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {paperwork.complete ? "Complete" : `${paperwork.missing.length} missing`}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {REQUIRED_DOC_TYPES.map((t) => {
                const doc = docsOnFileByType.get(t);
                return (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        flexShrink: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        background: doc ? "#085041" : "#F1EFE8",
                        color: doc ? "#fff" : "#9E9E9A",
                      }}
                    >
                      {doc ? "✓" : "•"}
                    </span>
                    <span style={{ color: doc ? "#1A1A18" : "#6B6B67" }}>{docTypeLabel(t)}</span>
                    <span style={{ color: "#9E9E9A", fontSize: 12, marginLeft: "auto" }}>
                      {doc ? (doc.signed_at ? `Signed ${fmtDate(doc.signed_at)}` : "On file") : "Missing"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={CARD}>
            <p style={{ ...LABEL, marginBottom: 16 }}>
              Documents on file ({documents.length})
            </p>
            {documents.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9E9E9A", margin: 0 }}>
                Nothing on file yet. Upload the signed paperwork on the left.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {documents.map((doc) => {
                  const expired = doc.expires_at && doc.expires_at < today;
                  const expiringSoon =
                    doc.expires_at &&
                    !expired &&
                    new Date(doc.expires_at).getTime() - Date.now() < 30 * 24 * 3600 * 1000;
                  return (
                    <div
                      key={doc.id}
                      style={{
                        border: "0.5px solid rgba(0,0,0,0.08)",
                        borderRadius: 8,
                        padding: "10px 12px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "#1A1A18", margin: 0 }}>
                          {doc.title || doc.file_name}
                        </p>
                        <p style={{ fontSize: 12, color: "#6B6B67", margin: "3px 0 0" }}>
                          {docTypeLabel(doc.doc_type)}
                          {doc.version ? ` · ${doc.version}` : ""}
                          {doc.signed_at ? ` · signed ${fmtDate(doc.signed_at)}` : ""}
                          {doc.file_size_bytes ? ` · ${fmtSize(doc.file_size_bytes)}` : ""}
                        </p>
                        {doc.expires_at && (
                          <p
                            style={{
                              fontSize: 12,
                              margin: "3px 0 0",
                              color: expired ? "#A32D2D" : expiringSoon ? "#854F0B" : "#6B6B67",
                              fontWeight: expired || expiringSoon ? 500 : 400,
                            }}
                          >
                            {expired ? "Expired " : "Expires "}
                            {fmtDate(doc.expires_at)}
                          </p>
                        )}
                        {doc.notes && (
                          <p style={{ fontSize: 12, color: "#9E9E9A", margin: "3px 0 0" }}>{doc.notes}</p>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => viewFile(doc.file_path)}
                          style={{
                            background: "transparent",
                            color: "#085041",
                            border: "0.5px solid rgba(8,80,65,0.35)",
                            borderRadius: 8,
                            padding: "6px 12px",
                            fontSize: 12,
                            cursor: "pointer",
                            fontFamily: "var(--font-body, sans-serif)",
                          }}
                        >
                          View
                        </button>
                        <button
                          onClick={() => removeDocument(doc)}
                          style={{
                            background: "transparent",
                            color: "#A32D2D",
                            border: "0.5px solid rgba(163,45,45,0.3)",
                            borderRadius: 8,
                            padding: "6px 12px",
                            fontSize: 12,
                            cursor: "pointer",
                            fontFamily: "var(--font-body, sans-serif)",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
