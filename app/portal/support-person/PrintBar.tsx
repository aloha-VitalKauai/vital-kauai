"use client";

// Print / "Save as PDF" bar for the Support Person Guide. Mirrors the
// ceremony-guidelines PrintBar: a cream bar with a gold-outline button that
// calls window.print(). The <style> block is global so its @media print
// rules can reach the portal nav/dock (rendered by the layout) and the
// class-tagged structural elements on the page itself.
//
// Print goals: no portal chrome, no big blank gaps (trim hero/section/divider
// spacing + drop the jump-nav), all text dark enough to read on white paper,
// and the dark closing section flipped to white-on-dark-text.
export function PrintBar() {
  return (
    <>
      <style>{`
        .sp-print-bar {
          background: #F3EDE2;
          padding: 0.75rem 2rem;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 1rem;
          border-bottom: 1px solid rgba(184,151,74,0.25);
        }
        .sp-print-bar span {
          font-family: 'Jost', sans-serif;
          font-size: 0.7rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #5C5043;
        }
        .sp-btn-print {
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
        .sp-btn-print:hover { background: #B8956A; color: #FAF6F0; }

        @media print {
          @page { margin: 14mm; }

          /* Hide portal chrome + on-page jump nav + the print bar itself. */
          nav.pn, nav.vk-dock, footer[role="contentinfo"],
          .sp-print-bar, .sp-jump { display: none !important; }

          /* White paper; force every glyph to dark ink so nothing prints faint. */
          html, body { background: #fff !important; }
          .sp-page { background: #fff !important; }
          .sp-page, .sp-page * { color: #1C1814 !important; }

          /* Flatten backgrounds (incl. the dark closing section) to white. */
          .sp-page section { background: #fff !important; }

          /* Trim the on-screen spacing so there are no large blank gaps. */
          .sp-page section { padding-top: 18px !important; padding-bottom: 22px !important; }
          .sp-hero { padding: 10px 40px 18px !important; }
          .sp-divider { margin-bottom: 18px !important; }
          .sp-closing { padding: 30px 40px 22px !important; }

          /* Decorative giant section numerals: legible but not heavy black. */
          .sp-num { color: #9A8A5A !important; }

          /* Don't strand a heading at the bottom of a page. */
          .sp-page h2, .sp-page h4 { break-after: avoid; }
        }
      `}</style>
      <div className="sp-print-bar">
        <span>Save as PDF</span>
        <button className="sp-btn-print" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
    </>
  );
}
