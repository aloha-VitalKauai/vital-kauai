"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/* Shared typed-signature block for member portal agreements (Church
   Membership Agreement, Medical Disclaimer). Mirrors the Participant Safety
   agreement pattern: an acknowledgment checkbox + a typed full-legal-name
   signature, timestamped on submit. The parent renders the document copy and
   supplies `onSign`, which persists to member_profiles and returns an error
   message (or null on success). */

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

export function SignatureBlock({
  fullName,
  alreadySigned,
  signedAt,
  savedSignature,
  acknowledgment,
  onSign,
}: {
  fullName: string;
  alreadySigned: boolean;
  signedAt: string | null;
  savedSignature: string | null;
  acknowledgment: string;
  onSign: (signature: string) => Promise<string | null>;
}) {
  const router = useRouter();
  const [signature, setSignature] = useState<string>(savedSignature ?? fullName ?? "");
  const [acknowledged, setAcknowledged] = useState<boolean>(alreadySigned);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !alreadySigned && acknowledged && signature.trim().length > 0;

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    const err = await onSign(signature.trim());
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    router.refresh();
    router.push("/portal");
  }

  return (
    <section
      style={{
        borderTop: `1px solid ${COLORS.border}`,
        paddingTop: 22,
        marginTop: 22,
      }}
    >
      {alreadySigned && (
        <div
          style={{
            marginBottom: 18,
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
          . Your signature is on file.
        </div>
      )}

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          fontSize: 14,
          lineHeight: 1.6,
          color: COLORS.body,
          cursor: alreadySigned ? "default" : "pointer",
          marginBottom: 18,
        }}
      >
        <input
          type="checkbox"
          checked={acknowledged}
          disabled={alreadySigned}
          onChange={(e) => setAcknowledged(e.target.checked)}
          style={{ marginTop: 3, accentColor: COLORS.accent, flexShrink: 0 }}
        />
        <span>{acknowledgment}</span>
      </label>

      <label
        htmlFor="agreement-signature"
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
        id="agreement-signature"
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

      {error && (
        <p style={{ fontSize: 13, color: COLORS.warn, marginTop: 12 }}>{error}</p>
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
          {alreadySigned ? "✓ Signed" : saving ? "Signing…" : "Sign agreement"}
        </button>
        <Link href="/portal" style={{ fontSize: 13, color: COLORS.muted, textDecoration: "none" }}>
          {alreadySigned ? "Back to dashboard" : "Cancel"}
        </Link>
      </div>
    </section>
  );
}
