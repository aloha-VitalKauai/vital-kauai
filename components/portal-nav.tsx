"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Portal navigation.
 *
 * The menu holds ~30 destinations. Desktop reveals them through hover
 * dropdowns; mobile used to flatten all of them onto one scrolling screen,
 * which put the twelve week links and ten guides — the deepest, least-used
 * items — in front of Dashboard and Contribution.
 *
 * So the contents live here once, and both surfaces render the same data:
 * mobile as accordions that open one section at a time, desktop as the
 * dropdowns it already had. The resting state on mobile is five rows.
 */

const WEEKS = [1, 2, 3, 4, 5, 6] as const;

const ARCS = [
  { label: "Pre-Ceremony", href: "/portal/integration/pre-ceremony" },
  { label: "Post-Ceremony", href: "/portal/integration/post-ceremony" },
] as const;

/**
 * Guides, in three clusters. The cluster label carries the word "Guide", so
 * the items don't have to: eight of the ten used to end in it, which buried
 * the word that actually distinguishes them.
 */
const GUIDE_GROUPS = [
  {
    label: "Before you arrive",
    items: [
      { label: "Intake & Readiness Form", href: "/intake-form-legacy.html" },
      { label: "Iboga Preparedness", href: "/iboga-preparedness-guide.html" },
      { label: "Questions for the Root", href: "/portal/questions" },
      { label: "Dietary", href: "/portal/dietary" },
      { label: "Packing", href: "/portal/what-to-bring" },
      { label: "Support Person", href: "/portal/support-person" },
    ],
  },
  {
    label: "Ceremony",
    items: [
      { label: "Ceremony Day", href: "/ceremony-day-guide.html" },
      { label: "Ceremony Guidelines", href: "/portal/ceremony-guidelines" },
    ],
  },
  {
    label: "Reference",
    items: [
      { label: "Physician Reference", href: "/portal/physician-guide" },
      { label: "Recommended Reading", href: "/portal/reading-list" },
    ],
  },
] as const;

const JOURNEY_PREFIX = "/portal/integration";
const RESOURCE_HREFS = [
  "/portal/journal",
  "/portal/vital-kauai-guides",
  ...GUIDE_GROUPS.flatMap((g) => g.items.map((i) => i.href)),
];

type Section = "journey" | "resources" | null;

