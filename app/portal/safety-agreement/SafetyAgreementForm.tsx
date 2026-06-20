"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { markSafetyAgreementSigned } from "@/lib/api/member";
import {
  SAFETY_AGREEMENT_TITLE,
  SAFETY_AGREEMENT_SUBTITLE,
  SAFETY_AGREEMENT_PREAMBLE,
  SAFETY_AGREEMENT_SECTIONS,
  SAFETY_AGREEMENT_INITIAL_IDS,
  SAFETY_AGREEMENT_SIGNATURE_HEADING,
  SAFETY_AGREEMENT_SIGNATURE_INTRO,
} from "@/lib/safety-agreement";

const COLORS = {
  ink: "#1A1A18",
  body: "#3A3A36",
  muted: "#7A7A74",
  paper: "#FBF7EE",
  border: "#E2DCC8",
  accent: "#085041",
  accentTint: "#E1F5EE",
  warn: "#9b1c1c",
};

type Props = {
  userId: string;
  fullName: string;
  alreadySigned: boolean;
  signedAt: string | null;
  savedInitials: Record<string, string> | null;
  savedSignature: string | null;
  savedPreferences: Record<string, boolean> | null;
};

export function SafetyAgreementForm({
  userId,
  fullName,
  alreadySigned,
  signedAt,
  savedInitials,
  savedSignature,
  savedPreferences,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [initials, setInitials] = useState<Record<string, string>>(
    savedInitials ?? {},
  );
  const [preferences, setPreferences] = useState<Record<string, boolean>>(
    savedPreferences ?? {},
  );
  const [signature, setSignature] = useState<string>(
    savedSignature ?? fullName ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missingInitials = SAFETY_AGREEMENT_INITIAL_IDS.filter(
    (id) => !(initials[id] && initials[id].trim().length > 0),
  );
  const missingSignature = !signature.trim();
  const canSubmit =
    !alreadySigned && missingInitials.length === 0 && !missingSignature;

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    const trimmedInitials: Record<string, string> = {};
    for (const id of SAFETY_AGREEMENT_INITIAL_IDS) {
      trimmedInitials[id] = (initials[id] ?? "").trim();
    }
    const { error: err } = await markSafetyAgreementSigned(
      supabase,
      userId,
      trimmedInitials,
      signature.trim(),
      preferences,
    );
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
    router.push("/portal");
  }

  const cardStyle: React.CSSProperties = {
    background: COLORS.paper,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 14,
    padding: "32px 28px",
  };

  const sectionStyle: React.CSSProperties = {
    borderTop: `1px solid ${COLORS.border}`,
    paddingTop: 22,
    marginTop: 22,
  };

  return (
    <div style={cardStyle}>
      <p
        style={{
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: COLORS.muted,
          margin: 0,
        }}
      >
        {SAFETY_AGREEMENT_SUBTITLE}
      </p>
      <h1
        style={{
          fontSize: 28,
          lineHeight: 1.2,
          margin: "8px 0 16px",
          color: COLORS.ink,
          fontFamily: "var(--font-cormorant-garamond, serif)",
          fontWeight: 500,
        }}
      >
        {SAFETY_AGREEMENT_TITLE}
      </h1>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.65,
          color: COLORS.body,
          margin: 0,
        }}
      >
        {SAFETY_AGREEMENT_PREAMBLE}
      </p>

      {alreadySigned && (
        <div
          style={{
            marginTop: 20,
            padding: "12px 16px",
            background: COLORS.accentTint,
            borderRadius: 8,
            fontSize: 13,
            color: COLORS.accent,
          }}
        >
          ✓ Signed
          {signedAt
            ? ` on ${new Date(signedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}`
            : ""}
          . Your initials and signature are on file.
        </div>
      )}

      {SAFETY_AGREEMENT_SECTIONS.map((section) => {
        const initialsValue = initials[section.id] ?? "";
        return (
          <section key={section.id} style={sectionStyle}>
            <h2
              style={{
                fontSize: 18,
                margin: "0 0 10px",
                color: COLORS.ink,
                fontFamily: "var(--font-cormorant-garamond, serif)",
                fontWeight: 500,
              }}
            >
              {section.number}. {section.heading}
            </h2>
            {section.body?.map((para, i) => (
              <p
                key={i}
                style={{
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: COLORS.body,
                  margin: "0 0 10px",
                }}
              >
                {para}
              </p>
            ))}
            {section.items && (
              <ul
                style={{
                  margin: "10px 0 14px",
                  paddingLeft: 22,
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: COLORS.body,
                }}
              >
                {section.items.map((item, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    {item}
                  </li>
                ))}
              </ul>
            )}
            {section.preference && (
              <div
                style={{
                  marginTop: 12,
                  paddingLeft: 16,
                  borderLeft: `2px solid ${COLORS.border}`,
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    color: COLORS.muted,
                    margin: "0 0 8px",
                    fontStyle: "italic",
                  }}
                >
                  {section.preference.intro}
                </p>
                {section.preference.questions.map((q) => {
                  const value = preferences[q.id];
                  return (
                    <div key={q.id} style={{ marginBottom: 12 }}>
                      <p
                        style={{
                          fontSize: 14,
                          margin: "0 0 6px",
                          color: COLORS.body,
                          lineHeight: 1.5,
                        }}
                      >
                        {q.text}
                      </p>
                      <div style={{ display: "flex", gap: 14 }}>
                        {[true, false].map((v) => (
                          <label
                            key={String(v)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 13,
                              color: COLORS.body,
                              cursor: alreadySigned ? "default" : "pointer",
                            }}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              checked={value === v}
                              disabled={alreadySigned}
                              onChange={() =>
                                setPreferences((prev) => ({
                                  ...prev,
                                  [q.id]: v,
                                }))
                              }
                            />
                            {v ? "Yes" : "No"}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {section.preference.closing && (
                  <p
                    style={{
                      fontSize: 13,
                      color: COLORS.body,
                      lineHeight: 1.6,
                      marginTop: 4,
                    }}
                  >
                    {section.preference.closing}
                  </p>
                )}
              </div>
            )}
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <label
                htmlFor={`initials-${section.id}`}
                style={{
                  fontSize: 12,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: COLORS.muted,
                }}
              >
                Initials
              </label>
              <input
                id={`initials-${section.id}`}
                type="text"
                value={initialsValue}
                disabled={alreadySigned}
                maxLength={6}
                onChange={(e) =>
                  setInitials((prev) => ({
                    ...prev,
                    [section.id]: e.target.value.toUpperCase(),
                  }))
                }
                style={{
                  width: 100,
                  padding: "6px 10px",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 6,
                  fontSize: 14,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-cormorant-garamond, serif)",
                  background: alreadySigned ? "#F1EFE8" : "#fff",
                  color: COLORS.ink,
                }}
                placeholder="e.g. JD"
              />
            </div>
          </section>
        );
      })}

      <section style={sectionStyle}>
        <h2
          style={{
            fontSize: 18,
            margin: "0 0 10px",
            color: COLORS.ink,
            fontFamily: "var(--font-cormorant-garamond, serif)",
            fontWeight: 500,
          }}
        >
          {SAFETY_AGREEMENT_SIGNATURE_HEADING}
        </h2>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            color: COLORS.body,
            margin: "0 0 14px",
          }}
        >
          {SAFETY_AGREEMENT_SIGNATURE_INTRO}
        </p>
        <label
          htmlFor="safety-signature"
          style={{
            display: "block",
            fontSize: 12,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: COLORS.muted,
            marginBottom: 6,
          }}
        >
          Type your full legal name as your signature
        </label>
        <input
          id="safety-signature"
          type="text"
          value={signature}
          disabled={alreadySigned}
          onChange={(e) => setSignature(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px",
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            fontSize: 18,
            fontFamily: "var(--font-cormorant-garamond, serif)",
            fontStyle: "italic",
            background: alreadySigned ? "#F1EFE8" : "#fff",
            color: COLORS.ink,
          }}
          placeholder="Your full name"
        />

        {!alreadySigned && missingInitials.length > 0 && (
          <p style={{ fontSize: 12, color: COLORS.muted, marginTop: 12 }}>
            {missingInitials.length === 1
              ? "1 section still needs initials."
              : `${missingInitials.length} sections still need initials.`}
          </p>
        )}

        {error && (
          <p style={{ fontSize: 13, color: COLORS.warn, marginTop: 12 }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center" }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            style={{
              background: canSubmit && !saving ? COLORS.accent : "#9E9E9A",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 500,
              cursor: canSubmit && !saving ? "pointer" : "not-allowed",
            }}
          >
            {alreadySigned
              ? "✓ Signed"
              : saving
                ? "Signing…"
                : "Sign agreement"}
          </button>
          <Link
            href="/portal"
            style={{
              fontSize: 13,
              color: COLORS.muted,
              textDecoration: "none",
            }}
          >
            Cancel
          </Link>
        </div>
      </section>
    </div>
  );
}
