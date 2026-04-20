"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertSpecialist, deleteSpecialist, type SpecialistInput } from "../actions";

type Specialist = {
  id: string;
  name: string;
  email: string | null;
  photo_url: string | null;
  bio: string | null;
  calendly_url: string | null;
  active: boolean;
  sort_order: number;
};

const emptyDraft: SpecialistInput = {
  name: "",
  email: "",
  photo_url: "",
  bio: "",
  calendly_url: "",
  active: true,
  sort_order: 0,
};

export default function SpecialistsClient({ specialists }: { specialists: Specialist[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SpecialistInput>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function startEdit(s: Specialist) {
    setEditingId(s.id);
    setAdding(false);
    setError(null);
    setDraft({
      id: s.id,
      name: s.name,
      email: s.email ?? "",
      photo_url: s.photo_url ?? "",
      bio: s.bio ?? "",
      calendly_url: s.calendly_url ?? "",
      active: s.active,
      sort_order: s.sort_order,
    });
  }

  function startAdd() {
    setEditingId(null);
    setAdding(true);
    setError(null);
    setDraft(emptyDraft);
  }

  function cancel() {
    setEditingId(null);
    setAdding(false);
    setError(null);
    setDraft(emptyDraft);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await upsertSpecialist(draft);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      cancel();
      router.refresh();
    });
  }

  function remove(id: string, name: string) {
    if (!confirm(`Remove ${name} from the specialists list? Existing member assignments (by name) will remain but will no longer resolve a photo or Calendly link.`)) return;
    startTransition(async () => {
      const res = await deleteSpecialist(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const editing = adding || editingId !== null;

  return (
    <div>
      {!editing && (
        <div style={{ marginBottom: 14 }}>
          <button
            onClick={startAdd}
            style={{
              background: "#1A1A18", color: "#fff", border: 0, borderRadius: 8,
              padding: "8px 14px", fontSize: 12, cursor: "pointer",
            }}
          >
            + Add specialist
          </button>
        </div>
      )}

      {editing && (
        <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "1.1rem 1.25rem", marginBottom: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 14px", color: "#1A1A18" }}>
            {adding ? "Add specialist" : "Edit specialist"}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <Field label="Name *">
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Email">
              <input value={draft.email ?? ""} onChange={(e) => setDraft({ ...draft, email: e.target.value })} style={inputStyle} placeholder="judith@example.com" />
            </Field>
            <Field label="Photo URL">
              <input value={draft.photo_url ?? ""} onChange={(e) => setDraft({ ...draft, photo_url: e.target.value })} style={inputStyle} placeholder="/images/judithjohnson.jpeg" />
            </Field>
            <Field label="Calendly URL">
              <input value={draft.calendly_url ?? ""} onChange={(e) => setDraft({ ...draft, calendly_url: e.target.value })} style={inputStyle} placeholder="https://calendly.com/..." />
            </Field>
            <Field label="Sort order">
              <input type="number" value={draft.sort_order ?? 0} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })} style={inputStyle} />
            </Field>
            <Field label="Active">
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={!!draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
                Show in assignment dropdown
              </label>
            </Field>
          </div>
          <Field label="Bio">
            <textarea value={draft.bio ?? ""} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} rows={5} style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }} />
          </Field>
          {error && <p style={{ color: "#B42318", fontSize: 12, margin: "10px 0 0" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={save} disabled={pending} style={{ background: "#1A1A18", color: "#fff", border: 0, borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: pending ? "wait" : "pointer" }}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button onClick={cancel} disabled={pending} style={{ background: "#fff", color: "#1A1A18", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["", "Name", "Calendly", "Active", "Sort", ""].map((h, i) => (
                <th key={i} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {specialists.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#9E9E9A", fontSize: 13 }}>No specialists yet. Click "+ Add specialist" to create one.</td></tr>
            ) : specialists.map((s) => (
              <tr key={s.id} style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                <td style={tdStyle}>
                  {s.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.photo_url} alt={s.name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#F1EFE8", color: "#9E9E9A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>—</div>
                  )}
                </td>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 500 }}>{s.name}</div>
                  {s.email && <div style={{ fontSize: 11, color: "#9E9E9A" }}>{s.email}</div>}
                </td>
                <td style={tdStyle}>
                  {s.calendly_url ? (
                    <a href={s.calendly_url} target="_blank" rel="noreferrer" style={{ color: "#085041", fontSize: 12 }}>
                      {s.calendly_url.replace(/^https?:\/\//, "")}
                    </a>
                  ) : <span style={{ color: "#9E9E9A" }}>—</span>}
                </td>
                <td style={tdStyle}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: s.active ? "#E1F5EE" : "#F1EFE8", color: s.active ? "#085041" : "#6B6B67" }}>
                    {s.active ? "Active" : "Hidden"}
                  </span>
                </td>
                <td style={{ ...tdStyle, color: "#6B6B67" }}>{s.sort_order}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <button onClick={() => startEdit(s)} style={linkBtn}>Edit</button>
                  <button onClick={() => remove(s.id, s.name)} style={{ ...linkBtn, color: "#B42318", marginLeft: 10 }}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", marginBottom: 4, fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", fontSize: 13, border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: 6, background: "#fff", color: "#1A1A18",
};
const thStyle: React.CSSProperties = {
  padding: "9px 14px", textAlign: "left", fontSize: 10, fontWeight: 500, color: "#6B6B67", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "0.5px solid rgba(0,0,0,0.09)", background: "#FAFAF8",
};
const tdStyle: React.CSSProperties = {
  padding: "10px 14px", borderBottom: "0.5px solid rgba(0,0,0,0.06)", fontSize: 12, verticalAlign: "middle",
};
const linkBtn: React.CSSProperties = {
  background: "transparent", border: 0, color: "#1A1A18", fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline",
};