export function PortalNav({ email }: { email?: string; currentPage?: string }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openSection, setOpenSection] = useState<Section>(null);
  const pathname = usePathname() ?? "";

  const inJourney = pathname.startsWith(JOURNEY_PREFIX);
  const inResources = RESOURCE_HREFS.some((h) => h.startsWith("/portal") && pathname === h);

  // Opening the menu shows the section the member is already in, so the menu
  // answers "where am I" before they touch anything. Set on the open itself
  // rather than in an effect, so there is no second render to see.
  const open = () => {
    setOpenSection(inJourney ? "journey" : inResources ? "resources" : null);
    setIsMobileOpen(true);
  };
  const close = () => setIsMobileOpen(false);
  const toggle = (s: Exclude<Section, null>) =>
    setOpenSection((current) => (current === s ? null : s));

  /** aria-current + a marker class for the page being viewed. */
  const current = (href: string) =>
    pathname === href ? ({ "aria-current": "page" as const, className: "is-current" }) : {};

  return (
    <>
      <style>{`
        .pn { position:sticky;top:0;z-index:100;background:rgba(14,26,16,.97);backdrop-filter:blur(16px);min-height:60px;display:flex;align-items:center;justify-content:space-between;padding:env(safe-area-inset-top) 48px 0;border-bottom:1px solid rgba(200,169,110,.08); }
        @media print { .pn, .pn-mobile { display:none !important; } }
        .pn-left { display:flex;align-items:center;gap:32px; }
        .pn-logo { font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:300;letter-spacing:.18em;text-transform:uppercase;color:#F5F0E8;text-decoration:none; }
        .pn-logo em { font-style:italic;color:#A8C5AC; }
        .pn-links { display:flex;align-items:center;gap:4px; }
        .pn-link { font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(245,240,232,.45);text-decoration:none;padding:6px 14px;border-radius:3px;transition:color .2s;border:none;background:none;font-family:inherit;cursor:pointer; }
        .pn-link:hover { color:#F5F0E8; }
        .pn-link.is-current { color:#F5F0E8; }
        .pn-dropdown { position:relative; }
        .pn-dropdown-trigger { font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#A8C5AC;padding:6px 14px;border-radius:3px;border:none;background:none;font-family:inherit;cursor:pointer;display:flex;align-items:center;gap:6px; }
        .pn-dropdown-trigger::after { content:'\\25BE';font-size:8px;color:#C8A96E; }
        .pn-dropdown-menu { display:none;position:absolute;top:100%;left:0;background:rgba(14,26,16,.98);backdrop-filter:blur(16px);border:.5px solid rgba(200,169,110,.15);border-radius:4px;min-width:210px;padding:10px 0;box-shadow:0 16px 40px rgba(0,0,0,.4); }
        .pn-dropdown::after { content:'';position:absolute;top:100%;left:0;right:0;height:12px; }
        .pn-dropdown:hover .pn-dropdown-menu { display:block; }
        .pn-dropdown-item { display:block;padding:9px 20px;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(245,240,232,.78);text-decoration:none;font-weight:500;transition:color .15s,background .15s; }
        .pn-dropdown-item:hover { color:#F5F0E8;background:rgba(122,158,126,.06); }
        /* Sub-items read in sentence case: the list is the majority of the menu,
           and wide-tracked capitals are the slowest thing in it to scan. */
        .pn-dropdown-subitem { display:block;padding:6px 20px 6px 32px;font-size:12px;letter-spacing:.01em;color:rgba(245,240,232,.5);text-decoration:none;transition:color .15s,background .15s; }
        .pn-dropdown-subitem:hover { color:#F5F0E8;background:rgba(122,158,126,.06); }
        .pn-dropdown-subitem.is-current { color:#C8A96E; }
        .pn-dropdown-group { display:block;padding:12px 20px 4px;font-size:8.5px;letter-spacing:.24em;text-transform:uppercase;color:rgba(200,169,110,.6); }
        .pn-dropdown-weeks { display:grid;grid-template-columns:repeat(3,1fr);gap:2px;padding:2px 14px 6px; }
        .pn-dropdown-week { display:block;text-align:center;padding:6px 4px;font-size:11px;color:rgba(245,240,232,.5);text-decoration:none;border-radius:3px;transition:color .15s,background .15s; }
        .pn-dropdown-week:hover { color:#F5F0E8;background:rgba(122,158,126,.06); }
        .pn-dropdown-divider { height:1px;background:rgba(245,240,232,.06);margin:8px 0; }
        .pn-right { display:flex;align-items:center;gap:14px; }
        .pn-email { font-size:9px;letter-spacing:.1em;color:rgba(245,240,232,.3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
        .pn-out { font-size:8px;letter-spacing:.2em;text-transform:uppercase;color:rgba(245,240,232,.35);background:none;border:1px solid rgba(245,240,232,.12);padding:6px 14px;cursor:pointer;font-family:inherit;transition:color .2s,border-color .2s; }
        .pn-out:hover { color:#F5F0E8;border-color:rgba(245,240,232,.3); }

        /* Hamburger—hidden on desktop, visible on narrow screens */
        .pn-burger { display:none;background:none;border:none;padding:6px 8px;cursor:pointer;font-family:inherit; }
        .pn-burger span { display:block;width:22px;height:1.5px;background:rgba(245,240,232,.7);margin:5px 0;transition:background .2s; }
        .pn-burger:hover span { background:#F5F0E8; }

        /* ── Mobile full-screen menu ──────────────────────────────────────
           Five rows at rest. The Journey and Resources expand in place, one
           at a time, so the deep lists never compete with Dashboard and
           Contribution for the first screen. */
        .pn-mobile { display:none;position:fixed;inset:0;z-index:200;background:rgba(10,18,11,.97);backdrop-filter:blur(12px);flex-direction:column;padding:max(76px, calc(env(safe-area-inset-top) + 56px)) 0 max(32px, env(safe-area-inset-bottom));overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain; }
        .pn-mobile.open { display:flex; }
        .pn-mobile-close { position:absolute;top:max(18px, env(safe-area-inset-top));right:22px;background:none;border:none;color:#F5F0E8;font-size:28px;cursor:pointer;font-family:inherit;line-height:1;padding:6px 10px;z-index:1; }
        .pn-m-row { display:flex;align-items:center;justify-content:space-between;width:100%;gap:12px;padding:17px 28px;min-height:56px;font-family:'Cormorant Garamond',serif;font-size:23px;font-weight:300;letter-spacing:.05em;color:#F5F0E8;text-decoration:none;background:none;border:none;border-bottom:1px solid rgba(245,240,232,.07);cursor:pointer;text-align:left;font-variant-numeric:tabular-nums; }
        .pn-m-row.is-current { color:#C8A96E; }
        .pn-m-row-caret { font-size:11px;color:rgba(200,169,110,.7);transition:transform .2s; }
        .pn-m-row[aria-expanded="true"] .pn-m-row-caret { transform:rotate(180deg); }
        .pn-m-panel { background:rgba(245,240,232,.02);border-bottom:1px solid rgba(245,240,232,.07);padding:6px 0 14px; }
        .pn-m-arc { display:block;padding:12px 28px 6px;font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:300;letter-spacing:.04em;color:rgba(245,240,232,.9);text-decoration:none; }
        .pn-m-arc.is-current { color:#C8A96E; }
        /* Three columns: six weeks land as two even rows, rather than wrapping
           to leave Week 6 orphaned on a line of its own. */
        .pn-m-weeks { display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:2px 22px 8px; }
        .pn-m-week { display:block;text-align:center;padding:11px 4px;font-size:13px;color:rgba(245,240,232,.55);text-decoration:none;border-radius:4px;background:rgba(245,240,232,.03); }
        .pn-m-group { display:block;padding:14px 28px 4px;font-size:9px;letter-spacing:.26em;text-transform:uppercase;color:rgba(200,169,110,.65); }
        .pn-m-item { display:block;padding:11px 28px;font-size:15px;letter-spacing:.01em;color:rgba(245,240,232,.72);text-decoration:none; }
        .pn-m-item.is-current { color:#C8A96E; }
        .pn-mobile-foot { margin-top:auto;padding:22px 28px 0;display:flex;flex-direction:column;align-items:flex-start;gap:8px; }
        .pn-mobile-email { font-size:11px;letter-spacing:.1em;color:rgba(245,240,232,.35);word-break:break-all; }
        .pn-mobile-out { font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:rgba(245,240,232,.4);background:none;border:none;padding:0;cursor:pointer;font-family:inherit; }

        @media (max-width:768px) {
          .pn { padding:env(safe-area-inset-top) 20px 0; }
          .pn-links { display:none; }
          .pn-email { display:none; }
          .pn-out { display:none; }
          .pn-burger { display:block; }
        }
      `}</style>
      <nav className="pn">
        <div className="pn-left">
          <a href="/" className="pn-logo">Vital <em>Kaua&#699;i</em></a>
          <div className="pn-links">
            <a href="/portal" className={`pn-link${pathname === "/portal" ? " is-current" : ""}`}>Dashboard</a>
            {/* Outcomes tab hidden while the timeline + portal experience are
                being refined. Restore by uncommenting this line. */}
            {/* <a href="/portal/assessments" className="pn-link">Outcomes</a> */}
            <div className="pn-dropdown">
              <button className="pn-dropdown-trigger">The Journey</button>
              <div className="pn-dropdown-menu">
                {ARCS.map((arc, i) => (
                  <div key={arc.href}>
                    {i > 0 && <div className="pn-dropdown-divider" />}
                    <a href={arc.href} className="pn-dropdown-item">{arc.label}</a>
                    <div className="pn-dropdown-weeks">
                      {WEEKS.map((n) => (
                        <a key={n} href={`${arc.href}#week-${n}`} className="pn-dropdown-week">{n}</a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pn-dropdown">
              <button className="pn-dropdown-trigger">Resources</button>
              <div className="pn-dropdown-menu">
                <a href="/portal/journal" className="pn-dropdown-item" {...current("/portal/journal")}>Comprehensive Journal</a>
                <a href="/portal/vital-kauai-guides" className="pn-dropdown-item" {...current("/portal/vital-kauai-guides")}>Vital Kauaʻi Guides</a>
                {GUIDE_GROUPS.map((group) => (
                  <div key={group.label}>
                    <span className="pn-dropdown-group">{group.label}</span>
                    {group.items.map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
                        className={`pn-dropdown-subitem${pathname === item.href ? " is-current" : ""}`}
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <a href="/portal/donate" className={`pn-link${pathname === "/portal/donate" ? " is-current" : ""}`}>Contribution</a>
            <a href="/portal/contact" className={`pn-link${pathname === "/portal/contact" ? " is-current" : ""}`}>Contact</a>
          {/* Community tab hidden while the section is being built out.
              Restore by uncommenting this line. */}
          {/* <a href="/portal/community" className="pn-link">Community</a> */}
          </div>
        </div>
        <div className="pn-right">
          {email && <span className="pn-email">{email}</span>}
          <form action="/auth/logout" method="post">
            <button type="submit" className="pn-out">Sign Out</button>
          </form>
          <button
            type="button"
            className="pn-burger"
            aria-label="Menu"
            aria-expanded={isMobileOpen}
            onClick={open}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      <div className={`pn-mobile ${isMobileOpen ? "open" : ""}`}>
        <button
          type="button"
          className="pn-mobile-close"
          aria-label="Close menu"
          onClick={close}
        >
          &#10005;
        </button>

        <a href="/portal" className={`pn-m-row${pathname === "/portal" ? " is-current" : ""}`} onClick={close}>
          Dashboard
        </a>
        {/* Outcomes link hidden—restore alongside the desktop link. */}

        <button
          type="button"
          className={`pn-m-row${inJourney ? " is-current" : ""}`}
          aria-expanded={openSection === "journey"}
          aria-controls="pn-journey"
          onClick={() => toggle("journey")}
        >
          The Journey
          <span className="pn-m-row-caret" aria-hidden="true">&#9662;</span>
        </button>
        {openSection === "journey" && (
          <div className="pn-m-panel" id="pn-journey">
            {ARCS.map((arc) => (
              <div key={arc.href}>
                <a
                  href={arc.href}
                  className={`pn-m-arc${pathname === arc.href ? " is-current" : ""}`}
                  onClick={close}
                >
                  {arc.label}
                </a>
                <div className="pn-m-weeks">
                  {WEEKS.map((n) => (
                    <a key={n} href={`${arc.href}#week-${n}`} className="pn-m-week" onClick={close}>
                      Week {n}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className={`pn-m-row${inResources ? " is-current" : ""}`}
          aria-expanded={openSection === "resources"}
          aria-controls="pn-resources"
          onClick={() => toggle("resources")}
        >
          Resources
          <span className="pn-m-row-caret" aria-hidden="true">&#9662;</span>
        </button>
        {openSection === "resources" && (
          <div className="pn-m-panel" id="pn-resources">
            <a href="/portal/journal" className={`pn-m-arc${pathname === "/portal/journal" ? " is-current" : ""}`} onClick={close}>
              Comprehensive Journal
            </a>
            <a href="/portal/vital-kauai-guides" className={`pn-m-arc${pathname === "/portal/vital-kauai-guides" ? " is-current" : ""}`} onClick={close}>
              Vital Kauaʻi Guides
            </a>
            {GUIDE_GROUPS.map((group) => (
              <div key={group.label}>
                <span className="pn-m-group">{group.label}</span>
                {group.items.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`pn-m-item${pathname === item.href ? " is-current" : ""}`}
                    onClick={close}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            ))}
          </div>
        )}

        <a href="/portal/donate" className={`pn-m-row${pathname === "/portal/donate" ? " is-current" : ""}`} onClick={close}>
          Contribution
        </a>
        <a href="/portal/contact" className={`pn-m-row${pathname === "/portal/contact" ? " is-current" : ""}`} onClick={close}>
          Contact
        </a>
        {/* Community link hidden—restore with the main nav link when the section is ready. */}

        <div className="pn-mobile-foot">
          {email && <span className="pn-mobile-email">{email}</span>}
          <form action="/auth/logout" method="post">
            <button type="submit" className="pn-mobile-out" onClick={close}>Sign Out</button>
          </form>
        </div>
      </div>
    </>
  );
}
