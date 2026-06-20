"use client";

import Link from "next/link";
import { MEMBERSHIP_AGREEMENT } from "@/lib/membership-agreement";

export default function MembershipAgreementPrintable() {
  return (
    <>
      <style>{`
        @media print {
          @page { size: letter; margin: 0.6in; }
          html, body { background: #fff !important; }
          .ma-screen-toolbar { display: none !important; }
          .ma-page { box-shadow: none !important; padding: 0 !important; }
          .ma-section { break-inside: avoid; }
        }
        body { background: #f5f1e7; }
        .ma-page {
          max-width: 740px;
          margin: 24px auto;
          padding: 48px 56px;
          background: #fff;
          color: #1a1a18;
          font-family: var(--font-body, Georgia, "Times New Roman", serif);
          line-height: 1.6;
          box-shadow: 0 6px 20px rgba(0,0,0,0.08);
        }
        .ma-eyebrow { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: #7a7a74; margin: 0 0 6px; }
        .ma-title { font-size: 26px; margin: 0 0 6px; font-family: var(--font-cormorant-garamond, "Cormorant Garamond", serif); font-weight: 500; }
        .ma-subtitle { font-size: 13px; color: #5C5C58; margin: 0 0 18px; font-style: italic; }
        .ma-preamble { font-size: 14px; margin: 18px 0; }
        .ma-list { counter-reset: term; padding: 0; margin: 0 0 24px; list-style: none; }
        .ma-list li { counter-increment: term; font-size: 13.5px; padding-left: 28px; position: relative; margin-bottom: 10px; }
        .ma-list li::before { content: counter(term) "."; position: absolute; left: 0; top: 0; font-weight: 600; color: #085041; }
        .ma-sig-row { display: flex; gap: 20px; margin-top: 28px; flex-wrap: wrap; border-top: 1px solid #d8d2c0; padding-top: 22px; }
        .ma-sig-field { flex: 1 1 280px; }
        .ma-sig-field .label { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: #555; margin-bottom: 4px; }
        .ma-sig-field .line { display: block; border-bottom: 1px solid #1a1a18; height: 26px; }
        .ma-screen-toolbar {
          display: flex;
          max-width: 740px;
          margin: 16px auto 0;
          padding: 0 16px;
          align-items: center;
          gap: 16px;
        }
        .ma-screen-toolbar a { font-size: 12px; color: #4a3d2e; text-decoration: none; }
        .ma-print-btn {
          font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
          padding: 8px 16px; border-radius: 6px;
          background: #085041; color: #fff; border: none; cursor: pointer; font-weight: 600;
        }
      `}</style>
      <div className="ma-screen-toolbar">
        <Link href="/dashboard/sops">← Back to SOPs</Link>
        <button type="button" className="ma-print-btn" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>

      <article className="ma-page">
        <p className="ma-eyebrow">Vital Kauaʻi Church</p>
        <h1 className="ma-title">{MEMBERSHIP_AGREEMENT.heading}</h1>
        <p className="ma-subtitle">{MEMBERSHIP_AGREEMENT.subtitle}</p>
        <p className="ma-preamble">{MEMBERSHIP_AGREEMENT.preamble}</p>
        <ol className="ma-list">
          {MEMBERSHIP_AGREEMENT.terms.map((term, i) => (
            <li key={i}>{term}</li>
          ))}
        </ol>
        <div className="ma-sig-row ma-section">
          <div className="ma-sig-field">
            <div className="label">Member&apos;s Full Name</div>
            <div className="line" />
          </div>
          <div className="ma-sig-field">
            <div className="label">Date</div>
            <div className="line" />
          </div>
        </div>
        <div className="ma-sig-row" style={{ borderTop: "none", paddingTop: 0 }}>
          <div className="ma-sig-field">
            <div className="label">Member&apos;s Signature</div>
            <div className="line" />
          </div>
        </div>
      </article>
    </>
  );
}
