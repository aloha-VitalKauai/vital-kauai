"use client";

import Link from "next/link";
import {
  SAFETY_AGREEMENT_TITLE,
  SAFETY_AGREEMENT_SUBTITLE,
  SAFETY_AGREEMENT_PREAMBLE,
  SAFETY_AGREEMENT_SECTIONS,
  SAFETY_AGREEMENT_SIGNATURE_HEADING,
  SAFETY_AGREEMENT_SIGNATURE_INTRO,
} from "@/lib/safety-agreement";

/**
 * Printable, in-person version of the Participant Safety and Informed
 * Consent Agreement. Founder-only via dashboard middleware.
 *
 * Use the browser's Print dialog (Cmd/Ctrl+P) — the print stylesheet
 * strips the back-link and prints the agreement on standard 8.5×11
 * paper with handwriting space for initials, the YES/NO preference
 * boxes, and the signature block.
 */

export default function SafetyAgreementPrintable() {
  return (
    <>
      <style>{`
        @media screen {
          .sa-screen-toolbar { display: flex; }
        }
        @media print {
          @page { size: letter; margin: 0.6in; }
          html, body { background: #fff !important; }
          .sa-screen-toolbar { display: none !important; }
          .sa-page { box-shadow: none !important; padding: 0 !important; }
          .sa-section { break-inside: avoid; }
        }
        body { background: #f5f1e7; }
        .sa-page {
          max-width: 740px;
          margin: 24px auto;
          padding: 48px 56px;
          background: #fff;
          color: #1a1a18;
          font-family: var(--font-body, Georgia, "Times New Roman", serif);
          line-height: 1.55;
          box-shadow: 0 6px 20px rgba(0,0,0,0.08);
        }
        .sa-eyebrow { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: #7a7a74; margin: 0 0 6px; }
        .sa-title { font-size: 26px; margin: 0 0 14px; font-family: var(--font-cormorant-garamond, "Cormorant Garamond", serif); font-weight: 500; }
        .sa-preamble { font-size: 14px; margin: 0 0 24px; }
        .sa-section { border-top: 1px solid #d8d2c0; padding-top: 18px; margin-top: 18px; }
        .sa-h2 { font-size: 16px; margin: 0 0 8px; font-family: var(--font-cormorant-garamond, "Cormorant Garamond", serif); font-weight: 500; }
        .sa-section p { font-size: 13.5px; margin: 0 0 8px; }
        .sa-section ul { margin: 8px 0 10px; padding-left: 22px; font-size: 13.5px; }
        .sa-section ul li { margin-bottom: 5px; }
        .sa-pref { margin-top: 10px; padding-left: 14px; border-left: 2px solid #d8d2c0; }
        .sa-pref-intro { font-size: 12.5px; font-style: italic; color: #555; margin: 0 0 6px; }
        .sa-pref-q { font-size: 13px; margin: 0 0 4px; }
        .sa-pref-yesno { font-size: 12px; color: #444; margin: 0 0 10px; }
        .sa-pref-yesno span { display: inline-block; border: 1px solid #1a1a18; width: 14px; height: 14px; margin: 0 4px 0 14px; vertical-align: middle; }
        .sa-initials { margin-top: 10px; font-size: 12px; color: #444; }
        .sa-initials .line { display: inline-block; border-bottom: 1px solid #1a1a18; width: 80px; margin-left: 10px; }
        .sa-sig-block { margin-top: 18px; font-size: 13px; }
        .sa-sig-row { display: flex; gap: 20px; margin-top: 18px; flex-wrap: wrap; }
        .sa-sig-field { flex: 1 1 280px; }
        .sa-sig-field .label { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: #555; margin-bottom: 4px; }
        .sa-sig-field .line { display: block; border-bottom: 1px solid #1a1a18; height: 26px; }
        .sa-screen-toolbar {
          max-width: 740px;
          margin: 16px auto 0;
          padding: 0 16px;
          align-items: center;
          gap: 16px;
        }
        .sa-screen-toolbar a { font-size: 12px; color: #4a3d2e; text-decoration: none; }
        .sa-print-btn {
          font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
          padding: 8px 16px; border-radius: 6px;
          background: #C96A52; color: #fff; border: none; cursor: pointer; font-weight: 600;
        }
      `}</style>
      <div className="sa-screen-toolbar">
        <Link href="/dashboard/sops">← Back to SOPs</Link>
        <button
          type="button"
          className="sa-print-btn"
          onClick={() => window.print()}
        >
          Print / Save PDF
        </button>
      </div>

      <article className="sa-page">
        <p className="sa-eyebrow">{SAFETY_AGREEMENT_SUBTITLE}</p>
        <h1 className="sa-title">{SAFETY_AGREEMENT_TITLE}</h1>
        <p className="sa-preamble">{SAFETY_AGREEMENT_PREAMBLE}</p>

        {SAFETY_AGREEMENT_SECTIONS.map((section) => (
          <section key={section.id} className="sa-section">
            <h2 className="sa-h2">
              {section.number}. {section.heading}
            </h2>
            {section.body?.map((para, i) => <p key={i}>{para}</p>)}
            {section.items && (
              <ul>
                {section.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
            {section.preference && (
              <div className="sa-pref">
                <p className="sa-pref-intro">{section.preference.intro}</p>
                {section.preference.questions.map((q) => (
                  <div key={q.id}>
                    <p className="sa-pref-q">{q.text}</p>
                    <p className="sa-pref-yesno">
                      YES <span /> NO <span />
                    </p>
                  </div>
                ))}
                {section.preference.closing && (
                  <p style={{ fontSize: 12.5, marginTop: 4 }}>
                    {section.preference.closing}
                  </p>
                )}
              </div>
            )}
            <p className="sa-initials">
              Participant&apos;s initials: <span className="line" />
            </p>
          </section>
        ))}

        <section className="sa-section">
          <h2 className="sa-h2">{SAFETY_AGREEMENT_SIGNATURE_HEADING}</h2>
          <p>{SAFETY_AGREEMENT_SIGNATURE_INTRO}</p>
          <div className="sa-sig-row">
            <div className="sa-sig-field">
              <div className="label">Participant&apos;s Full Name</div>
              <div className="line" />
            </div>
            <div className="sa-sig-field">
              <div className="label">Date</div>
              <div className="line" />
            </div>
          </div>
          <div className="sa-sig-row">
            <div className="sa-sig-field">
              <div className="label">Participant&apos;s Signature</div>
              <div className="line" />
            </div>
          </div>
          <div className="sa-sig-row">
            <div className="sa-sig-field">
              <div className="label">Facilitator&apos;s Name</div>
              <div className="line" />
            </div>
            <div className="sa-sig-field">
              <div className="label">Date</div>
              <div className="line" />
            </div>
          </div>
          <div className="sa-sig-row">
            <div className="sa-sig-field">
              <div className="label">Facilitator&apos;s Signature</div>
              <div className="line" />
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
