"use client";

/**
 * PR 10C: the contribution chooser.
 *
 * This component NEVER does fee arithmetic. Every number it displays —
 * Contribution, Card processing fee, Total charged — comes from the server
 * (GET quote, then the authoritative POST response). It submits only the
 * contribution amount and an opaque request id.
 */

import { useEffect, useRef, useState } from "react";

const FOREST = "#1E3A2C";
const MUTED = "#8A8A84";
const SAGE_BORDER = "#8fb29b";

type Quote = {
  contributionCents: number;
  processingFeeCents: number;
  totalCents: number;
  feePolicyVersion: string;
};

function usd(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function SupportCheckout({
  minCents,
  maxCents,
  presets,
  interactive,
}: {
  minCents: number;
  maxCents: number;
  presets: number[];
  interactive: boolean;
}) {
  const [amountCents, setAmountCents] = useState<number | null>(presets[0] ?? null);
  const [customDollars, setCustomDollars] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);

  // A request id is minted per contribution intent; changing the amount is a
  // new intent so the server's replay binding can hold.
  useEffect(() => {
    requestIdRef.current = crypto.randomUUID();
    setSubmitError(null);
  }, [amountCents]);

  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    if (amountCents === null) return;
    if (amountCents < minCents || amountCents > maxCents) {
      setQuoteError(`Contributions can be between ${usd(minCents)} and ${usd(maxCents)}.`);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/support/checkout?amount=${amountCents}`, { signal: controller.signal });
        const body = await res.json();
        if (res.ok && body.quote) setQuote(body.quote as Quote);
        else if (body.error === "invalid_amount") {
          setQuoteError(`Contributions can be between ${usd(minCents)} and ${usd(maxCents)}.`);
        } else {
          setQuoteError("Online contributions are not open right now.");
        }
      } catch {
        /* aborted or offline; leave the quote empty */
      }
    }, 250);
    return () => { controller.abort(); clearTimeout(t); };
  }, [amountCents, minCents, maxCents]);

  function chooseCustom(value: string) {
    setCustomDollars(value);
    const dollars = Number(value);
    if (!value || !Number.isFinite(dollars)) { setAmountCents(null); return; }
    setAmountCents(Math.round(dollars * 100));
  }

  async function begin() {
    if (!interactive || submitting || !quote || amountCents === null) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/support/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contributionCents: amountCents, requestId: requestIdRef.current }),
      });
      const body = await res.json();
      if (res.ok && body.ok && body.url) {
        // The authoritative numbers are the POST's; if they moved since the
        // preview quote, show them and ask for one more click.
        const q = body.quote as Quote;
        if (q.totalCents !== quote.totalCents) {
          setQuote(q);
          setSubmitError("The figures were refreshed — please review and continue again.");
          requestIdRef.current = crypto.randomUUID();
          return;
        }
        window.location.assign(body.url as string);
        return;
      }
      if (body.error === "request_conflict" || body.error === "stale_attempt") {
        requestIdRef.current = crypto.randomUUID();
        setSubmitError("Please try again — your secure checkout was refreshed.");
      } else if (body.error === "invalid_amount") {
        setSubmitError(`Contributions can be between ${usd(minCents)} and ${usd(maxCents)}.`);
      } else if (body.error === "unavailable") {
        setSubmitError("Online contributions are not open right now.");
      } else {
        setSubmitError("Secure checkout is temporarily unavailable. Nothing has been charged.");
      }
    } catch {
      setSubmitError("Secure checkout is temporarily unavailable. Nothing has been charged.");
    } finally {
      setSubmitting(false);
    }
  }

  const presetStyle = (active: boolean): React.CSSProperties => ({
    flex: "1 1 100px",
    minWidth: 100,
    padding: "13px 10px",
    borderRadius: 10,
    border: active ? `2px solid ${FOREST}` : "1px solid #d8d6cd",
    background: active ? "#f0f5f0" : "#fff",
    color: FOREST,
    fontSize: 17,
    fontFamily: "var(--font-display, serif)",
    cursor: interactive ? "pointer" : "default",
  });

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => { setCustomDollars(""); setAmountCents(p); }}
            style={presetStyle(amountCents === p && customDollars === "")}
          >
            {usd(p).replace(/\.00$/, "")}
          </button>
        ))}
      </div>
      <label style={{ display: "block", marginBottom: 18 }}>
        <span style={{ display: "block", color: MUTED, fontSize: 12, marginBottom: 6 }}>Or enter another amount (USD)</span>
        <input
          type="number"
          inputMode="decimal"
          min={minCents / 100}
          max={maxCents / 100}
          step="1"
          value={customDollars}
          onChange={(e) => chooseCustom(e.target.value)}
          placeholder="Amount"
          style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 10, border: "1px solid #d8d6cd", fontSize: 16, background: "#fff" }}
        />
      </label>

      <div style={{ border: `1px solid ${SAGE_BORDER}`, background: "#f7fbf7", borderRadius: 12, padding: "16px 20px", marginBottom: 8 }}>
        {quote ? (
          <>
            <Row label="Contribution" value={usd(quote.contributionCents)} />
            <Row label="Card processing fee" value={usd(quote.processingFeeCents)} />
            <div style={{ borderTop: "1px solid #d5e3d5", margin: "10px 0" }} />
            <Row label="Total charged" value={usd(quote.totalCents)} strong />
          </>
        ) : (
          <p style={{ margin: 0, color: MUTED, fontSize: 14 }}>
            {quoteError ?? "Choose an amount to see your total."}
          </p>
        )}
      </div>
      <p style={{ color: MUTED, fontSize: 12, margin: "0 0 18px", lineHeight: 1.5 }}>
        This fee helps ensure your full intended contribution reaches Vital Kauaʻi.
      </p>

      <button
        type="button"
        onClick={begin}
        disabled={!interactive || !quote || submitting}
        style={{
          width: "100%",
          padding: "15px 18px",
          borderRadius: 12,
          border: "none",
          background: !interactive || !quote || submitting ? "#9aa89f" : FOREST,
          color: "#f5f0e8",
          fontSize: 16,
          letterSpacing: "0.04em",
          cursor: !interactive || !quote || submitting ? "default" : "pointer",
        }}
      >
        {submitting ? "Opening secure payment…" : quote ? `Continue to secure payment — ${usd(quote.totalCents)}` : "Continue to secure payment"}
      </button>
      {submitError ? (
        <p style={{ color: "#8a4b2f", fontSize: 13, margin: "10px 0 0" }}>{submitError}</p>
      ) : null}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "4px 0" }}>
      <span style={{ color: strong ? FOREST : "#46564e", fontSize: strong ? 15 : 14, fontWeight: strong ? 700 : 400 }}>{label}</span>
      <span style={{ color: FOREST, fontVariantNumeric: "tabular-nums", fontFamily: strong ? "var(--font-display, serif)" : undefined, fontSize: strong ? 22 : 15 }}>
        {value}
      </span>
    </div>
  );
}
