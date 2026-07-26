"use client";

// Print / download kit for the PNE (PsychoNeuroEnergetics) week guides.
//
// Two pieces, dropped into each week page:
//   <PneGuidePrintButton /> — a top-right gold-outline Download/Print button
//     (matches the itinerary / ceremony-guide print buttons) plus the global
//     @media print rules for the whole guide.
//   <PneGuideFooter />       — the Vital Kauaʻi wordmark + copyright footer,
//     shown on screen and in the printed PDF.
//
// Print goals: hide the portal nav/dock and the button itself; flatten the
// dark hero and tinted sections to white; force every glyph to dark ink so
// nothing prints faint; trim the large on-screen section padding so the PDF
// has no big blank gaps; and keep the logo footer on the page.

const PRINT_STYLES = `
  /* Anchor the floating button to the guide, top-right. */
  .pne-companion-page { position: relative; }

  .pne-print-btn {
    position: absolute; top: 18px; right: 22px; z-index: 30;
    display: inline-flex; align-items: center; gap: 6px;
    font-family: 'Jost', 'Helvetica Neue', sans-serif;
    font-size: 10px; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase;
    color: #C9A86A; background: rgba(201,168,106,0.12);
    border: 1px solid rgba(201,168,106,0.55); border-radius: 4px;
    padding: 8px 14px; cursor: pointer;
    transition: background .15s ease, border-color .15s ease;
  }
  .pne-print-btn:hover { background: rgba(201,168,106,0.24); border-color: rgba(201,168,106,0.9); }
  .pne-print-btn svg { stroke: #C9A86A; }
  @media (max-width: 720px) {
    .pne-print-btn { top: 12px; right: 12px; padding: 6px 10px; font-size: 9px; letter-spacing: 0.14em; }
  }

  /* Footer — visible on screen and in print. */
  .pne-guide-footer {
    background: #F1ECDD; text-align: center;
    padding: 46px 24px 42px; border-top: 1px solid rgba(31,38,32,0.10);
  }
  .pne-foot-logo {
    font-family: 'Cormorant Garamond', 'Hoefler Text', Georgia, serif;
    font-size: 26px; color: #1F3A2E; letter-spacing: 0.02em; margin-bottom: 12px;
  }
  .pne-foot-logo em { font-style: italic; color: #6E8E6A; }
  .pne-foot-copy {
    font-family: 'Jost', 'Helvetica Neue', sans-serif;
    font-size: 11.5px; line-height: 1.85; color: #5C5A4F; letter-spacing: 0.04em;
    max-width: 620px; margin: 0 auto;
  }

  @media print {
    @page { margin: 14mm; }

    /* Hide portal chrome + the button itself. */
    nav.pn, nav.vk-dock, header[role="banner"], .pne-print-btn { display: none !important; }

    /* White paper, dark ink on everything so nothing prints faint. */
    html, body { background: #fff !important; }
    .pne-companion-page { background: #fff !important; }
    .pne-companion-page, .pne-companion-page * { color: #1F2620 !important; }

    /* Flatten the dark hero and every tinted section/card to white. */
    .pne-companion-page header.hero,
    .pne-companion-page section,
    .pne-companion-page .closing-band,
    .pne-companion-page [class*="band"],
    .pne-companion-page [class*="card"],
    .pne-companion-page .pv-card,
    .pne-companion-page .practice-card,
    .pne-companion-page .pv-quote,
    .pne-companion-page .safety-question {
      background: #fff !important; background-image: none !important; box-shadow: none !important;
    }

    /* Trim the generous on-screen spacing so the PDF has no big gaps. */
    .pne-companion-page .vk-section { padding: 18px 0 !important; }
    .pne-companion-page header.hero { padding: 8px 0 20px !important; }
    .pne-companion-page .closing-band { padding: 22px 0 !important; }

    /* Keep cards, quotes, and callouts from splitting across pages. */
    .pne-companion-page .pv-card,
    .pne-companion-page .practice-card,
    .pne-companion-page .pv-quote,
    .pne-companion-page .safety-question { break-inside: avoid; }
    .pne-companion-page h1, .pne-companion-page h2, .pne-companion-page h3 { break-after: avoid; }

    /* Keep the logo footer, on white. */
    .pne-guide-footer { background: #fff !important; border-top: 1px solid #cfcabb; }
  }
`;

export function PneGuidePrintButton() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />
      <button
        type="button"
        className="pne-print-btn"
        onClick={() => window.print()}
        aria-label="Download or print this guide as a PDF"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>Download / Print</span>
      </button>
    </>
  );
}

export function PneGuideFooter() {
  return (
    <footer className="pne-guide-footer">
      <div className="pne-foot-logo">Vital <em>Kauaʻi</em></div>
      <p className="pne-foot-copy">
        &copy; 2026 Vital Kauaʻi Church &middot; PO Box 932, Hanalei, HI 96714 &middot; aloha@vitalkauai.com
        <br />
        All original content on this portal is protected by U.S. copyright law.
      </p>
    </footer>
  );
}
