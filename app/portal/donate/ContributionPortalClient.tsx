"use client";

/**
 * PR 8 (D-085): Member Contribution Portal interactivity.
 *
 * This component formats and never calculates money — every cent value arrives
 * from the member-safe canonical views. Checkout requests carry only an
 * agreement id (or a gift amount) plus a per-intent requestId; the server
 * derives the Contribution amount. One copper action per state.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  MemberOverview, MemberAgreement, MemberActivity, MemberAttempt,
} from "./page";

const IVORY = "#f6f1e8", PAPER = "#fffdf8", FOREST = "#0d2118", FOREST2 = "#173529";
const SAGE_SOFT = "#e7efe7", COPPER = "#a6653f", COPPER_DARK = "#8f5434";
const INK = "#18211c", MUTED = "#687169", LINE = "#dedbd1";

const DISPLAY = "var(--font-display, Georgia, serif)";

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 });
}

const STATE_LABEL: Record<string, string> = {
  unpaid: "Payment needed",
  partial: "Partially received",
  paid: "Received in full",
  overpaid: "More than Contribution received",
  refunded: "Refunded",
  not_applicable: "Gift",
};
const PURPOSE_LABEL: Record<string, string> = {
  journey_contribution: "Journey Contribution",
  membership: "Membership Contribution",
  additional_gift: "Additional gift",
  other: "Contribution",
};
const METHOD_LABEL: Record<string, string> = {
  stripe_payment: "Card payment",
  external_payment: "Recorded payment",
  refund: "Refund or correction",
  reversal: "Refund or correction",
};

const GIFT_PRESETS = [50000, 250000, 500000, 1500000] as const;
const GIFT_MIN_DOLLARS = 5, GIFT_MAX_DOLLARS = 5000000;

type AgreementWithJourney = MemberAgreement & { journeyStartAt: string | null };

const card: React.CSSProperties = {
  background: PAPER, border: `1px solid ${LINE}`, borderRadius: 18,
};
const h2: React.CSSProperties = {
  fontFamily: DISPLAY, fontWeight: 400, fontSize: 28, margin: 0, color: FOREST,
};

export default function ContributionPortalClient({
  overview, agreements, activity, liveAttempts, attemptsFailed, checkoutReady,
}: {
  overview: MemberOverview | null;
  agreements: AgreementWithJourney[] | null;
  activity: MemberActivity[] | null;
  liveAttempts: MemberAttempt[];
  attemptsFailed: boolean;
  checkoutReady: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const returned = params.get("checkout"); // "confirming" | "canceled" | null
  const returnedAttempt = params.get("attempt");

  const [busy, setBusy] = useState<string | null>(null); // agreement_id or "gift"
  const [notice, setNotice] = useState<string | null>(null);
  // True while the member's one-live gift slot is held by an earlier checkout;
  // unlocks the cancel affordance next to the notice.
  const [giftBlocked, setGiftBlocked] = useState(false);
  const [cancelingGift, setCancelingGift] = useState(false);

  async function cancelGiftCheckout() {
    if (cancelingGift) return;
    setCancelingGift(true);
    try {
      const res = await fetch("/api/finance/member-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "cancel_gift" }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (j.ok || j.error === "nothing_to_cancel") {
        setGiftBlocked(false);
        setNotice("Your previous gift checkout was canceled. Nothing was charged — you can start a new gift.");
        router.refresh();
      } else if (j.error === "already_received") {
        setGiftBlocked(false);
        setNotice("That gift payment was already completed, so there was nothing to cancel. Thank you.");
        router.refresh();
      } else {
        setNotice("We couldn't cancel the previous checkout. Nothing has been charged — please try again.");
      }
    } catch {
      setNotice("We couldn't cancel the previous checkout. Nothing has been charged — please try again.");
    } finally {
      setCancelingGift(false);
    }
  }
  // The banner never asserts payment on a bare URL param: it requires the
  // attempt id (whose status the bounded poll verifies) and speaks only of
  // confirming, not of receipt (bounded review #6).
  const [confirming, setConfirming] = useState(returned === "confirming" && Boolean(returnedAttempt));
  const [confirmDone, setConfirmDone] = useState(false);

  // One requestId per user intent, regenerated only when the intent changes.
  const requestIds = useRef(new Map<string, string>());
  function requestIdFor(intent: string, fresh = false): string {
    if (fresh || !requestIds.current.has(intent)) {
      requestIds.current.set(intent, crypto.randomUUID());
    }
    return requestIds.current.get(intent)!;
  }

  // Bounded confirmation polling after a success return: at most 6 checks over
  // ~30s, then rest honestly. No client-authored money state — completion only
  // comes from the canonical views after the worker writes the ledger.
  useEffect(() => {
    if (returned !== "confirming" || !returnedAttempt) return;
    let cancelled = false;
    let checks = 0;
    async function poll() {
      while (!cancelled && checks < 6) {
        checks += 1;
        try {
          const res = await fetch(`/api/finance/member-checkout?attempt=${returnedAttempt}`);
          if (res.ok) {
            const j = (await res.json()) as { status?: string };
            if (j.status === "completed") {
              if (!cancelled) {
                setConfirmDone(true);
                setConfirming(false);
                router.refresh();
              }
              return;
            }
          }
        } catch { /* transient; next tick */ }
        await new Promise((r) => setTimeout(r, 5000));
      }
      if (!cancelled) setConfirming(false);
    }
    void poll();
    return () => { cancelled = true; };
  }, [returned, returnedAttempt, router]);

  async function beginCheckout(
    intent: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    setBusy(intent);
    setNotice(null);
    try {
      const res = await fetch("/api/finance/member-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, requestId: requestIdFor(intent) }),
      });
      const j = (await res.json()) as { ok?: boolean; url?: string; error?: string; retryWithNewRequest?: boolean };
      if (j.ok && j.url) {
        window.location.assign(j.url);
        return;
      }
      if (j.retryWithNewRequest) {
        requestIdFor(intent, true);
        router.refresh();
        setNotice(
          j.error === "amount_changed"
            ? "Your Contribution was updated. Please review the new amount and continue again."
            : "That payment session ended. Please review your figures and continue again.",
        );
      } else if (res.status === 503) {
        setNotice("Secure card payment is temporarily unavailable. Nothing has been charged.");
      } else if (j.error === "already_received" || j.error === "nothing_payable") {
        router.refresh();
        setNotice("This Contribution has already been received. Thank you.");
      } else if (j.error === "gift_in_progress") {
        setGiftBlocked(true);
        setNotice("A gift checkout is already in progress. You can cancel it below and start fresh — nothing has been charged.");
      } else if (res.status === 502) {
        setNotice("Our payment provider could not be reached. Nothing has been charged — please try again in a moment.");
      } else {
        setNotice("We couldn't start secure payment. Nothing has been charged — please try again.");
      }
    } catch {
      setNotice("We couldn't start secure payment. Nothing has been charged — please try again.");
    } finally {
      setBusy(null);
    }
  }

  // ── Gift state ──
  const [giftChoice, setGiftChoice] = useState<number | "custom" | null>(null);
  const [customGift, setCustomGift] = useState("");
  const giftCents = useMemo(() => {
    if (giftChoice === "custom") {
      const dollars = Number(customGift);
      if (!Number.isInteger(dollars) || dollars < GIFT_MIN_DOLLARS || dollars > GIFT_MAX_DOLLARS) return null;
      return dollars * 100;
    }
    return giftChoice;
  }, [giftChoice, customGift]);

  // Cards and the overview badge share ONE visibility rule: canceled/waived
  // agreements neither render nor color the badge (bounded review #7).
  const contributionAgreements = (agreements ?? []).filter(
    (a) => a.purpose !== "additional_gift"
      && a.lifecycle_status !== "canceled" && a.lifecycle_status !== "waived",
  );
  const liveByAgreement = new Map(liveAttempts.map((s) => [s.agreement_id, s]));

  const overviewState = (() => {
    if (!overview) return null;
    if (contributionAgreements.length > 1 && overview.active_agreement_count > 1) {
      return `${overview.active_agreement_count} active Contributions`;
    }
    const first = contributionAgreements[0];
    return first ? (STATE_LABEL[first.payment_state] ?? first.payment_state) : null;
  })();

  const sectionGap: React.CSSProperties = { marginTop: 44 };

  return (
    <main style={{ width: "min(100% - 40px, 1000px)", margin: "0 auto", padding: "56px 0 96px", color: INK, background: "transparent" }}>
      {/* Approved Contribution message — verbatim */}
      <section aria-labelledby="contribution-title">
        <p style={{ margin: "0 0 16px", color: COPPER, fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Your Contribution
        </p>
        <h1 id="contribution-title" style={{ fontFamily: DISPLAY, fontWeight: 400, maxWidth: 820, margin: "0 0 22px", color: "#111914", fontSize: "clamp(38px, 6vw, 64px)", lineHeight: 1.02, letterSpacing: "-0.03em" }}>
          Mahalo for your contribution.
        </h1>
        <div style={{ maxWidth: 790, color: "#415047", fontSize: 17, lineHeight: 1.65 }}>
          <p style={{ margin: 0 }}>
            Your support helps us provide scholarships for members in need,
            particularly for our first responders and essential workers.
          </p>
        </div>
      </section>

      {/* Return-state banners */}
      {returned === "canceled" && (
        <section role="status" style={{ ...card, ...sectionGap, padding: "16px 22px", fontSize: 14, color: FOREST2 }}>
          Your secure payment session was closed before completing. You can continue
          whenever you're ready — your figures below always reflect what has been received.
        </section>
      )}
      {(confirming || confirmDone) && (
        <section role="status" aria-live="polite" style={{ ...card, ...sectionGap, padding: "16px 22px", fontSize: 14, color: FOREST2, background: SAGE_SOFT }}>
          {confirmDone
            ? "Thank you — your payment has been received and your Contribution is updated below."
            : "Confirming your payment… This can take a moment. Your figures will update once confirmed."}
        </section>
      )}
      {notice && (
        <section role="status" style={{ ...card, ...sectionGap, padding: "16px 22px", fontSize: 14, color: FOREST2 }}>
          {notice}
          {giftBlocked && (
            <div style={{ marginTop: 12 }}>
              <button type="button" onClick={cancelGiftCheckout} disabled={cancelingGift}
                style={{ minHeight: 42, padding: "10px 18px", border: `1px solid ${FOREST2}`, borderRadius: 10, background: "#fff", color: FOREST2, fontWeight: 650, cursor: cancelingGift ? "default" : "pointer" }}>
                {cancelingGift ? "Canceling…" : "Cancel the in-progress gift checkout"}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Contribution overview */}
      <section style={{ ...card, ...sectionGap, overflow: "hidden" }} aria-labelledby="overview-title">
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16, padding: "28px 32px 20px" }}>
          <h2 id="overview-title" style={h2}>Your Contribution</h2>
          {overview && overviewState && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 999, background: SAGE_SOFT, color: FOREST2, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {overviewState}
            </span>
          )}
        </div>
        {overview ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", borderTop: `1px solid ${LINE}` }}>
              {[
                { l: "Contribution", v: overview.contribution_cents },
                { l: "Received", v: overview.net_received_cents },
                { l: "Remaining", v: overview.remaining_cents },
              ].map((m) => (
                <div key={m.l} style={{ padding: "22px 32px 26px", borderTop: `1px solid ${LINE}`, marginTop: -1 }}>
                  <span style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{m.l}</span>
                  <strong style={{ display: "block", marginTop: 9, fontFamily: DISPLAY, fontWeight: 400, fontSize: "clamp(28px, 5vw, 36px)", fontVariantNumeric: "tabular-nums" }}>{usd(m.v)}</strong>
                </div>
              ))}
            </div>
            {overview.additional_gifts_received_cents > 0 && (
              <p style={{ margin: 0, padding: "0 32px 20px", color: MUTED, fontSize: 13 }}>
                Received includes {usd(overview.additional_gifts_received_cents)} in additional gifts.
              </p>
            )}
          </>
        ) : (
          <div style={{ padding: "22px 32px 28px", borderTop: `1px solid ${LINE}` }}>
            <p style={{ margin: "0 0 12px", color: MUTED, fontSize: 14 }}>
              We couldn't load your Contribution details. No payment was made and nothing has changed.
            </p>
            <button type="button" onClick={() => router.refresh()}
              style={{ minHeight: 44, padding: "10px 18px", borderRadius: 10, border: `1px solid ${FOREST2}`, background: "transparent", color: FOREST2, fontWeight: 650, cursor: "pointer" }}>
              Retry
            </button>
          </div>
        )}
      </section>

      {/* Agreement cards */}
      {agreements === null ? (
        <section style={{ ...card, ...sectionGap, padding: "26px 32px" }}>
          <p style={{ margin: 0, color: MUTED, fontSize: 14 }}>
            This section could not be refreshed. No financial values were changed.
          </p>
        </section>
      ) : contributionAgreements.length === 0 ? (
        overview && (
          <section style={{ ...card, ...sectionGap, padding: "30px 32px" }}>
            <h2 style={{ ...h2, fontSize: 24, marginBottom: 8 }}>No Contribution yet</h2>
            <p style={{ margin: 0, color: MUTED, fontSize: 14, maxWidth: 560 }}>
              When a Contribution is set up for you, it will appear here. You're welcome to
              make an additional gift below at any time.
            </p>
          </section>
        )
      ) : (
        contributionAgreements
          .map((a) => (
            <AgreementCard
              key={a.agreement_id}
              agreement={a}
              live={liveByAgreement.get(a.agreement_id) ?? null}
              attemptsFailed={attemptsFailed}
              checkoutReady={checkoutReady}
              busy={busy === a.agreement_id}
              onPay={() => beginCheckout(a.agreement_id, { kind: "contribution", agreementId: a.agreement_id })}
            />
          ))
      )}

      {/* Additional gift */}
      <section style={{ ...card, ...sectionGap, padding: "30px 32px" }} aria-labelledby="gift-title">
        <p style={{ margin: "0 0 6px", color: COPPER, fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>Optional</p>
        <h2 id="gift-title" style={{ ...h2, marginBottom: 7 }}>Make an additional gift</h2>
        <p style={{ margin: 0, color: MUTED, fontSize: 14, lineHeight: 1.55 }}>
          An additional gift is separate from your Contribution and never changes what remains.
        </p>
        <div role="group" aria-label="Gift amount" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 10, marginTop: 22 }}>
          {GIFT_PRESETS.map((cents) => (
            <button key={cents} type="button" onClick={() => setGiftChoice(cents)}
              aria-pressed={giftChoice === cents}
              style={{ minHeight: 48, border: `1px solid ${giftChoice === cents ? FOREST2 : "#d6d7d0"}`, boxShadow: giftChoice === cents ? `inset 0 0 0 1px ${FOREST2}` : "none", background: giftChoice === cents ? SAGE_SOFT : "#fff", borderRadius: 10, color: INK, fontWeight: 650, cursor: "pointer" }}>
              {usd(cents)}
            </button>
          ))}
          <button type="button" onClick={() => setGiftChoice("custom")}
            aria-pressed={giftChoice === "custom"}
            style={{ minHeight: 48, border: `1px solid ${giftChoice === "custom" ? FOREST2 : "#d6d7d0"}`, boxShadow: giftChoice === "custom" ? `inset 0 0 0 1px ${FOREST2}` : "none", background: giftChoice === "custom" ? SAGE_SOFT : "#fff", borderRadius: 10, color: INK, fontWeight: 650, cursor: "pointer" }}>
            Custom
          </button>
        </div>
        {giftChoice === "custom" && (
          <div style={{ marginTop: 14 }}>
            <label htmlFor="custom-gift" style={{ display: "block", fontSize: 13, color: MUTED, marginBottom: 6 }}>
              Custom amount in whole dollars ({usd(GIFT_MIN_DOLLARS * 100)}–{usd(GIFT_MAX_DOLLARS * 100)})
            </label>
            <input id="custom-gift" inputMode="numeric" pattern="[0-9]*" value={customGift}
              onChange={(e) => setCustomGift(e.target.value.replace(/[^0-9]/g, ""))}
              style={{ width: 200, minHeight: 48, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 14px", fontSize: 16, background: "#fff" }} />
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, marginTop: 18 }}>
          <p style={{ margin: 0, color: MUTED, fontSize: 13, lineHeight: 1.45, maxWidth: 520 }}>
            Your gift supports access, the ʻāina, nonprofit partners, and the life of Vital Kauaʻi.
          </p>
          {checkoutReady ? (
            <button type="button" disabled={!giftCents || busy?.startsWith("gift:")}
              onClick={() => giftCents && beginCheckout(`gift:${giftCents}`, { kind: "additional_gift", amountCents: giftCents })}
              style={{ minHeight: 48, padding: "13px 22px", border: 0, borderRadius: 10, color: "#fff", background: !giftCents || busy?.startsWith("gift:") ? "#c9b6a8" : COPPER, fontWeight: 700, cursor: !giftCents || busy?.startsWith("gift:") ? "default" : "pointer" }}
              onMouseOver={(e) => { if (giftCents && busy !== "gift") e.currentTarget.style.background = COPPER_DARK; }}
              onMouseOut={(e) => { if (giftCents && busy !== "gift") e.currentTarget.style.background = COPPER; }}>
              {busy?.startsWith("gift:") ? "Preparing secure payment…" : "Continue with gift"}
            </button>
          ) : (
            <div>
              <button type="button" disabled
                style={{ minHeight: 48, padding: "13px 22px", border: 0, borderRadius: 10, color: "#fff", background: "#c9b6a8", fontWeight: 700 }}>
                Continue with gift
              </button>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: MUTED }}>
                Secure card payment is temporarily unavailable. Nothing has been charged.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Payment activity */}
      <section style={{ ...card, ...sectionGap, overflow: "hidden" }} aria-labelledby="activity-title">
        <div style={{ padding: "28px 32px 16px" }}>
          <p style={{ margin: "0 0 6px", color: COPPER, fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>History</p>
          <h2 id="activity-title" style={h2}>Payment activity</h2>
        </div>
        {activity === null ? (
          <p style={{ margin: 0, padding: "4px 32px 26px", color: MUTED, fontSize: 14 }}>
            This section could not be refreshed. No financial values were changed.
          </p>
        ) : activity.length === 0 ? (
          <p style={{ margin: 0, padding: "4px 32px 26px", color: MUTED, fontSize: 14 }}>
            No Contribution activity yet. New activity will appear here after it is received.
          </p>
        ) : (
          <div role="table" aria-label="Payment activity">
            {activity.map((row) => (
              <div key={row.entry_id} role="row" style={{ display: "grid", gridTemplateColumns: "130px 1fr 170px 110px", alignItems: "center", gap: 16, padding: "16px 32px", borderTop: `1px solid ${LINE}`, fontSize: 14 }}>
                <span role="cell" style={{ color: MUTED }}>
                  {new Date(row.occurred_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <strong role="cell">{PURPOSE_LABEL[row.purpose] ?? "Contribution"}</strong>
                <span role="cell" style={{ color: MUTED }}>{METHOD_LABEL[row.entry_type] ?? row.entry_type}</span>
                <span role="cell" aria-label={`${row.amount_cents < 0 ? "minus " : ""}${usd(Math.abs(row.amount_cents))}`}
                  style={{ textAlign: "right", fontWeight: 750, fontVariantNumeric: "tabular-nums", color: row.amount_cents < 0 ? "#8d4c3b" : INK }}>
                  {row.amount_cents < 0 ? `−${usd(Math.abs(row.amount_cents))}` : `+${usd(row.amount_cents)}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p style={{ marginTop: 28, textAlign: "center", color: MUTED, fontSize: 13 }}>
        Questions about your Contribution? <a href="/portal/contact" style={{ color: FOREST2, textUnderlineOffset: 3 }}>Contact Vital Kauaʻi</a>.
      </p>
    </main>
  );
}

function AgreementCard({
  agreement: a, live, attemptsFailed, checkoutReady, busy, onPay,
}: {
  agreement: AgreementWithJourney;
  live: MemberAttempt | null;
  attemptsFailed: boolean;
  checkoutReady: boolean;
  busy: boolean;
  onPay: () => void;
}) {
  const label = PURPOSE_LABEL[a.purpose] ?? "Contribution";
  const journeyLine = a.journeyStartAt
    ? new Date(a.journeyStartAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;
  const pct = a.contribution_cents > 0
    ? Math.max(0, Math.min(100, Math.round((a.received_cents / a.contribution_cents) * 100)))
    : 0;

  const isDraft = a.lifecycle_status === "draft";
  const isPaid = a.payment_state === "paid";
  const isRefunded = a.payment_state === "refunded";
  const isOverpaid = a.payment_state === "overpaid";
  const payable = a.payment_state !== "not_applicable" && a.payable_remaining_cents > 0
    && a.lifecycle_status === "active";
  const resume = live !== null && live.status === "open";
  const processing = live !== null && live.status === "creating";

  return (
    <section style={{ ...card, marginTop: 44, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 320px)", gap: 30, padding: 32 }} aria-label={label}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: "0 0 6px", color: COPPER, fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>{label}</p>
        <h2 style={{ ...h2, fontSize: 26, marginBottom: 8 }}>
          {journeyLine ? `Journey · ${journeyLine}` : label}
        </h2>
        <p style={{ margin: 0, color: MUTED, fontSize: 14, lineHeight: 1.55 }}>
          Your secure card payment will apply to the full remaining Contribution. Card
          details are handled by Stripe and never touch Vital Kauaʻi.
        </p>
        <div aria-label={`${pct} percent received`} style={{ height: 8, margin: "24px 0 12px", overflow: "hidden", borderRadius: 8, background: "#e4e3dc" }}>
          <i style={{ display: "block", width: `${pct}%`, height: "100%", borderRadius: "inherit", background: COPPER }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, color: "#475249", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
          <span>{usd(a.received_cents)} received</span>
          <span>{usd(a.contribution_cents)} Contribution</span>
        </div>
        {a.refunded_cents > 0 && (
          <p style={{ margin: "10px 0 0", color: MUTED, fontSize: 13 }}>
            Includes {usd(a.refunded_cents)} refunded.
          </p>
        )}
      </div>

      <aside style={{ alignSelf: "stretch", padding: 24, borderRadius: 14, color: "#f5f0e6", background: FOREST }}>
        <div style={{ color: "#aebcb1", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Remaining</div>
        <div style={{ margin: "8px 0 5px", fontFamily: DISPLAY, fontWeight: 400, fontSize: "clamp(30px, 5vw, 38px)", fontVariantNumeric: "tabular-nums" }}>{usd(a.remaining_cents)}</div>

        {isPaid ? (
          <p style={{ margin: 0, color: "#bfcac1", fontSize: 13, lineHeight: 1.5 }}>
            Received in full. Thank you — no payment is needed.
          </p>
        ) : isRefunded ? (
          <p style={{ margin: 0, color: "#bfcac1", fontSize: 13, lineHeight: 1.5 }}>
            A refund has been issued on this Contribution. Questions?{" "}
            <a href="/portal/contact" style={{ color: "#e7efe7" }}>Contact Vital Kauaʻi</a>.
          </p>
        ) : isOverpaid ? (
          <p style={{ margin: 0, color: "#bfcac1", fontSize: 13, lineHeight: 1.5 }}>
            We received more than the Contribution. We will contact you if action is needed.
          </p>
        ) : isDraft ? (
          <p style={{ margin: 0, color: "#bfcac1", fontSize: 13, lineHeight: 1.5 }}>
            This Contribution is being prepared. Payment will open once it is active.
          </p>
        ) : processing ? (
          // A prior request stopped before the secure session opened. The
          // begin call is idempotent — continuing resumes that same attempt
          // and finishes preparing it (bounded review #4); nothing is charged
          // twice. When checkout is paused, the truth is "paused", not
          // "resolving on its own".
          checkoutReady ? (
            <>
              <p style={{ margin: "0 0 14px", color: "#bfcac1", fontSize: 12, lineHeight: 1.5 }}>
                A previous payment session didn't finish being prepared. Continuing will
                resume it securely — nothing has been charged.
              </p>
              <button type="button" onClick={onPay} disabled={busy} style={btnStyle(!busy)}>
                {busy ? "Preparing secure payment…" : "Continue to secure payment"}
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled style={btnStyle(false)}>Continue to secure payment</button>
              <p style={{ margin: "10px 0 0", color: "#bfcac1", fontSize: 12 }}>
                Secure card payment is temporarily unavailable. Nothing has been charged.
              </p>
            </>
          )
        ) : payable ? (
          checkoutReady ? (
            <>
              <p style={{ margin: "0 0 18px", color: "#bfcac1", fontSize: 12, lineHeight: 1.5 }}>
                You'll review the amount before paying securely through Stripe.
              </p>
              <button type="button" onClick={onPay} disabled={busy} style={btnStyle(!busy)}>
                {busy ? "Preparing secure payment…" : resume ? "Resume secure payment" : "Continue to secure payment"}
              </button>
              {attemptsFailed && (
                <p style={{ margin: "10px 0 0", color: "#bfcac1", fontSize: 11 }}>
                  We couldn't check for an in-progress session; continuing will resume it if one exists.
                </p>
              )}
            </>
          ) : (
            <>
              <button type="button" disabled style={btnStyle(false)}>Continue to secure payment</button>
              <p style={{ margin: "10px 0 0", color: "#bfcac1", fontSize: 12 }}>
                Secure card payment is temporarily unavailable. Nothing has been charged.
              </p>
            </>
          )
        ) : (
          <p style={{ margin: 0, color: "#bfcac1", fontSize: 13 }}>No payment is needed right now.</p>
        )}
      </aside>
    </section>
  );
}

function btnStyle(enabled: boolean): React.CSSProperties {
  return {
    width: "100%", minHeight: 48, padding: "13px 18px", border: 0, borderRadius: 10,
    color: "#fff", background: enabled ? COPPER : "#5c7264", fontWeight: 700,
    cursor: enabled ? "pointer" : "default",
  };
}
