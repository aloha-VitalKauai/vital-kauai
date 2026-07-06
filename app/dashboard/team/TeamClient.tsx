"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { upsertPractitioner, type PractitionerInput } from "./actions";
import { PRACTITIONER_ROLES, ENGAGEMENT_TYPES, type Practitioner } from "@/lib/practitioners";

const inputStyle: React.CSSProperties = {
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

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#6B6B67",
  marginBottom: 6,
  display: "block",
};

const emptyDraft: PractitionerInput = {
  full_name: "",
  email: "",
  phone: "",
  role: "Contractor",
  engagement_type: "contractor",
  active: true,
  notes: "",
};

export default function TeamClient({
  practitioners,
  docCounts,
}: {
  practitioners: Practitioner[];
  docCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<PractitionerInput>(emptyDraft);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await upsertPractitioner(draft);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAdding(false);
      setDraft(emptyDraft);
      router.refresh();
    });
  }

  return (
    <div>
      {!adding && (
        <div style={{ marginBottom: 14 }}>
          <button
            onClick={() => setAdding(true)}
            style={{
              background: "#085041",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "var(--font-body, sans-serif)",
            }}
          >
            + Add team member
          </button>
        </div>
      )}

      {adding && (
        <div
          style={{
            background: "#fff",
            border: "0.5px solid rgba(0,0,0,0.12)",
            borderRadius: 10,
            padding: "1.1rem 1.25rem",
            marginBottom: 18,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 14px", color: "#1A1A18" }}>
            Add team member
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Name *</label>
              <input
                style={inputStyle}
                value={draft.full_name}
                onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
              />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                style={inputStyle}
                value={draft.email ?? ""}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                placeholder="name@example.com"
              />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input
                style={inputStyle}
                value={draft.phone ?? ""}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                placeholder="(808) 555-0123"
              />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <select
                style={inputStyle}
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              >
                {PRACTITIONER_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Engagement</label>
              <select
                style={inputStyle}
                value={draft.engagement_type}
                onChange={(e) => setDraft({ ...draft, engagement_type: e.target.value })}
              >
                {ENGAGEMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <input
                style={inputStyle}
                value={draft.notes ?? ""}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Internal note"
              />
            </div>
          </div>
          {error && <p style={{ fontSize: 12, color: "#A32D2D", margin: "0 0 10px" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={save}
              disabled={pending}
              style={{
                background: pending ? "#9E9E9A" : "#085041",
                color: "#fff",
                border: 0,
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 12,
                cursor: pending ? "not-allowed" : "pointer",
                fontFamily: "var(--font-body, sans-serif)",
              }}
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setError(null);
                setDraft(emptyDraft);
              }}
              style={{
                background: "transparent",
                color: "#6B6B67",
                border: "0.5px solid rgba(0,0,0,0.15)",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "var(--font-body, sans-serif)",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, overflow: "hidden" }}>
        {practitioners.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9E9E9A", padding: "1.5rem", margin: 0 }}>
            Add your first team member to start their document file.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Name", "Role", "Engagement", "Contact", "Documents", "Status"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "#9E9E9A",
                        fontWeight: 500,
                        padding: "10px 14px",
                        borderBottom: "0.5px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {practitioners.map((p) => (
                  <tr key={p.id}>
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(0,0,0,0.05)", fontSize: 13 }}>
                      <Link
                        href={`/dashboard/team/${p.id}`}
                        style={{ color: "#085041", textDecoration: "none", fontWeight: 500 }}
                      >
                        {p.full_name}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(0,0,0,0.05)", fontSize: 13, color: "#6B6B67" }}>
                      {p.role}
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(0,0,0,0.05)", fontSize: 13, color: "#6B6B67", textTransform: "capitalize" }}>
                      {p.engagement_type}
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(0,0,0,0.05)", fontSize: 13, color: "#6B6B67" }}>
                      {p.email || p.phone || "—"}
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(0,0,0,0.05)", fontSize: 13, color: "#6B6B67" }}>
                      {docCounts[p.id] ?? 0} on file
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(0,0,0,0.05)", fontSize: 12 }}>
                      <span
                        style={{
                          background: p.active ? "#E1F5EE" : "#F1EFE8",
                          color: p.active ? "#085041" : "#6B6B67",
                          padding: "3px 10px",
                          borderRadius: 99,
                          fontWeight: 500,
                        }}
                      >
                        {p.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
