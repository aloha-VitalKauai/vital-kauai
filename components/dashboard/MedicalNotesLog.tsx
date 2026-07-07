"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Append-only medical notes log, shared between the founder dashboard
// (member profile → Medical tab) and the nurse portal. RLS decides who can
// read and write: founders on every member, nurses only on assigned members.

type NoteEntry = {
  id: string;
  author_name: string;
  author_role: string;
  note: string;
  created_at: string;
};

export default function MedicalNotesLog({
  memberId,
  authorName,
  authorRole,
}: {
  memberId: string;
  /** Display name on new notes. Defaults to the signed-in user's email. */
  authorName?: string;
  authorRole: "founder" | "nurse";
}) {
  const supabase = createClient();
  const [notes, setNotes] = useState<NoteEntry[] | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("medical_note_entries")
      .select("id, author_name, author_role, note, created_at")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false });
    setNotes((data ?? []) as NoteEntry[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addNote() {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: insErr } = await supabase.from("medical_note_entries").insert({
      member_id: memberId,
      author_user_id: user?.id ?? null,
      author_name: authorName || user?.email || "Team",
      author_role: authorRole,
      note: text,
    });
    setSaving(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setDraft("");
    load();
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "0.5px solid rgba(0,0,0,0.1)",
        borderRadius: 10,
        padding: "1.25rem",
        fontFamily: "var(--font-body, sans-serif)",
      }}
    >
      <p
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#6B6B67",
          margin: "0 0 12px",
        }}
      >
        Medical notes log
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note — observations, calls, follow-ups…"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 56,
            resize: "vertical",
            padding: "8px 10px",
            border: "0.5px solid rgba(0,0,0,0.15)",
            borderRadius: 6,
            fontSize: 13,
            fontFamily: "var(--font-body, sans-serif)",
            color: "#1A1A18",
            outline: "none",
          }}
        />
        <button
          onClick={addNote}
          disabled={saving || !draft.trim()}
          style={{
            background: saving || !draft.trim() ? "#9E9E9A" : "#085041",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 12,
            fontWeight: 500,
            cursor: saving || !draft.trim() ? "not-allowed" : "pointer",
            fontFamily: "var(--font-body, sans-serif)",
            flexShrink: 0,
          }}
        >
          {saving ? "Saving…" : "Add note"}
        </button>
      </div>
      {error && <p style={{ fontSize: 12, color: "#A32D2D", margin: "0 0 8px" }}>{error}</p>}
      <p style={{ fontSize: 11, color: "#9E9E9A", margin: "0 0 14px" }}>
        Notes are part of the member&rsquo;s medical record — they can&rsquo;t be edited or removed after saving.
      </p>

      {notes === null ? (
        <p style={{ fontSize: 13, color: "#9E9E9A", margin: 0 }}>Loading…</p>
      ) : notes.length === 0 ? (
        <p style={{ fontSize: 13, color: "#9E9E9A", margin: 0 }}>No notes yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {notes.map((n) => (
            <div
              key={n.id}
              style={{
                border: "0.5px solid rgba(0,0,0,0.08)",
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: "#1A1A18" }}>{n.author_name}</span>
                <span
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: n.author_role === "nurse" ? "#085041" : "#6B6B67",
                    background: n.author_role === "nurse" ? "#E1F5EE" : "#F1EFE8",
                    padding: "1px 7px",
                    borderRadius: 99,
                  }}
                >
                  {n.author_role}
                </span>
                <span style={{ fontSize: 11, color: "#9E9E9A", marginLeft: "auto" }}>
                  {new Date(n.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p style={{ fontSize: 13, color: "#1A1A18", margin: 0, whiteSpace: "pre-wrap" }}>{n.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
