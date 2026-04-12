"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const TABS = [
  { label: "Overview", href: "/dashboard" },
  { label: "Clients", href: "/dashboard/clients" },
  { label: "Leads", href: "/dashboard/leads" },
  { label: "Ceremonies", href: "/dashboard/ceremonies" },
  { label: "Onboarding", href: "/dashboard/onboarding" },
  { label: "Medical", href: "/dashboard/medical" },
  { label: "Outcomes", href: "/dashboard/outcomes" },
  { label: "Dosing", href: "/dashboard/dosing" },
  { label: "Financials", href: "/dashboard/financials" },
];

export default function DashboardTabs() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <nav
      style={{
        background: "#fff",
        borderBottom: "0.5px solid rgba(0,0,0,0.1)",
        padding: "0 2rem",
        display: "flex",
        gap: 0,
        overflowX: "auto",
      }}
    >
      {TABS.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              fontSize: 13,
              color: active ? "#1A1A18" : "#6B6B67",
              padding: "12px 16px",
              borderBottom: active ? "2px solid #1D6B4A" : "2px solid transparent",
              whiteSpace: "nowrap",
              textDecoration: "none",
              fontWeight: active ? 500 : 400,
              fontFamily: "var(--font-body, sans-serif)",
              flexShrink: 0,
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
