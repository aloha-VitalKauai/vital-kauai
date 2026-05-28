"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Result =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string; memberId: string; setupLink: string; emailSent: boolean };

export default function ManualAddMemberButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [result, setResult] = useState<Result>({ kind: "idle" });
  const [copied, setCopied] = useState(false);

  function reset() {
    setFullName("");
    setEmail("");
    setPhone("");
    setSendEmail(true);
    setResult({ kind: "idle" });
    setCopied(false);
  }

  function close() {
    setOpen(false);
    if (result.kind === "success") {
      router.refresh();
    }
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
  }, [open, result.kind]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (result.kind === "submitting") return;
    setResult({ kind: "submitting" });
    try {
      const res = await fetch("/api/add-member-manually", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone: phone || null,
          send_email: sendEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setResult({ kind: "error", message: data.error || "Something went wrong." });
        return;
      }
      setResult({
        kind: "success",
        message: data.message,
        memberId: data.member_id,
        setupLink: data.setup_link,
        emailSent: !!data.email_sent,
      });
    } catch (err: any) {
      setResult({ kind: "error", message: err?.message || "Network error." });
    }
  }

  async function copyLink() {
    if (result.kind !== "success") return;
    try {
      await navigator.clipboard.writeText(result.setupLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable; user can select manually */
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
        + Add member
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
            <div
              style={{
                padding: "1.25rem 1.5rem 0.75rem",
                borderBottom: "0.5px solid rgba(0,0,0,0.08)",
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: "#9E9E9A",
                  marginBottom: 4,
                }}
              >
                Members
              </p>
              <h2
                style={{
                  fontFamily: "var(--font-display, serif)",
                  fontSize: 20,
                  fontWeight: 400,
                  color: "#1A1A18",
                  letterSpacing: "-0.01em",
                  margin: 0,
                }}
              >
                Add member manually
              </h2>
              <p style={{ fontSize: 12, color: "#6B6B67", marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
                Bypass the discovery-call flow. Creates an account, assigns the member role,
                and optionally emails them a 30-day setup link.
              </p>
            </div>

            {result.kind === "success" ? (
              <SuccessPanel
                result={result}
                onCopy={copyLink}
                copied={copied}
                onClose={close}
              />
            ) : (
              <form onSubmit={submit} style={{ padding: "1rem 1.5rem 1.25rem" }}>
                <Field
                  label="Full name"
                  value={fullName}
                  onChange={setFullName}
                  placeholder="Jane Doe"
                  autoFocus
                  required
                />
                <Field
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="jane@example.com"
                  required
                />
                <Field
                  label="Phone (optional)"
                  value={phone}
                  onChange={setPhone}
                  placeholder="+1 808 555 0123"
                />

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    marginTop: 14,
                    fontSize: 12,
                    color: "#1A1A18",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    Email the setup link now.
                    <span style={{ display: "block", color: "#6B6B67", marginTop: 2, lineHeight: 1.4 }}>
                      Uncheck to skip the email and copy the link manually instead.
                    </span>
                  </span>
                </label>

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

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                    marginTop: 18,
                  }}
                >
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
                    {result.kind === "submitting" ? "Adding…" : "Add member"}
                  </button>
                </div>
              </form>
            )}
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
      <span
        style={{
          display: "block",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#6B6B67",
          fontWeight: 500,
          marginBottom: 4,
        }}
      >
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

function SuccessPanel({
  result,
  onCopy,
  copied,
  onClose,
}: {
  result: Extract<Result, { kind: "success" }>;
  onCopy: () => void;
  copied: boolean;
  onClose: () => void;
}) {
  return (
    <div style={{ padding: "1.25rem 1.5rem 1.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          background: "#E1F5EE",
          border: "0.5px solid rgba(8,80,65,0.18)",
          borderRadius: 6,
          color: "#085041",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <span style={{ fontSize: 14 }}>✓</span>
        <span>{result.message}</span>
      </div>

      <div style={{ marginTop: 14 }}>
        <span
          style={{
            display: "block",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#6B6B67",
            fontWeight: 500,
            marginBottom: 4,
          }}
        >
          Setup link {result.emailSent ? "(also emailed)" : "(not emailed — copy and send manually)"}
        </span>
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "stretch",
          }}
        >
          <input
            readOnly
            value={result.setupLink}
            onFocus={(e) => e.currentTarget.select()}
            style={{
              flex: 1,
              padding: "8px 10px",
              fontSize: 11,
              color: "#1A1A18",
              background: "#FAFAF8",
              border: "0.5px solid rgba(0,0,0,0.15)",
              borderRadius: 6,
              fontFamily: "var(--font-mono, ui-monospace, monospace)",
              boxSizing: "border-box",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          />
          <button
            type="button"
            onClick={onCopy}
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: copied ? "#085041" : "#1A1A18",
              background: copied ? "#E1F5EE" : "#fff",
              border: "0.5px solid rgba(0,0,0,0.18)",
              borderRadius: 6,
              padding: "0 12px",
              cursor: "pointer",
              fontFamily: "var(--font-body, sans-serif)",
              whiteSpace: "nowrap",
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p style={{ fontSize: 11, color: "#9E9E9A", marginTop: 6, lineHeight: 1.45 }}>
          Link expires in 30 days. Member sets their password on /setup-account.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <a
          href={`/dashboard/${result.memberId}`}
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "#1A1A18",
            background: "#fff",
            border: "0.5px solid rgba(0,0,0,0.18)",
            borderRadius: 6,
            padding: "7px 14px",
            textDecoration: "none",
            fontFamily: "var(--font-body, sans-serif)",
          }}
        >
          Open profile
        </a>
        <button
          type="button"
          onClick={onClose}
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "#fff",
            background: "#1D6B4A",
            border: "0.5px solid #1D6B4A",
            borderRadius: 6,
            padding: "7px 14px",
            cursor: "pointer",
            fontFamily: "var(--font-body, sans-serif)",
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
