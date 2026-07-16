"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Result =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

export default function AddLeadButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<Result>({ kind: "idle" });

  function reset() {
    setFullName("");
    setEmail("");
    setPhone("");
    setSource("");
    setMessage("");
    setNotes("");
    setResult({ kind: "idle" });
  }

  function close() {
    setOpen(false);
    setTimeout(reset, 150);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (result.kind === "submitting") return;
    setResult({ kind: "submitting" });
    try {
      const res = await fetch("/api/add-lead-manually", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone: phone || null,
          source: source || null,
          message: message || null,
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setResult({ kind: "error", message: data.error || "Something went wrong." });
        return;
      }
      setOpen(false);
      setTimeout(reset, 150);
      router.refresh();
    } catch (err: any) {
      setResult({ kind: "error", message: err?.message || "Network error." });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "#fff",
          background: "#1D6B4A",
          border: "0.5px solid #1D6B4A",
          borderRadius: 6,
          padding: "5px 11px",
          cursor: "pointer",
          fontFamily: "var(--font-body, sans-serif)",
          letterSpacing: "0.02em",
        }}
      >
        + Add lead
      </button>

      {open && (
        <div
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(26,26,24,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 12,
              width: "100%",
              maxWidth: 440,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
              fontFamily: "var(--font-body, sans-serif)",
            }}
          >
            <div style={{ padding: "1.25rem 1.5rem 0.75rem", borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9E9E9A", marginBottom: 4 }}>
                Leads
              </p>
              <h2 style={{ fontFamily: "var(--font-display, serif)", fontSize: 20, fontWeight: 400, color: "#1A1A18", letterSpacing: "-0.01em", margin: 0 }}>
                Add lead manually
              </h2>
              <p style={{ fontSize: 12, color: "#6B6B67", marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
                Drop a prospect straight into the pipeline — a referral, a DM, a conversation.
              </p>
            </div>

            <form onSubmit={submit} style={{ padding: "1rem 1.5rem 1.25rem" }}>
              <Field label="Full name" value={fullName} onChange={setFullName} placeholder="Jane Doe" autoFocus required />
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="jane@example.com" required />
              <Field label="Phone (optional)" value={phone} onChange={setPhone} placeholder="+1 808 555 0123" />
              <Field label="Source (optional)" value={source} onChange={setSource} placeholder="Manual" />
              <TextArea label="Message (optional)" value={message} onChange={setMessage} placeholder="What they said / asked" />
              <TextArea label="Notes (optional)" value={notes} onChange={setNotes} placeholder="Internal notes" />

              {result.kind === "error" && (
                <div
                  style={{
                    marginTop: 14,
                    padding: "10px 12px",
                    background: "#FCEBEB",
                    border: "0.5px solid rgba(163,45,45,0.2)",
                    borderRadius: 6,
                    color: "#A32D2D",
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  {result.message}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
                <button
                  type="button"
                  onClick={close}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#6B6B67",
                    background: "transparent",
                    border: "0.5px solid rgba(0,0,0,0.15)",
                    borderRadius: 6,
                    padding: "7px 14px",
                    cursor: "pointer",
                    fontFamily: "var(--font-body, sans-serif)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={result.kind === "submitting"}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#fff",
                    background: result.kind === "submitting" ? "#7BA591" : "#1D6B4A",
                    border: "0.5px solid #1D6B4A",
                    borderRadius: 6,
                    padding: "7px 14px",
                    cursor: result.kind === "submitting" ? "default" : "pointer",
                    fontFamily: "var(--font-body, sans-serif)",
                  }}
                >
                  {result.kind === "submitting" ? "Adding…" : "Add lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoFocus,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
  required?: boolean;
}) {
  return (
    <label style={{ display: "block", marginTop: 12 }}>
      <span style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", fontWeight: 500, marginBottom: 4 }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        required={required}
        style={{
          width: "100%",
          padding: "8px 10px",
          fontSize: 13,
          color: "#1A1A18",
          background: "#fff",
          border: "0.5px solid rgba(0,0,0,0.18)",
          borderRadius: 6,
          fontFamily: "var(--font-body, sans-serif)",
          boxSizing: "border-box",
        }}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "block", marginTop: 12 }}>
      <span style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", fontWeight: 500, marginBottom: 4 }}>
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        style={{
          width: "100%",
          padding: "8px 10px",
          fontSize: 13,
          color: "#1A1A18",
          background: "#fff",
          border: "0.5px solid rgba(0,0,0,0.18)",
          borderRadius: 6,
          fontFamily: "var(--font-body, sans-serif)",
          boxSizing: "border-box",
          resize: "vertical",
        }}
      />
    </label>
  );
}
