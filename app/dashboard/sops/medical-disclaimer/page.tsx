"use client";

import Link from "next/link";
import { MEDICAL_DISCLAIMER } from "@/lib/medical-disclaimer";

export default function MedicalDisclaimerPrintable() {
  return (
    <>
      <style>{`
        @media print {
          @page { size: letter; margin: 0.6in; }
          html, body { background: #fff !important; }
          .md-screen-toolbar { display: none !important; }
          .md-page { box-shadow: none !important; padding: 0 !important; }
          .md-section { break-inside: avoid; }
        }
        body { background: #f5f1e7; }
        .md-page {
          max-width: 740px;
          margin: 24px auto;
          padding: 48px 56px;
          background: #fff;
          color: #1a1a18;
          font-family: var(--font-body, Georgia, "Times New Roman", serif);
          line-height: 1.6;
          box-shadow: 0 6px 20px rgba(0,0,0,0.08);
        }
        .md-eyebrow { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: #7a7a74; margin: 0 0 6px; }
        .md-title { font-size: 26px; margin: 0 0 18px; font-family: var(--font-cormorant-garamond, "Cormorant Garamond", serif); font-weight: 500; }
        .md-section p { font-size: 13.5px; margin: 0 0 12px; }
        .md-section h2 { font-size: 17px; margin: 22px 0 10px; font-family: var(--font-cormorant-garamond, "Cormorant Garamond", serif); font-weight: 500; }
        .md-section ul { margin: 0 0 14px; padding-left: 22px; font-size: 13.5px; }
        .md-section ul li { margin-bottom: 5px; }
        .md-highlight {
          border-left: 3px solid #085041;
          background: #F1EFE8;
          padding: 14px 18px;
          margin: 14px 0 18px;
          font-size: 13.5px;
        }
        .md-sig-row { display: flex; gap: 20px; margin-top: 28px; flex-wrap: wrap; border-top: 1px solid #d8d2c0; padding-top: 22px; }
        .md-sig-field { flex: 1 1 280px; }
        .md-sig-field .label { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: #555; margin-bottom: 4px; }
        .md-sig-field .line { display: block; border-bottom: 1px solid #1a1a18; height: 26px; }
        .md-screen-toolbar {
          display: flex;
          max-width: 740px;
          margin: 16px auto 0;
          padding: 0 16px;
          align-items: center;
          gap: 16px;
        }
        .md-screen-toolbar a { font-size: 12px; color: #4a3d2e; text-decoration: none; }
        .md-print-btn {
          font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
          padding: 8px 16px; border-radius: 6px;
          background: #085041; color: #fff; border: none; cursor: pointer; font-weight: 600;
        }
      `}</style>
      <div className="md-screen-toolbar">
        <Link href="/dashboard/sops">← Back to SOPs</Link>
        <button type="button" className="md-print-btn" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>

      <article className="md-page md-section">
        <p className="md-eyebrow">Vital Kauaʻi Church</p>
        <h1 className="md-title">Medical Disclaimer &amp; Risk Acknowledgment</h1>

        {MEDICAL_DISCLAIMER.map((block, i) => {
          if (block.kind === "p") {
            return (
              <p key={i} dangerouslySetInnerHTML={{ __html: block.html }} />
            );
          }
          if (block.kind === "h") {
            return (
              <h2 key={i} dangerouslySetInnerHTML={{ __html: block.html }} />
            );
          }
          if (block.kind === "ul") {
            return (
              <ul key={i}>
                {block.items.map((it, j) => (
                  <li key={j}>{it}</li>
                ))}
              </ul>
            );
          }
          if (block.kind === "highlight") {
            return (
              <div
                key={i}
                className="md-highlight"
                dangerouslySetInnerHTML={{ __html: block.html }}
              />
            );
          }
          return null;
        })}

        <div className="md-sig-row">
          <div className="md-sig-field">
            <div className="label">Member&apos;s Full Name</div>
            <div className="line" />
          </div>
          <div className="md-sig-field">
            <div className="label">Date</div>
            <div className="line" />
          </div>
        </div>
        <div className="md-sig-row" style={{ borderTop: "none", paddingTop: 0 }}>
          <div className="md-sig-field">
            <div className="label">Member&apos;s Signature</div>
            <div className="line" />
          </div>
        </div>
      </article>
    </>
  );
}
