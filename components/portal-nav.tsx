"use client";

import { useState } from "react";

export function PortalNav({ email, currentPage }: { email?: string; currentPage?: string }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const close = () => setIsMobileOpen(false);
  return (
    <>
      <style>{`
        .pn { position:sticky;top:0;z-index:100;background:rgba(14,26,16,.97);backdrop-filter:blur(16px);height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 48px;border-bottom:1px solid rgba(200,169,110,.08); }
        .pn-left { display:flex;align-items:center;gap:32px; }
        .pn-logo { font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:300;letter-spacing:.18em;text-transform:uppercase;color:#F5F0E8;text-decoration:none; }
        .pn-logo em { font-style:italic;color:#A8C5AC; }
        .pn-links { display:flex;align-items:center;gap:4px; }
        .pn-link { font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(245,240,232,.45);text-decoration:none;padding:6px 14px;border-radius:3px;transition:color .2s;border:none;background:none;font-family:inherit;cursor:pointer; }
        .pn-link:hover { color:#F5F0E8; }
        .pn-dropdown { position:relative; }
        .pn-dropdown-trigger { font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#A8C5AC;padding:6px 14px;border-radius:3px;border:none;background:none;font-family:inherit;cursor:pointer;display:flex;align-items:center;gap:6px; }
        .pn-dropdown-trigger::after { content:'\\25BE';font-size:8px;color:#C8A96E; }
        .pn-dropdown-menu { display:none;position:absolute;top:100%;left:0;background:rgba(14,26,16,.98);backdrop-filter:blur(16px);border:.5px solid rgba(200,169,110,.15);border-radius:4px;min-width:180px;padding-top:8px;padding-bottom:8px;box-shadow:0 16px 40px rgba(0,0,0,.4); }
        .pn-dropdown::after { content:'';position:absolute;top:100%;left:0;right:0;height:12px; }
        .pn-dropdown:hover .pn-dropdown-menu { display:block; }
        .pn-dropdown-item { display:block;padding:10px 20px;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(245,240,232,.55);text-decoration:none;transition:color .15s,background .15s;border-left:2px solid transparent; }
        .pn-dropdown-item:hover { color:#F5F0E8;background:rgba(122,158,126,.06); }
        .pn-right { display:flex;align-items:center;gap:14px; }
        .pn-email { font-size:9px;letter-spacing:.1em;color:rgba(245,240,232,.3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
        .pn-out { font-size:8px;letter-spacing:.2em;text-transform:uppercase;color:rgba(245,240,232,.35);background:none;border:1px solid rgba(245,240,232,.12);padding:6px 14px;cursor:pointer;font-family:inherit;transition:color .2s,border-color .2s; }
        .pn-out:hover { color:#F5F0E8;border-color:rgba(245,240,232,.3); }

        /* Hamburger — hidden on desktop, visible on narrow screens */
        .pn-burger { display:none;background:none;border:none;padding:6px 8px;cursor:pointer;font-family:inherit; }
        .pn-burger span { display:block;width:22px;height:1.5px;background:rgba(245,240,232,.7);margin:5px 0;transition:background .2s; }
        .pn-burger:hover span { background:#F5F0E8; }

        /* Mobile full-screen menu */
        .pn-mobile { display:none;position:fixed;inset:0;z-index:200;background:rgba(10,18,11,.97);backdrop-filter:blur(12px);flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:80px 24px; }
        .pn-mobile.open { display:flex; }
        .pn-mobile-close { position:absolute;top:18px;right:22px;background:none;border:none;color:#F5F0E8;font-size:28px;cursor:pointer;font-family:inherit;line-height:1;padding:6px 10px; }
        .pn-mobile a, .pn-mobile form button { font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;letter-spacing:.08em;color:#F5F0E8;text-decoration:none;background:none;border:none;cursor:pointer; }
        .pn-mobile a:hover, .pn-mobile form button:hover { color:#C8A96E; }
        .pn-mobile-section-label { font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:#C8A96E;margin-top:6px; }
        .pn-mobile-email { font-size:10px;letter-spacing:.12em;color:rgba(245,240,232,.4);word-break:break-all;text-align:center;margin-top:12px; }

        @media (max-width:768px) {
          .pn { padding:0 20px; }
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
            <a href="/portal" className="pn-link">Dashboard</a>
            {/* Outcomes tab hidden while the timeline + portal experience are
                being refined. Restore by uncommenting this line. */}
            {/* <a href="/portal/assessments" className="pn-link">Outcomes</a> */}
            <div className="pn-dropdown">
              <button className="pn-dropdown-trigger">Integration / Support</button>
              <div className="pn-dropdown-menu">
                <a href="/portal/integration/pre-ceremony" className="pn-dropdown-item">Pre-Ceremony</a>
                <a href="/portal/integration/post-ceremony" className="pn-dropdown-item">Post-Ceremony</a>
                {/* Comprehensive Journal hidden while we re-do the weekly prompts +
                    re-wire the sync. Restore by uncommenting this line. */}
                {/* <a href="/portal/journal" className="pn-dropdown-item">Comprehensive Journal</a> */}
              </div>
            </div>
            <a href="/portal/donate" className="pn-link">Contribution</a>
            <a href="/portal/contact" className="pn-link">Contact</a>
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
            onClick={() => setIsMobileOpen(true)}
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
        <a href="/portal" onClick={close}>Dashboard</a>
        {/* Outcomes link hidden — restore alongside the desktop link. */}
        {/* <a href="/portal/assessments" onClick={close}>Outcomes</a> */}
        <span className="pn-mobile-section-label">Integration / Support</span>
        <a href="/portal/integration/pre-ceremony" onClick={close}>Pre-Ceremony</a>
        <a href="/portal/integration/post-ceremony" onClick={close}>Post-Ceremony</a>
        {/* Comprehensive Journal hidden — restore alongside the desktop link. */}
        {/* <a href="/portal/journal" onClick={close}>Comprehensive Journal</a> */}
        <a href="/portal/donate" onClick={close}>Contribution</a>
        <a href="/portal/contact" onClick={close}>Contact</a>
        {/* Community link hidden — restore with the main nav link when the section is ready. */}
        <form action="/auth/logout" method="post">
          <button type="submit" onClick={close}>Sign Out</button>
        </form>
        {email && <span className="pn-mobile-email">{email}</span>}
      </div>
    </>
  );
}
