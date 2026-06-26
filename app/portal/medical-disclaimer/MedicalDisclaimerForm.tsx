"use client";

import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { markMedicalSigned } from "@/lib/api/member";
import { MEDICAL_DISCLAIMER } from "@/lib/medical-disclaimer";
import { SignatureBlock } from "@/components/portal/SignatureBlock";

const COLORS = {
  ink: "#1A1A18",
  body: "#3A3A36",
  muted: "#7A7A74",
  paper: "#FBF7EE",
  border: "#E2DCC8",
  accentTint: "#E1F5EE",
};

export function MedicalDisclaimerForm({
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
        Vital Kauaʻi Church
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
        Medical Disclaimer &amp; Risk Acknowledgment
      </h1>

      {MEDICAL_DISCLAIMER.map((block, i) => {
        if (block.kind === "h") {
          return (
            <h2
              key={i}
              style={{
                fontSize: 18,
                margin: "22px 0 10px",
                color: COLORS.ink,
                fontFamily: "var(--font-cormorant-garamond, serif)",
                fontWeight: 500,
              }}
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          );
        }
        if (block.kind === "highlight") {
          return (
            <div
              key={i}
              style={{
                margin: "14px 0",
                padding: "14px 16px",
                background: COLORS.accentTint,
                borderRadius: 8,
                fontSize: 14,
                lineHeight: 1.65,
                color: COLORS.body,
              }}
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          );
        }
        if (block.kind === "ul") {
          return (
            <ul
              key={i}
              style={{
                margin: "10px 0 14px",
                paddingLeft: 22,
                fontSize: 14,
                lineHeight: 1.65,
                color: COLORS.body,
              }}
            >
              {block.items.map((item, j) => (
                <li key={j} style={{ marginBottom: 6 }}>
                  {item}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p
            key={i}
            style={{ fontSize: 14, lineHeight: 1.65, color: COLORS.body, margin: "0 0 10px" }}
            dangerouslySetInnerHTML={{ __html: block.html }}
          />
        );
      })}

      <SignatureBlock
        fullName={fullName}
        alreadySigned={alreadySigned}
        signedAt={signedAt}
        savedSignature={savedSignature}
        acknowledgment="I have read and understood this Medical Disclaimer & Risk Acknowledgment in full, I accept the risks described above, and I accept personal responsibility for my health disclosures and sovereign participation."
        onSign={async (signature) => {
          const { error } = await markMedicalSigned(supabase, userId, signature);
          return error?.message ?? null;
        }}
      />
    </div>
  );
}
