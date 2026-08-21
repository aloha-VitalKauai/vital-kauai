"use client";

/**
 * PR 7: interactivity for the command center — status strip, overview grid,
 * attention queue, and the three-tab position workspace. All money arrives as
 * cents computed by canonical SQL; this component formats and never recomputes.
 * Search/filter/tab state lives in the URL so refresh and back/forward keep the
 * founder's place.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const IVORY = "#F7F4ED", PAPER = "#FFFDF8", DEEP = "#0D2A1D", FOREST = "#214C38";
const SAGE = "#DCEADF", COPPER = "#B66135", SAND = "#D9CFBF", INK = "#1D211D";
const MUTED = "#74786F", DANGER = "#9A3B35";

type Overview = {
  contribution_cents: number; net_received_cents: number; refunded_cents: number;
  remaining_cents: number; payable_remaining_cents: number; active_agreements: number;
  expenses_cents: number; payouts_cents: number; pending_payouts_cents: number;
  operating_margin_cents: number;
};
type Member = {
  member_id: string; name: string; email: string | null; agreement_count: number;
  contribution_cents: number; net_received_cents: number; remaining_cents: number;
  payable_remaining_cents: number;
};
type Journey = {
  journey_id: string; label: string; startAt: string | null; agreement_count: number;
  contribution_cents: number; net_received_cents: number; remaining_cents: number;
};
type Balance = {
  agreement_id: string; member_id: string; journey_id: string | null;
  purpose: string; payable_remaining_cents: number; payment_state: string;
};
type Activity = {
  id: string; entry_type: string; amount_cents: number; source: string;
  external_method: string | null; occurred_at: string; livemode: boolean;
  purpose: string; member_id: string; member_name: string;
};
type Health = {
  reconciledAt: string | null; openLiveExceptions: number; quarantined: number;
  checkoutReady: boolean; checkoutNeedsReview: number;
};

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function rel(iso: string | null): string {
  if (!iso) return "never";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 2) return "just now";
  if (min < 90) return `${min} minutes ago`;
  const h = Math.round(min / 60);
  return h < 36 ? `${h} hours ago` : `${Math.round(h / 24)} days ago`;
}

const STATE_LABEL: Record<string, string> = {
  unpaid: "Unpaid", partial: "Partial", paid: "Paid", overpaid: "Overpaid",
  refunded: "Refunded", not_applicable: "Not applicable", unknown: "Unknown",
};

/** 44px touch target for small inline links without disturbing layout. */
const touchLink: React.CSSProperties = {
  display: "inline-block", padding: "12px 0", margin: "-12px 0", textDecoration: "none",
};

const card: React.CSSProperties = { background: PAPER, border: `1px solid ${SAND}`, borderRadius: 15 };
const label: React.CSSProperties = { fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, fontWeight: 700 };
const h2: React.CSSProperties = { fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 24, margin: 0, color: DEEP };

