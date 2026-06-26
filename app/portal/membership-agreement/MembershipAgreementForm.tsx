"use client";

import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { markAgreementSigned } from "@/lib/api/member";
import { MEMBERSHIP_AGREEMENT } from "@/lib/membership-agreement";
import { SignatureBlock } from "@/components/portal/SignatureBlock";

const COLORS = {
  ink: "#1A1A18",
  body: "#3A3A36",
  muted: "#7A7A74",
  paper: "#FBF7EE",
  border: "#E2DCC8",
};

export function MembershipAgreementForm({
  userId,
  fullName,
  alreadySigned,
  signedAt,
  savedSignature,
}: {
  userId: string;
  fullName: string;
  alreadySigned: boolean;
  signedAt: string | null;
  savedSignature: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);

  return (
    <div
      style={{
        background: COLORS.paper,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: "32px 28px",
      }}
    >
      <p
        style={{
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: COLORS.muted,
          margin: 0,
        }}
      >
        {MEMBERSHIP_AGREEMENT.subtitle}
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
        {MEMBERSHIP_AGREEMENT.heading}
      </h1>
      <p style={{ fontSize: 14, lineHeight: 1.65, color: COLORS.body, margin: "0 0 14px" }}>
        {MEMBERSHIP_AGREEMENT.preamble}
      </p>
      <ol
        style={{
          margin: 0,
          paddingLeft: 22,
          fontSize: 14,
          lineHeight: 1.7,
          color: COLORS.body,
        }}
      >
        {MEMBERSHIP_AGREEMENT.terms.map((term, i) => (
          <li key={i} style={{ marginBottom: 12 }}>
            {term}
          </li>
        ))}
      </ol>

      <SignatureBlock
        fullName={fullName}
        alreadySigned={alreadySigned}
        signedAt={signedAt}
        savedSignature={savedSignature}
        acknowledgment="I have carefully read this Membership Agreement, I understand and agree with it, and I enter into it freely, without duress or coercion."
        onSign={async (signature) => {
          const { error } = await markAgreementSigned(supabase, userId, signature);
          return error?.message ?? null;
        }}
      />
    </div>
  );
}
