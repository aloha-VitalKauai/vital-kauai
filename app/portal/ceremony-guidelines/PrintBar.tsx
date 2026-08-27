"use client";

// Print / download bar for the Ceremony Guidelines page. Matches the
// "Save for offline reading—Download / Print" bar on the static portal
// guides (e.g. ceremony-day-guide.html): right-aligned, cream-deep bar,
// gold-outline button that fills gold on hover. The button is a client
// affordance (window.print()); the guidelines page itself stays a server
// component. The <style> block also carries the @media print rules—a
// plain <style> tag applies document-wide, so it can hide the portal nav
// and mobile dock rendered by the portal layout.
export function PrintBar() {
  return (
    <>
      <style>{`
        .cg-print-bar {
          background: #F3EDE2;
          padding: 0.75rem 2rem;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 1rem;
          border-bottom: 1px solid rgba(184,149,106,0.25);
        }
        .cg-print-bar span {
          font-size: 0.7rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #5C5043;
        }
        .cg-btn-print {
          font-family: 'Jost', sans-serif;
          font-size: 0.68rem;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          background: transparent;
          color: #9A7A52;
          border: 1px solid #B8956A;
          padding: 0.45rem 1rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .cg-btn-print:hover { background: #B8956A; color: #FAF6F0; }

        @media print {
          /* Hide portal chrome: top nav, mobile dock, the print bar itself,
             and the site-wide legal disclaimer bar (dark, prints poorly). */
          nav.pn, nav.vk-dock, .cg-print-bar,
          footer[role="contentinfo"] { display: none !important; }

          /* Legible on white paper. */
          html, body { background: #fff !important; }
          .cg-page { background: #fff !important; color: #2C2416 !important; }

          /* Keep each guideline card intact across page breaks. */
          .cg-card {
            page-break-inside: avoid;
            break-inside: avoid;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      <div className="cg-print-bar">
        <span>Save for offline reading</span>
        <button className="cg-btn-print" onClick={() => window.print()}>Download / Print</button>
      </div>
    </>
  );
}