export default function FounderFinancialCommandCenter({
  overview, failedSections, members, journeys, balances, activity, health,
}: {
  overview: Overview | null;
  failedSections: string[];
  members: Member[];
  journeys: Journey[];
  balances: Balance[];
  activity: Activity[];
  health: Health;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "members";
  const q = params.get("q") ?? "";
  const stateFilter = params.get("state") ?? "all";
  const attentionOnly = params.get("attention") === "1";

  // A failed read is unknown, never an all-clear. Each of these suppresses the
  // green states its data would otherwise justify.
  const balancesFailed = failedSections.includes("balances");
  const checkoutFailed = failedSections.includes("checkout");
  const reconFailed = failedSections.includes("reconciliation");

  // The search box is local state: filtering is immediate, while the URL (and
  // the server round-trip it triggers on this force-dynamic page) updates on a
  // debounce. Back/forward resyncs the box from the URL.
  const [search, setSearch] = useState(q);
  useEffect(() => { setSearch(q); }, [q]);
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => setParam("q", search), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, q]);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "" || value === "all") next.delete(key);
    else next.set(key, value);
    router.replace(`/dashboard/financials?${next.toString()}`, { scroll: false });
  }

  // Payment state per member: worst state across their agreements (display only;
  // per-agreement states come straight from the canonical view).
  const memberState = useMemo(() => {
    const rank = ["overpaid", "refunded", "unpaid", "partial", "paid", "not_applicable"];
    const m = new Map<string, string>();
    for (const b of balances) {
      const cur = m.get(b.member_id);
      if (!cur || rank.indexOf(b.payment_state) < rank.indexOf(cur)) m.set(b.member_id, b.payment_state);
    }
    return m;
  }, [balances]);

  const attention = useMemo(() => {
    const items: { key: string; icon: string; title: string; meta: string; amount?: number; href: string }[] = [];
    // quarantined ⊂ openLiveExceptions — the subset annotates, never adds.
    if (health.openLiveExceptions > 0) {
      items.push({
        key: "recon", icon: "!",
        title: `${health.openLiveExceptions} reconciliation item(s) need review`,
        meta: `${health.quarantined > 0 ? `${health.quarantined} quarantined · ` : ""}Live-mode exceptions · open Verification`,
        href: "/dashboard/financials/verification",
      });
    }
    if (reconFailed) {
      items.push({
        key: "recon-unknown", icon: "?",
        title: "Reconciliation status could not be refreshed",
        meta: "Exception counts are unknown, not zero · open Verification",
        href: "/dashboard/financials/verification",
      });
    }
    if (balancesFailed) {
      items.push({
        key: "balances-unknown", icon: "?",
        title: "Agreement balances could not be refreshed",
        meta: "Attention amounts and payment states are unknown, not current",
        href: "/dashboard/financials/verification",
      });
    }
    const money = balances
      .filter((b) => b.payable_remaining_cents > 0 && (b.payment_state === "partial" || b.payment_state === "unpaid"))
      .sort((a, b) =>
        a.payment_state === b.payment_state
          ? b.payable_remaining_cents - a.payable_remaining_cents
          : a.payment_state === "partial" ? -1 : 1,
      );
    for (const b of money) {
      const nm = members.find((m) => m.member_id === b.member_id);
      items.push({
        key: b.agreement_id, icon: "$",
        title: nm?.name ?? "Member",
        meta: `${b.payment_state === "partial" ? "Partially received" : "Payment needed"} · ${b.purpose === "journey_contribution" ? "Journey Contribution" : b.purpose.replace(/_/g, " ")}`,
        amount: b.payable_remaining_cents,
        href: `/dashboard/${b.member_id}?tab=Financials`,
      });
    }
    if (checkoutFailed) {
      items.push({
        key: "checkout-unknown", icon: "?",
        title: "Checkout link status could not be refreshed",
        meta: "Link and session states are unknown, not clear · open Verification",
        href: "/dashboard/financials/verification",
      });
    } else if (health.checkoutNeedsReview > 0) {
      items.push({
        key: "checkout", icon: "…",
        title: `${health.checkoutNeedsReview} checkout item(s) need review`,
        meta: "Persisted attempt or expired session · open Verification",
        href: "/dashboard/financials/verification",
      });
    }
    return items;
  }, [balances, members, health, balancesFailed, checkoutFailed, reconFailed]);

  const filteredMembers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return members
      .filter((m) => !needle || m.name.toLowerCase().includes(needle) || (m.email ?? "").toLowerCase().includes(needle))
      .filter((m) => stateFilter === "all" || (memberState.get(m.member_id) ?? "not_applicable") === stateFilter)
      .filter((m) => !attentionOnly || m.payable_remaining_cents > 0)
      .sort((a, b) => b.remaining_cents - a.remaining_cents || a.name.localeCompare(b.name));
  }, [members, search, stateFilter, attentionOnly, memberState]);

  return (
    <>
      {/* System status strip */}
      <section style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, padding: "13px 16px", background: "#f1f6f1", border: "1px solid #c9dccd", borderRadius: 12, marginBottom: 16, color: "#375141", fontSize: 13 }}>
        <span style={{ background: SAGE, color: "#1f5a3d", borderRadius: 999, padding: "6px 10px", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10, fontWeight: 750 }}>V2 active</span>
        <span>{health.checkoutReady ? "Checkout links available" : "Checkout links paused"}</span>
        <span>{reconFailed ? "Reconciliation status unknown" : `Reconciled ${rel(health.reconciledAt)}`}</span>
        <span style={{ color: checkoutFailed || health.openLiveExceptions + health.checkoutNeedsReview > 0 ? COPPER : FOREST, fontWeight: 650 }}>
          {checkoutFailed
            ? `${health.openLiveExceptions} item(s) need review · checkout unknown`
            : `${health.openLiveExceptions + health.checkoutNeedsReview} item(s) need review`}
        </span>
        <a href="/dashboard/financials/verification" style={{ ...touchLink, marginLeft: "auto", color: FOREST, fontWeight: 650 }}>Open verification →</a>
        <a href="/dashboard/financials/reconciliation" style={{ ...touchLink, color: FOREST, fontWeight: 650 }}>Run controls</a>
      </section>

      {failedSections.length > 0 && (
        <section style={{ ...card, borderColor: DANGER, padding: "12px 16px", marginBottom: 16, color: DANGER, fontSize: 13 }}>
          {failedSections.join(", ")} could not be refreshed. No financial values were changed.
        </section>
      )}

      {/* Canonical overview */}
      {overview ? (
        overview.active_agreements === 0 && overview.contribution_cents === 0 ? (
          <section style={{ ...card, padding: "36px 24px", textAlign: "center", marginBottom: 18 }}>
            <h2 style={{ ...h2, marginBottom: 8 }}>Financial activity begins here</h2>
            <p style={{ color: MUTED, fontSize: 14, maxWidth: 460, margin: "0 auto 16px" }}>
              No V2 contribution agreements have been created yet. Create an agreement from a
              member’s Financials tab to begin.
            </p>
            <a href="/dashboard/clients" style={{ display: "inline-block", background: COPPER, color: "#fff", borderRadius: 9, padding: "11px 18px", fontWeight: 650, textDecoration: "none" }}>Open members</a>
          </section>
        ) : (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }}>
            {[
              { l: "Contribution", v: overview.contribution_cents, h: `${overview.active_agreements} active agreement(s)` },
              { l: "Received", v: overview.net_received_cents, h: (overview.contribution_cents > 0 ? `${Math.round((overview.net_received_cents / overview.contribution_cents) * 100)}% of Contribution` : "Net of refunds and reversals") + (overview.refunded_cents > 0 ? ` · ${usd(overview.refunded_cents)} refunded` : "") },
              { l: "Remaining", v: overview.remaining_cents, h: `${usd(overview.payable_remaining_cents)} collectible now` },
              { l: "Expenses", v: overview.expenses_cents, h: "Operational costs" },
              { l: "Payouts", v: overview.payouts_cents, h: `${usd(overview.pending_payouts_cents)} pending or scheduled` },
              { l: "Operating margin", v: overview.operating_margin_cents, h: "Received less operating costs", danger: overview.operating_margin_cents < 0 },
            ].map((t) => (
              <div key={t.l} style={{ ...card, padding: "20px 22px", minHeight: 110 }}>
                <div style={label}>{t.l}</div>
                <div style={{ fontFamily: "var(--font-display, serif)", fontSize: "clamp(22px, 5.5vw, 30px)", color: t.danger ? DANGER : DEEP, margin: "10px 0 6px", fontVariantNumeric: "tabular-nums" }}>
                  {usd(t.v)}
                </div>
                <div style={{ fontSize: 12, color: MUTED }}>{t.h}</div>
              </div>
            ))}
          </section>
        )
      ) : (
        <section style={{ ...card, padding: "20px 22px", marginBottom: 18, color: MUTED }}>
          The overview could not be refreshed. No financial values were changed.
        </section>
      )}

      {/* Attention queue */}
      <section style={{ ...card, marginBottom: 18, paddingBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "19px 22px 13px" }}>
          <h2 style={h2}>Needs attention</h2>
          {attention.length > 5 && (
            <button type="button" onClick={() => setParam("attention", "1")} style={{ background: "none", border: "none", color: COPPER, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>View all</button>
          )}
        </div>
        {attention.length === 0 ? (
          <p style={{ padding: "0 22px 16px", margin: 0, color: MUTED, fontSize: 13 }}>
            <strong style={{ color: FOREST }}>Nothing needs attention.</strong> Contributions,
            reconciliation, and scheduled payouts are current.
          </p>
        ) : (
          attention.slice(0, 5).map((it) => (
            <a key={it.key} href={it.href} style={{ display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center", padding: "13px 22px", borderTop: "1px solid #ece6da", textDecoration: "none", color: INK }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: "#f4e8de", color: COPPER, display: "grid", placeItems: "center", fontWeight: 800 }}>{it.icon}</span>
              <span>
                <span style={{ display: "block", fontWeight: 700, color: DEEP, fontSize: 13 }}>{it.title}</span>
                <span style={{ display: "block", fontSize: 11, color: MUTED, marginTop: 3 }}>{it.meta}</span>
              </span>
              {it.amount !== undefined ? (
                <span style={{ fontWeight: 750, fontVariantNumeric: "tabular-nums" }}>{usd(it.amount)}</span>
              ) : (
                <span style={{ color: COPPER }}>→</span>
              )}
            </a>
          ))
        )}
      </section>

      {/* Position workspace */}
      <section style={{ ...card, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 22, padding: "0 22px", borderBottom: "1px solid #e8e0d3" }}>
          {([["members", "Members"], ["journeys", "Journeys"], ["activity", "Payment activity"]] as const).map(([key, lbl]) => (
            <button key={key} type="button" onClick={() => setParam("tab", key)}
              style={{ padding: "17px 0 13px", border: "none", background: "none", cursor: "pointer", fontWeight: 650, fontSize: 13, color: tab === key ? DEEP : MUTED, borderBottom: tab === key ? `2px solid ${DEEP}` : "2px solid transparent" }}>
              {lbl}
            </button>
          ))}
        </div>

        {tab === "members" && (
          <>
            <div style={{ display: "flex", gap: 10, padding: "15px 22px", background: "#fbf9f3", borderBottom: "1px solid #ece6da", flexWrap: "wrap" }}>
              <input type="search" placeholder="Search members" value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: 180, border: `1px solid ${SAND}`, borderRadius: 8, padding: "10px 12px", background: "#fff", fontSize: 13 }} />
              <select value={stateFilter} onChange={(e) => setParam("state", e.target.value)}
                style={{ border: `1px solid ${SAND}`, borderRadius: 8, padding: "10px 12px", background: "#fff", color: FOREST, fontSize: 13 }}>
                <option value="all">All payment states</option>
                {Object.entries(STATE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: FOREST }}>
                <input type="checkbox" checked={attentionOnly} onChange={(e) => setParam("attention", e.target.checked ? "1" : null)} />
                Needs attention
              </label>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead><tr>
                  {["Member", "Contribution", "Received", "Remaining", "Payment state", ""].map((h, i) => (
                    <th key={h + i} style={{ textAlign: i >= 1 && i <= 3 ? "right" : "left", fontSize: 9, letterSpacing: "0.11em", textTransform: "uppercase", color: "#85877e", padding: "12px 20px" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredMembers.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: "18px 20px", color: MUTED, fontSize: 13 }}>
                      {members.length === 0 ? "No V2 member positions yet." : "Nothing matches the current filters."}
                    </td></tr>
                  ) : filteredMembers.map((m) => {
                    const st = balancesFailed ? "unknown" : (memberState.get(m.member_id) ?? "not_applicable");
                    return (
                      <tr key={m.member_id}>
                        <td style={{ padding: "14px 20px", borderTop: "1px solid #eee8dd", fontSize: 13 }}>
                          <strong style={{ color: DEEP }}>{m.name}</strong>
                          <span style={{ display: "block", fontSize: 11, color: MUTED }}>{m.agreement_count} agreement(s)</span>
                        </td>
                        {[m.contribution_cents, m.net_received_cents, m.remaining_cents].map((v, i) => (
                          <td key={i} style={{ padding: "14px 20px", borderTop: "1px solid #eee8dd", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 650, fontSize: 12 }}>{usd(v)}</td>
                        ))}
                        <td style={{ padding: "14px 20px", borderTop: "1px solid #eee8dd" }}>
                          <span style={{ display: "inline-block", borderRadius: 999, padding: "5px 9px", fontSize: 9, letterSpacing: "0.07em", textTransform: "uppercase", fontWeight: 750, background: st === "paid" ? SAGE : st === "unknown" ? "#eeece5" : "#f2e6d8", color: st === "paid" ? "#2b6847" : st === "unknown" ? MUTED : "#8a5325" }}>
                            {STATE_LABEL[st] ?? st}
                          </span>
                        </td>
                        <td style={{ padding: "14px 20px", borderTop: "1px solid #eee8dd" }}>
                          <a href={`/dashboard/${m.member_id}?tab=Financials`} style={{ ...touchLink, color: COPPER, fontWeight: 750, fontSize: 12 }}>Open member</a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "journeys" && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead><tr>
                {["Journey", "Date", "Contribution", "Received", "Remaining", ""].map((h, i) => (
                  <th key={h + i} style={{ textAlign: i >= 2 && i <= 4 ? "right" : "left", fontSize: 9, letterSpacing: "0.11em", textTransform: "uppercase", color: "#85877e", padding: "12px 20px" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {journeys.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: "18px 20px", color: MUTED, fontSize: 13 }}>No journey-linked agreements yet.</td></tr>
                ) : journeys.map((j) => (
                  <tr key={j.journey_id}>
                    <td style={{ padding: "14px 20px", borderTop: "1px solid #eee8dd", fontSize: 13 }}><strong style={{ color: DEEP }}>{j.label}</strong></td>
                    <td style={{ padding: "14px 20px", borderTop: "1px solid #eee8dd", fontSize: 12, color: MUTED }}>{j.startAt ? new Date(j.startAt).toLocaleDateString() : "—"}</td>
                    {[j.contribution_cents, j.net_received_cents, j.remaining_cents].map((v, i) => (
                      <td key={i} style={{ padding: "14px 20px", borderTop: "1px solid #eee8dd", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 650, fontSize: 12 }}>{usd(v)}</td>
                    ))}
                    <td style={{ padding: "14px 20px", borderTop: "1px solid #eee8dd" }} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "activity" && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead><tr>
                {["Date", "Member", "Type", "Method", "Amount"].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 4 ? "right" : "left", fontSize: 9, letterSpacing: "0.11em", textTransform: "uppercase", color: "#85877e", padding: "12px 20px" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {activity.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: "18px 20px", color: MUTED, fontSize: 13 }}>No payment activity yet.</td></tr>
                ) : activity.map((a) => (
                  <tr key={a.id}>
                    <td style={{ padding: "13px 20px", borderTop: "1px solid #eee8dd", fontSize: 12, color: MUTED }}>{new Date(a.occurred_at).toLocaleDateString()}</td>
                    <td style={{ padding: "13px 20px", borderTop: "1px solid #eee8dd", fontSize: 13, color: DEEP, fontWeight: 650 }}>{a.member_name}</td>
                    <td style={{ padding: "13px 20px", borderTop: "1px solid #eee8dd", fontSize: 12 }}>
                      {a.entry_type === "stripe_payment" ? "Stripe payment"
                        : a.entry_type === "external_payment" ? "External payment"
                        : a.entry_type === "refund" ? "Refund" : "Reversal"}
                      {!a.livemode && <span style={{ marginLeft: 6, fontSize: 9, textTransform: "uppercase", color: MUTED }}>test</span>}
                    </td>
                    <td style={{ padding: "13px 20px", borderTop: "1px solid #eee8dd", fontSize: 12, color: MUTED }}>{a.external_method ?? (a.source === "stripe" ? "Stripe" : "—")}</td>
                    <td style={{ padding: "13px 20px", borderTop: "1px solid #eee8dd", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 650, fontSize: 12, color: a.amount_cents < 0 ? DANGER : INK }}>{usd(a.amount_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <span style={{ display: "none" }}>{IVORY}</span>
    </>
  );
}
