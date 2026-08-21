"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Mobile-only sanctuary wayfinding dock. Visible under 768px, hidden on
// desktop. Four destinations, all existing portal routes — no new routes,
// no nav-architecture changes. Visually mirrors the existing portal-nav
// language: dark forest backdrop, sage hairline, uppercase Jost labels
// with wide tracking, cream text muted on inactive and full on active.
// No icons, no shadow, no animation beyond a single 200ms color
// transition on the active-state swap.
//
// Body padding-bottom is added globally on mobile (in the inline style
// block) so portal content is never obscured by the fixed dock.

const ITEMS: { label: string; href: string }[] = [
  { label: "Dashboard", href: "/portal" },
  // Journey routes through the wayfinder, which drops the member on the
  // calendar week they're in — pre-ceremony preparation before ceremony
  // day, post-ceremony integration after.
  { label: "Journey", href: "/portal/journey" },
  { label: "Resources", href: "/portal/resources" },
  { label: "Contribution", href: "/portal/donate" },
];

function activeKey(pathname: string): string | null {
  if (pathname === "/portal") return "Dashboard";
  if (
    pathname.startsWith("/portal/integration") ||
    pathname.startsWith("/portal/journey")
  ) {
    return "Journey";
  }
  if (
    pathname === "/portal/donate" ||
    pathname.startsWith("/portal/onboarding/donation")
  ) {
    return "Contribution";
  }
  if (pathname.startsWith("/portal/")) return "Resources";
  return null;
}

export function MobileSanctuaryDock() {
  const pathname = usePathname() || "";
  const active = activeKey(pathname);
  return (
    <>
      <style>{`
        .vk-dock { display: none; }
        @media print {
          .vk-dock { display: none !important; }
          body { padding-bottom: 0 !important; }
        }
        @media (max-width: 768px) {
          .vk-dock {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 90;
            background: rgba(14,26,16,.97);
            backdrop-filter: blur(16px);
            border-top: 1px solid rgba(200,169,110,.10);
            padding-bottom: env(safe-area-inset-bottom);
          }
          .vk-dock-link {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 56px;
            font-family: var(--font-body), 'Jost', sans-serif;
            font-size: 10px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: rgba(245,240,232,0.45);
            text-decoration: none;
            transition: color 0.2s;
          }
          .vk-dock-link[data-active="true"] {
            color: #F5F0E8;
          }
          /* Push portal content above the dock so the last paragraph or
             button is never tucked behind it. Desktop unaffected. */
          body { padding-bottom: calc(56px + env(safe-area-inset-bottom)); }
        }
      `}</style>
      <nav className="vk-dock" aria-label="Member portal">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            data-active={active === item.label}
            className="vk-dock-link"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
