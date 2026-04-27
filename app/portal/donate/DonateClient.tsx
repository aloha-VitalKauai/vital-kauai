"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type DonationRow = {
  id: string;
  amount_cents: number;
  completed_at: string | null;
  receipt_url: string | null;
  kind: string;
};

type Props = {
  state: "no-commitment" | "pay-toward-pledge" | "complete";
  firstName: string;
  expected: number;
  paid: number;
  remaining: number;
  journeyId: string | null;
  memberId: string;
  history: DonationRow[];
};

const GIFT_PRESETS = [5000, 10000, 25000, 50000]; // $50, $100, $250, $500

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function kindLabel(kind: string) {
  if (kind === "journey_contribution") return "Journey Contribution";
  if (kind === "additional_gift") return "Additional Gift";
  if (kind === "initial_membership") return "Membership";
  if (kind === "monthly_membership") return "Monthly Membership";
  return "Donation";
}

export default function DonateClient({
  state,
  firstName,
  expected,
  paid,
  remaining,
  journeyId,
  memberId,
  history,
}: Props) {
  const params = useSearchParams();
  const paymentParam = params.get("payment");
  const supabase = createClient();

  const [showProcessing, setShowProcessing] = useState(
    paymentParam === "success",
  );
  const [showCancelled] = useState(paymentParam === "cancelled");

  // Pledge payment state
  const [pledgeMode, setPledgeMode] = useState<"full" | "custom">("full");
  const [customAmount, setCustomAmount] = useState("");
  const [pledgeLoading, setPledgeLoading] = useState(false);
  const [pledgeError, setPledgeError] = useState("");

  // Gift payment state
  const [selectedPreset, setSelectedPreset] = useState<number | "custom" | null>(null);
  const [giftCustom, setGiftCustom] = useState("");
  const [giftLoading, setGiftLoading] = useState(false);
  const [giftError, setGiftError] = useState("");

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initRemaining = useRef(remaining);

  // Poll member_financial_overview after Stripe success redirect.
  // When journey_remaining_amount_cents drops or financial_status === 'paid',
  // hard-reload so the server component re-computes the correct state.
  useEffect(() => {
    if (!showProcessing) return;
    let cancelled = false;
    let attempts = 0;
    const baseline = initRemaining.current;
    const MAX = 20;

    const tick = async () => {
      if (cancelled) return;
      attempts++;
      const { data } = await supabase
        .from("member_financial_overview")
        .select("journey_remaining_amount_cents, financial_status")
        .eq("member_id", memberId)
        .maybeSingle();
      if (cancelled) return;
      const cur = data?.journey_remaining_amount_cents ?? baseline;
      if (cur < baseline || data?.financial_status === "paid") {
        window.location.replace("/portal/donate");
        return;
      }
      if (attempts >= MAX) {
        setShowProcessing(false);
        return;
      }
      pollTimer.current = setTimeout(tick, 3000);
    };
    tick();
    return () => {
      cancelled = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showProcessing]);

  async function payPledge() {
    if (!journeyId) return;
    const customCents = customAmount
      ? Math.round(parseFloat(customAmount) * 100)
      : 0;
    const amountCents = pledgeMode === "full" ? remaining : customCents;
    setPledgeLoading(true);
    setPledgeError("");
    try {
      const res = await fetch("/api/payments/create-journey-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journey_id: journeyId, amount_cents: amountCents }),
      });
      const { url, error } = await res.json();
      if (error || !url) throw new Error(error ?? "no url");
      window.location.href = url;
    } catch (e) {
      console.error(e);
      setPledgeError("Something went wrong. Please try again.");
      setPledgeLoading(false);
    }
  }

  async function payGift() {
    const amount =
      selectedPreset === "custom"
        ? Math.round(parseFloat(giftCustom) * 100)
        : selectedPreset;
    if (!amount || !Number.isFinite(amount) || amount < 100 || amount > 2_500_000) {
      setGiftError("Please enter a valid amount ($1–$25,000).");
      return;
    }
    setGiftLoading(true);
    setGiftError("");
    try {
      const res = await fetch("/api/donations/create-gift-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_cents: amount }),
      });
      const { url, error } = await res.json();
      if (error || !url) throw new Error(error ?? "no url");
      window.location.href = url;
    } catch (e) {
      console.error(e);
      setGiftError("Something went wrong. Please try again.");
      setGiftLoading(false);
    }
  }

  const pct = expected > 0 ? Math.min((paid / expected) * 100, 100) : 0;
  const customCents = customAmount
    ? Math.round(parseFloat(customAmount) * 100)
    : 0;
  const customValid =
    pledgeMode === "custom" &&
    Number.isFinite(customCents) &&
    customCents >= 100 &&
    customCents <= remaining;

  const giftCustomCents = giftCustom
    ? Math.round(parseFloat(giftCustom) * 100)
    : 0;
  const giftAmount =
    selectedPreset === "custom" ? giftCustomCents : selectedPreset;
  const giftValid = Boolean(
    giftAmount &&
      Number.isFinite(giftAmount) &&
      giftAmount >= 100 &&
      giftAmount <= 2_500_000,
  );

  return (
    <div style={pageStyle}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {showProcessing && (
        <div style={processingBannerStyle}>
          <span style={spinnerStyle} />
          Processing your payment…
        </div>
      )}
      {showCancelled && !showProcessing && (
        <div style={cancelledBannerStyle}>
          Payment was cancelled. No charge was made.
        </div>
      )}

      <div style={containerStyle}>

        {/* ── Header ── */}
        {state === "no-commitment" && expected > 0 && (
          <header style={headerStyle}>
            <h1 style={h1Style}>Your Love Exchange.</h1>
            <p style={subtitleStyle}>
              Here is what remains for your upcoming journey. A secure payment
              link will appear here once your journey is scheduled.
            </p>
          </header>
        )}

        {state === "no-commitment" && expected === 0 && (
          <header style={headerStyle}>
            <h1 style={h1Style}>Thank you for your contribution.</h1>
            <p style={subtitleStyle}>
              Your contribution is always welcome and entirely optional.
            </p>
          </header>
        )}

        {state === "pay-toward-pledge" && (
          <header style={headerStyle}>
            <h1 style={h1Style}>Complete your Contribution.</h1>
          </header>
        )}

        {state === "complete" && (
          <header style={{ ...headerStyle, textAlign: "center" }}>
            <p style={eyebrowStyle}>✓&ensp;COMMITMENT FULFILLED</p>
            <h1 style={h1Style}>Mahalo, {firstName}.</h1>
          </header>
        )}

        {/* ── Stat cards ── */}
        {(state === "pay-toward-pledge" ||
          state === "complete" ||
          (state === "no-commitment" && expected > 0)) && (
          <div style={statGridStyle}>
            <StatCard label="Contribution" value={fmt(expected)} />
            <StatCard
              label="Remaining"
              value={fmt(remaining)}
              muted={state === "complete"}
            />
          </div>
        )}

        {/* ── Progress bar ── */}
        {(state === "pay-toward-pledge" ||
          state === "complete" ||
          (state === "no-commitment" && expected > 0)) && (
          <div style={trackStyle}>
            <div
              style={{
                ...fillStyle,
                width: state === "complete" ? "100%" : `${pct}%`,
              }}
            />
          </div>
        )}

        {/* ── Pay-toward-pledge card ── */}
        {state === "pay-toward-pledge" && (
          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>Make a payment</h2>

            <label style={radioRowStyle}>
              <input
                type="radio"
                checked={pledgeMode === "full"}
                onChange={() => setPledgeMode("full")}
                style={{ accentColor: "#B8683D", marginRight: 10 }}
              />
              Full remaining&ensp;—&ensp;<strong>{fmt(remaining)}</strong>
            </label>

            <label style={radioRowStyle}>
              <input
                type="radio"
                checked={pledgeMode === "custom"}
                onChange={() => setPledgeMode("custom")}
                style={{ accentColor: "#B8683D", marginRight: 10 }}
              />
              Custom amount
            </label>

            {pledgeMode === "custom" && (
              <div style={{ paddingLeft: 24, marginTop: 8 }}>
                <input
                  type="number"
                  min={1}
                  max={remaining / 100}
                  step="0.01"
                  placeholder="e.g. 500"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  style={inputStyle}
                />
                <p style={hintStyle}>
                  Min $1&ensp;·&ensp;Max {fmt(remaining)}
                </p>
              </div>
            )}

            {pledgeError && <p style={errorStyle}>{pledgeError}</p>}

            <button
              style={{
                ...primaryBtnStyle,
                opacity:
                  pledgeLoading || (pledgeMode === "custom" && !customValid)
                    ? 0.5
                    : 1,
                cursor:
                  pledgeLoading || (pledgeMode === "custom" && !customValid)
                    ? "default"
                    : "pointer",
              }}
              disabled={
                pledgeLoading || (pledgeMode === "custom" && !customValid)
              }
              onClick={payPledge}
            >
              {pledgeLoading
                ? "Opening Stripe…"
                : pledgeMode === "full"
                  ? `Pay ${fmt(remaining)}`
                  : customValid
                    ? `Pay ${fmt(customCents)}`
                    : "Pay"}
            </button>
            <VenmoLink />
          </div>
        )}

        {/* ── Additional gift card (no-commitment and complete) ── */}
        {(state === "no-commitment" || state === "complete") && (
          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>
              {state === "complete" ? "Give an additional gift" : "Make a gift"}
            </h2>
            <p style={cardSubtitleStyle}>
              {state === "complete"
                ? "Your commitment is fulfilled. Every additional contribution is deeply appreciated."
                : "A one-time gift in any amount — no commitment required."}
            </p>

            <div style={presetGridStyle}>
              {GIFT_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setSelectedPreset(p);
                    setGiftCustom("");
                  }}
                  style={{
                    ...presetTileStyle,
                    background:
                      selectedPreset === p
                        ? "#B8683D"
                        : "rgba(255,255,255,0.06)",
                    borderColor:
                      selectedPreset === p
                        ? "#B8683D"
                        : "rgba(232,221,200,0.15)",
                    color: selectedPreset === p ? "#fff" : "#E8DDC8",
                  }}
                >
                  {fmt(p)}
                </button>
              ))}
              <button
                onClick={() => setSelectedPreset("custom")}
                style={{
                  ...presetTileStyle,
                  background:
                    selectedPreset === "custom"
                      ? "#B8683D"
                      : "rgba(255,255,255,0.06)",
                  borderColor:
                    selectedPreset === "custom"
                      ? "#B8683D"
                      : "rgba(232,221,200,0.15)",
                  color: selectedPreset === "custom" ? "#fff" : "#E8DDC8",
                }}
              >
                Custom
              </button>
            </div>

            {selectedPreset === "custom" && (
              <div style={{ marginTop: 12 }}>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  step="0.01"
                  placeholder="Enter amount"
                  value={giftCustom}
                  onChange={(e) => setGiftCustom(e.target.value)}
                  style={inputStyle}
                />
                <p style={hintStyle}>Min $1&ensp;·&ensp;Max $25,000</p>
              </div>
            )}

            {giftError && <p style={errorStyle}>{giftError}</p>}

            <button
              style={{
                ...primaryBtnStyle,
                marginTop: 16,
                opacity: giftLoading || !giftValid ? 0.5 : 1,
                cursor: giftLoading || !giftValid ? "default" : "pointer",
              }}
              disabled={giftLoading || !giftValid}
              onClick={payGift}
            >
              {giftLoading
                ? "Opening Stripe…"
                : giftValid && giftAmount
                  ? `Give ${fmt(giftAmount)}`
                  : "Give"}
            </button>
            <VenmoLink />
          </div>
        )}

        {/* ── Giving history (complete only) ── */}
        {state === "complete" && history.length > 0 && (
          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>Giving history</h2>
            {history.map((row, i) => (
              <div
                key={row.id}
                style={{
                  ...historyRowStyle,
                  borderBottom:
                    i < history.length - 1
                      ? "1px solid rgba(232,221,200,0.08)"
                      : "none",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: 14, color: "#E8DDC8" }}>
                    {kindLabel(row.kind)}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: "rgba(232,221,200,0.45)",
                    }}
                  >
                    {fmtDate(row.completed_at)}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <strong style={{ fontSize: 14, color: "#E8DDC8" }}>
                    {fmt(row.amount_cents)}
                  </strong>
                  {row.receipt_url && (
                    <a
                      href={row.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={receiptLinkStyle}
                    >
                      Receipt
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VenmoLink() {
  return (
    <div style={venmoRowStyle}>
      <span style={venmoOrStyle}>or</span>
      <a
        href="https://venmo.com/u/Rachel-Nelson-05"
        target="_blank"
        rel="noopener noreferrer"
        style={venmoLinkStyle}
      >
        Send via Venmo &rarr; @Rachel-Nelson-05
      </a>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: string;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${muted ? "rgba(232,221,200,0.06)" : "rgba(232,221,200,0.1)"}`,
        borderRadius: 12,
        padding: "1rem 1.25rem",
        opacity: muted ? 0.45 : 1,
      }}
    >
      <p
        style={{
          margin: "0 0 4px",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "rgba(232,221,200,0.45)",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 22,
          fontFamily: "var(--font-display, serif)",
          color: accent ?? "#E8DDC8",
        }}
      >
        {value}
      </p>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  background: "#0F1A14",
  minHeight: "100vh",
  color: "#E8DDC8",
  fontFamily: "var(--font-body, sans-serif)",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 640,
  margin: "0 auto",
  padding: "3rem 1.25rem 5rem",
};

const headerStyle: React.CSSProperties = {
  marginBottom: "2.5rem",
};

const h1Style: React.CSSProperties = {
  fontFamily: "var(--font-display, serif)",
  fontSize: "clamp(2rem, 5vw, 2.75rem)",
  fontWeight: 400,
  letterSpacing: "-0.02em",
  color: "#E8DDC8",
  margin: "0 0 0.5rem",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 15,
  color: "rgba(232,221,200,0.6)",
  margin: 0,
  lineHeight: 1.6,
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.12em",
  color: "#68A870",
  margin: "0 0 0.75rem",
};

const statGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 10,
  marginBottom: "1.25rem",
};

const trackStyle: React.CSSProperties = {
  height: 6,
  background: "rgba(255,255,255,0.08)",
  borderRadius: 3,
  overflow: "hidden",
  marginBottom: "2rem",
};

const fillStyle: React.CSSProperties = {
  height: "100%",
  background: "#B8683D",
  borderRadius: 3,
  transition: "width 0.6s ease",
};

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(232,221,200,0.1)",
  borderRadius: 14,
  padding: "1.75rem",
  marginBottom: "1.5rem",
};

const cardTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-display, serif)",
  fontSize: 20,
  fontWeight: 400,
  color: "#E8DDC8",
  margin: "0 0 0.4rem",
};

const cardSubtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: "rgba(232,221,200,0.5)",
  margin: "0 0 1.25rem",
  lineHeight: 1.6,
};

const radioRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  fontSize: 14,
  color: "#E8DDC8",
  cursor: "pointer",
  padding: "10px 0",
  borderBottom: "1px solid rgba(232,221,200,0.07)",
};

const presetGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: 8,
  marginBottom: 4,
};

const presetTileStyle: React.CSSProperties = {
  padding: "10px 4px",
  fontSize: 13,
  fontWeight: 500,
  border: "1px solid rgba(232,221,200,0.15)",
  borderRadius: 8,
  cursor: "pointer",
  textAlign: "center" as const,
  transition: "background 0.15s, border-color 0.15s",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(232,221,200,0.2)",
  borderRadius: 8,
  color: "#E8DDC8",
  outline: "none",
  boxSizing: "border-box" as const,
};

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(232,221,200,0.35)",
  margin: "4px 0 0",
};

const primaryBtnStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "13px 18px",
  fontSize: 14,
  fontWeight: 500,
  background: "#B8683D",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  marginTop: 20,
  textAlign: "center" as const,
};

const errorStyle: React.CSSProperties = {
  background: "rgba(184,104,61,0.15)",
  color: "#F4A57A",
  padding: "10px 14px",
  borderRadius: 8,
  fontSize: 13,
  marginTop: "0.75rem",
};

const historyRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 0",
};

const receiptLinkStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#B8683D",
  textDecoration: "none",
  border: "1px solid rgba(184,104,61,0.4)",
  borderRadius: 5,
  padding: "2px 8px",
};

const processingBannerStyle: React.CSSProperties = {
  background: "#1A2E22",
  color: "#A5C8B0",
  padding: "12px 20px",
  textAlign: "center",
  fontSize: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const cancelledBannerStyle: React.CSSProperties = {
  background: "#2C1510",
  color: "#E8A88A",
  padding: "12px 20px",
  textAlign: "center",
  fontSize: 14,
};

const venmoRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  marginTop: 14,
};

const venmoOrStyle: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(232,221,200,0.4)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const venmoLinkStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#E8DDC8",
  textDecoration: "none",
  borderBottom: "1px solid rgba(232,221,200,0.3)",
  paddingBottom: 1,
};

const spinnerStyle: React.CSSProperties = {
  display: "inline-block",
  width: 14,
  height: 14,
  border: "2px solid rgba(165,200,176,0.25)",
  borderTopColor: "#A5C8B0",
  borderRadius: "50%",
  animation: "spin 0.9s linear infinite",
  flexShrink: 0,
};
