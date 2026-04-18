"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export default function JourneyPaymentCard({
  journeyId,
  expected,
  paid,
  remaining,
  status,
}: {
  journeyId: string;
  expected: number;
  paid: number;
  remaining: number;
  status: string;
}) {
  const supabase = createClient();
  const params = useSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [partial, setPartial] = useState("");
  const [processing, setProcessing] = useState(
    params.get("payment") === "success",
  );
  const [failed, setFailed] = useState(params.get("payment") === "cancelled");

  // Poll until paid_cents reflects the new payment or status flips to 'paid'
  useEffect(() => {
    if (!processing) return;
    let cancelled = false;
    let attempts = 0;
    const startingPaid = paid;
    const MAX = 20; // ~60s at 3s interval

    const tick = async () => {
      attempts++;
      const { data } = await supabase
        .from("journey_financial_summary")
        .select("collected_amount_cents, payment_status")
        .eq("journey_id", journeyId)
        .single();
      if (cancelled) return;
      if (
        (data?.collected_amount_cents ?? 0) > startingPaid ||
        data?.payment_status === "paid"
      ) {
        router.replace("/portal/journey/payment?payment=confirmed");
        return;
      }
      if (attempts >= MAX) {
        setProcessing(false);
        setFailed(true);
        return;
      }
      setTimeout(tick, 3000);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [processing, paid, journeyId, router, supabase]);

  async function pay(amountCents?: number) {
    setLoading(true);
    setFailed(false);
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
      setLoading(false);
      setFailed(true);
    }
  }

  if (processing) {
    return (
      <div style={cardStyle}>
        <h2 style={h2Style}>Confirming payment…</h2>
        <p style={subtitleStyle}>
          We&apos;re waiting on Stripe to confirm. This usually takes a few
          seconds.
        </p>
        <div style={spinnerStyle} />
      </div>
    );
  }

  if (status === "paid") {
    return (
      <div style={cardStyle}>
        <h2 style={h2Style}>Journey Contribution</h2>
        <p style={subtitleStyle}>Paid in full — {fmt(paid)}</p>
      </div>
    );
  }

  const partialCents = partial
    ? Math.round(parseFloat(partial) * 100)
    : 0;

  return (
    <div style={cardStyle}>
      <h2 style={h2Style}>Journey Contribution</h2>

      <div style={rowStyle}>
        <span>Expected</span>
        <strong>{fmt(expected)}</strong>
      </div>
      <div style={rowStyle}>
        <span>Paid so far</span>
        <strong>{fmt(paid)}</strong>
      </div>
      <div style={{ ...rowStyle, color: "#633806", fontWeight: 600 }}>
        <span>Remaining</span>
        <strong>{fmt(remaining)}</strong>
      </div>

      {failed && (
        <p style={errorStyle}>
          Payment did not complete. You can try again below.
        </p>
      )}

      <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: 10 }}>
        <button style={btnStyle} disabled={loading} onClick={() => pay()}>
          {loading
            ? "Opening Stripe…"
            : failed
              ? `🔁 Retry Full Remaining — ${fmt(remaining)}`
              : `💳 Pay Full Remaining — ${fmt(remaining)}`}
        </button>

        <div style={{ borderTop: "0.5px solid rgba(0,0,0,0.08)", paddingTop: 12 }}>
          <label style={labelStyle}>
            Or pay a custom amount (USD)
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <input
              value={partial}
              onChange={(e) => setPartial(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 500"
              style={inputStyle}
            />
            <button
              style={{ ...btnStyle, width: "auto", padding: "10px 16px" }}
              disabled={loading || !partial || !Number.isFinite(partialCents) || partialCents < 100}
              onClick={() => pay(partialCents)}
            >
              Pay {partial && Number.isFinite(partialCents) ? fmt(partialCents) : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  maxWidth: 560,
  margin: "2rem auto",
  padding: "2rem",
  background: "#faf9f5",
  border: "0.5px solid rgba(0,0,0,0.1)",
  borderRadius: 14,
  fontFamily: "var(--font-body, sans-serif)",
};

const h2Style: React.CSSProperties = {
  fontFamily: "var(--font-display, serif)",
  fontSize: 22,
  fontWeight: 400,
  letterSpacing: "-0.02em",
  margin: "0 0 1.25rem",
  color: "#1A1A18",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#6B6B67",
  margin: "0 0 1rem",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 14,
  padding: "8px 0",
  borderBottom: "0.5px solid rgba(0,0,0,0.06)",
  color: "#1A1A18",
};

const btnStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 18px",
  fontSize: 14,
  fontWeight: 500,
  background: "#085041",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  background: "#fef1ea",
  color: "#9a3412",
  padding: "10px 14px",
  borderRadius: 8,
  fontSize: 13,
  marginTop: "1rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "#6B6B67",
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  fontSize: 14,
  border: "0.5px solid rgba(0,0,0,0.2)",
  borderRadius: 8,
  background: "#fff",
};

const spinnerStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: "3px solid rgba(8,80,65,0.15)",
  borderTopColor: "#085041",
  borderRadius: "50%",
  animation: "spin 0.9s linear infinite",
  margin: "1rem auto 0",
};
