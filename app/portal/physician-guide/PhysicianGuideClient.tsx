"use client";

const ink = "#2C2416";
const inkLight = "#5C5040";
const border = "#DDD5C5";
const sage = "#6B8C6E";
const sageBg = "#EDF2EC";
const gold = "#8B6914";
const goldBg = "#F5F0E4";
const red = "#9B2335";
const redBg = "#F9ECEE";
const warmWhite = "#FDFAF6";
const cream = "#F7F3ED";

function PrintIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

export default function PhysicianGuideClient() {
  function handlePrint() {
    window.print();
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }

          body, html { margin: 0; padding: 0; background: white !important; }
          @page { margin: 15mm 14mm; size: A4; }

          .print-root {
            background: white !important;
            color: black !important;
            font-size: 11pt !important;
          }

          .print-hero {
            background: #1a1a0e !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            padding: 20px 28px !important;
            margin-bottom: 16px !important;
          }

          .print-intro-box {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            break-inside: avoid;
            page-break-inside: avoid;
            margin-bottom: 12px !important;
          }

          /* Switch to single column for print */
          .print-grid {
            display: block !important;
          }

          .print-grid > div {
            width: 100% !important;
          }

          /* Every card must not split across pages */
          .print-card {
            break-inside: avoid;
            page-break-inside: avoid;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            margin-bottom: 10px !important;
            padding: 14px 16px !important;
            border: 1px solid #ccc !important;
            border-radius: 6px !important;
          }

          .print-card-item {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .print-after-note {
            break-inside: avoid;
            page-break-inside: avoid;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            margin-top: 10px !important;
          }

          .print-footer {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-top: 16px !important;
          }
        }
      `}</style>

      <div className="print-root" style={{ minHeight: "100vh", background: cream, fontFamily: "'Jost', sans-serif", color: ink }}>

        {/* Header */}
        <div className="print-hero" style={{ background: ink, color: cream, padding: "56px 40px 48px", textAlign: "center" }}>
          <p style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(247,243,237,0.4)", marginBottom: 16 }}>
            Vital Kaua&#699;i Church, Confidential Medical Reference
          </p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 46, fontWeight: 300, letterSpacing: "0.03em", lineHeight: 1.1, marginBottom: 10 }}>
            Physician Reference<br /><em style={{ color: "rgba(247,243,237,0.55)" }}>Guide</em>
          </h1>
          <p style={{ fontSize: 13, color: "rgba(247,243,237,0.45)", letterSpacing: "0.06em", marginTop: 8, maxWidth: 560, margin: "12px auto 0" }}>
            This document is provided to support your patient&rsquo;s physician in reviewing required lab work and contraindications prior to participation in a plant medicine ceremony.
          </p>
        </div>

        {/* Print button */}
        <div className="no-print" style={{ background: goldBg, borderBottom: `1px solid ${border}`, padding: "14px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <p style={{ fontSize: 13, color: inkLight, margin: 0 }}>
            Share this page with your physician or download as PDF to bring to your appointment.
          </p>
          <button
            onClick={handlePrint}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: ink, color: cream,
              border: "none", borderRadius: 6,
              fontFamily: "'Jost', sans-serif", fontSize: 11,
              fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase",
              padding: "10px 22px", cursor: "pointer",
            }}
          >
            <PrintIcon />
            Download / Print as PDF
          </button>
        </div>

        <div style={{ maxWidth: 860, margin: "0 auto", padding: "56px 32px 100px" }}>

          {/* Intro note */}
          <div className="print-intro-box" style={{ background: sageBg, borderLeft: `3px solid ${sage}`, borderRadius: 8, padding: "20px 26px", marginBottom: 48 }}>
            <p style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: sage, marginBottom: 8 }}>To the Physician</p>
            <p style={{ fontSize: 14.5, lineHeight: 1.75, color: ink, margin: 0 }}>
              Your patient is preparing to participate in a whole-plant iboga ceremony held in a sacramental religious context. Iboga contains ibogaine and a spectrum of related alkaloids. It has significant cardiac and pharmacological considerations. The information below outlines the required screening, suggested additional labs, and contraindications. Please review carefully and advise your patient accordingly.
            </p>
            <p style={{ fontSize: 13, color: inkLight, marginTop: 12, marginBottom: 0 }}>
              Questions? Contact us directly at <strong>aloha@vitalkauai.com</strong> or call our medical advisor Jon Allen, PA-C (Yale School of Medicine).
            </p>
          </div>

          {/* Two-column layout (single column in print) */}
          <div className="print-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>

            {/* LEFT, Required Labs */}
            <div>
              {/* Required */}
              <div className="print-card" style={{ background: warmWhite, border: `1px solid ${border}`, borderRadius: 10, padding: "28px 28px 24px", marginBottom: 24 }}>
                <p style={{ fontSize: 9.5, letterSpacing: "0.26em", textTransform: "uppercase", color: sage, fontWeight: 600, marginBottom: 18 }}>
                  Required Before Ceremony
                </p>
                {[
                  { label: "EKG", note: "Cardiac function and QT interval assessment. QTc must be within normal range." },
                  { label: "Electrolyte Panel", note: "Potassium and magnesium levels, both cardiac-critical. Correct any deficiencies before ceremony." },
                  { label: "Full Medical Review", note: "Comprehensive physician review of health history, medications, and contraindications." },
                ].map((item, idx, arr) => (
                  <div className="print-card-item" key={item.label} style={{ display: "flex", gap: 14, paddingBottom: 16, marginBottom: idx < arr.length - 1 ? 16 : 0, borderBottom: idx < arr.length - 1 ? `1px solid ${border}` : "none" }}>
                    <div style={{ width: 18, height: 18, border: `1.5px solid ${sage}`, borderRadius: 4, flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: ink, marginBottom: 3 }}>{item.label}</p>
                      <p style={{ fontSize: 12.5, color: inkLight, lineHeight: 1.6, margin: 0 }}>{item.note}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Suggested */}
              <div className="print-card" style={{ background: warmWhite, border: `1px solid ${border}`, borderRadius: 10, padding: "28px 28px 24px", marginBottom: 24 }}>
                <p style={{ fontSize: 9.5, letterSpacing: "0.26em", textTransform: "uppercase", color: gold, fontWeight: 600, marginBottom: 18 }}>
                  Suggested, At Physician Discretion
                </p>
                {[
                  "Cardiac stress test",
                  "Complete metabolic panel (CMP)",
                  "Liver function panel",
                  "Thyroid function panel",
                  "Serum magnesium level",
                  "CYP450 genotype, metabolic enzyme profile",
                  "Any additional tests you recommend",
                ].map((label) => (
                  <div className="print-card-item" key={label} style={{ display: "flex", gap: 14, marginBottom: 12 }}>
                    <div style={{ width: 18, height: 18, border: `1.5px solid ${border}`, borderRadius: 4, flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: 13.5, color: inkLight, margin: 0 }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Sleep support */}
              <div className="print-card" style={{ background: goldBg, border: `1px solid #DDD0A8`, borderRadius: 10, padding: "20px 24px" }}>
                <p style={{ fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", color: gold, fontWeight: 600, marginBottom: 10 }}>
                  Sleep Support, Please Discuss
                </p>
                <p style={{ fontSize: 13, color: inkLight, lineHeight: 1.7, margin: 0 }}>
                  Iboga carries residual stimulation that can affect sleep in the weeks following ceremony. Please discuss gentle, non-addictive sleep support options your patient may bring with them if needed during integration.
                </p>
              </div>
            </div>

            {/* RIGHT, Contraindications */}
            <div>
              <div className="print-card" style={{ background: warmWhite, border: `1px solid ${border}`, borderRadius: 10, padding: "28px 28px 24px" }}>
                <p style={{ fontSize: 9.5, letterSpacing: "0.26em", textTransform: "uppercase", color: red, fontWeight: 600, marginBottom: 6 }}>
                  Contraindications
                </p>
                <p style={{ fontSize: 12.5, color: inkLight, marginBottom: 20, lineHeight: 1.6 }}>
                  Please review all of the following with your patient and advise on any that apply.
                </p>

                <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: red, fontWeight: 700, marginBottom: 10 }}>
                  Absolute, Ceremony not possible
                </p>
                {[
                  "History of heart disease or long QT syndrome",
                  "Pregnancy",
                  "Active psychosis, schizophrenia, or bipolar disorder",
                  "Borderline personality disorder",
                ].map((item) => (
                  <div className="print-card-item" key={item} style={{ display: "flex", gap: 12, background: redBg, borderRadius: 6, padding: "10px 14px", marginBottom: 8 }}>
                    <span style={{ color: red, fontWeight: 700, flexShrink: 0, fontSize: 14 }}>✕</span>
                    <p style={{ fontSize: 13, color: ink, margin: 0, lineHeight: 1.55 }}>{item}</p>
                  </div>
                ))}

                <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: gold, fontWeight: 700, margin: "20px 0 10px" }}>
                  Relative, Clearance / Taper Required
                </p>
                {[
                  { item: "Cannabis", note: "Clear fully 1–4 weeks before ceremony" },
                  { item: "Grapefruit and turmeric", note: "Clear 1–2 weeks before ceremony" },
                  { item: "Antifungals", note: "Ketoconazole, itraconazole, discuss timeline" },
                  { item: "Antibiotics", note: "Erythromycin, clarithromycin, discuss timeline" },
                  { item: "SSRIs and antidepressants", note: "Clearance varies: most clear in 5–14 days; fluoxetine requires 4–8 weeks. Please advise based on specific prescription." },
                  { item: "HIV protease inhibitors", note: "Ritonavir, discuss timeline" },
                  { item: "Calcium channel blockers", note: "Diltiazem, verapamil, discuss timeline" },
                  { item: "Amiodarone", note: "Discuss timeline with patient" },
                  { item: "Psychiatric medications", note: "Taper under physician supervision only. Some require up to one year to clear fully." },
                ].map(({ item, note }) => (
                  <div className="print-card-item" key={item} style={{ display: "flex", gap: 12, borderBottom: `1px solid ${border}`, padding: "10px 4px", marginBottom: 2 }}>
                    <span style={{ color: gold, flexShrink: 0, fontSize: 13, marginTop: 1 }}>—</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: ink, margin: "0 0 2px" }}>{item}</p>
                      <p style={{ fontSize: 12, color: inkLight, margin: 0, lineHeight: 1.55 }}>{note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* After ceremony note */}
          <div className="print-after-note" style={{ background: warmWhite, border: `1px solid ${border}`, borderRadius: 10, padding: "24px 28px", marginTop: 32 }}>
            <p style={{ fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", color: sage, fontWeight: 600, marginBottom: 10 }}>
              After Ceremony, Important for Patient&rsquo;s Physician
            </p>
            <p style={{ fontSize: 14, color: ink, lineHeight: 1.75, margin: 0 }}>
              Iboga resets substance tolerance significantly. A full month of sobriety after ceremony supports the medicine&rsquo;s work and gives the nervous system the space it needs to integrate. Three months is what we most often recommend. Noribogaine (the primary metabolite) remains active in the body for weeks to months and continues its work during this window.
            </p>
          </div>

          {/* Supplementation */}
          <div className="print-after-note" style={{ background: sageBg, border: `1px solid #B8D0B9`, borderRadius: 10, padding: "24px 28px", marginTop: 24 }}>
            <p style={{ fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", color: sage, fontWeight: 600, marginBottom: 10 }}>
              Recommended Supplementation to Begin 4 Weeks Prior
            </p>
            <p style={{ fontSize: 13.5, color: ink, lineHeight: 1.75, margin: 0 }}>
              <strong>DHA + EPA</strong> and <strong>magnesium glycinate</strong> daily, supports new synaptic connection formation, neuronal signaling, and nervous system regulation. Recommend continuing through and after ceremony.
            </p>
          </div>

          {/* Footer */}
          <div className="print-footer" style={{ textAlign: "center", marginTop: 56, paddingTop: 40, borderTop: `1px solid ${border}` }}>
            <p style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: inkLight, marginBottom: 8 }}>Questions or Concerns</p>
            <p style={{ fontSize: 14, color: inkLight, lineHeight: 1.7 }}>
              Please reach out to our team at <strong style={{ color: ink }}>aloha@vitalkauai.com</strong><br />
              Medical Advisor: Jon Allen, PA-C, Yale School of Medicine
            </p>
            <p style={{ fontSize: 11, color: "#AAA", marginTop: 20 }}>
              Vital Kaua&#699;i Church, Kaua&#699;i&rsquo;s North Shore, Hawai&#699;i
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
