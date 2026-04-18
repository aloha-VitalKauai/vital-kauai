"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DonationCard({
  amountLabel,
  label,
}: {
  amountLabel: string;
  label: string;
}) {
  const supabase = createClient();
  const params = useSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(
    params.get("donation") === "success",
  );
  const [failed, setFailed] = useState(params.get("donation") === "cancelled");

  // Poll for confirmation after Stripe redirect
  useEffect(() => {
    if (!processing) return;
    let cancelled = false;
    let attempts = 0;
    const MAX = 20; // ~60s at 3s interval

    const tick = async () => {
      attempts++;
      const { data } = await supabase
        .from("member_profiles")
        .select("membership_donation_completed")
        .single();
      if (cancelled) return;
      if (data?.membership_donation_completed) {
        router.replace("/portal");
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
  }, [processing, router, supabase]);

  async function handlePay() {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch("/api/donations/create-session", {
        method: "POST",
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
      <div className="donation-card">
        <div className="donation-hero">
          <p className="eyebrow">PROCESSING</p>
          <h1 className="amount">Confirming payment…</h1>
          <p className="subtitle">
            We&apos;re waiting on Stripe to confirm. This usually takes a few
            seconds.
          </p>
          <div className="spinner" />
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="donation-card">
      <div className="donation-hero">
        <p className="eyebrow">REQUIRED</p>
        <h1 className="amount">{amountLabel}</h1>
        <p className="subtitle">
          Refundable membership donation · Applied toward first month
        </p>
      </div>

      <div className="benefit-grid">
        <Benefit
          icon="🔒"
          title="Fully Refundable"
          body="Applied to month one or returned upon cancellation"
        />
        <Benefit
          icon="✨"
          title="Immediate Activation"
          body="Portal unlocks the moment payment is confirmed"
        />
        <Benefit
          icon="📅"
          title="Flexible Billing"
          body="Month-to-month or annual options available"
        />
        <Benefit
          icon="🌿"
          title="Member Benefits Begin"
          body="Full access to all programs from day one"
        />
      </div>

      {failed && (
        <p className="donation-error">
          Payment did not complete. You can try again below.
        </p>
      )}

      <button className="btn-stripe" onClick={handlePay} disabled={loading}>
        {loading
          ? "Opening Stripe…"
          : failed
            ? `🔁 Retry Payment — ${amountLabel}`
            : `💳 Continue to Payment — ${amountLabel}`}
      </button>
      <p className="label-note">{label}</p>
      <style jsx>{styles}</style>
    </div>
  );
}

function Benefit({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="benefit-tile">
      <div className="benefit-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
      <style jsx>{`
        .benefit-tile {
          background: #fff;
          border: 0.5px solid rgba(0, 0, 0, 0.1);
          border-radius: 10px;
          padding: 1rem 1.1rem;
        }
        .benefit-icon {
          font-size: 22px;
          margin-bottom: 0.5rem;
        }
        h3 {
          font-size: 13px;
          font-weight: 500;
          margin: 0 0 4px;
          color: #1a1a18;
        }
        p {
          font-size: 12px;
          color: #6b6b67;
          margin: 0;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}

const styles = `
  .donation-card {
    max-width: 720px;
    margin: 2rem auto;
    padding: 2rem;
    background: #faf9f5;
    border: 0.5px solid rgba(0,0,0,0.1);
    border-radius: 14px;
    font-family: var(--font-body, sans-serif);
  }
  .donation-hero { text-align: center; margin-bottom: 1.75rem; }
  .eyebrow {
    font-size: 11px; letter-spacing: 0.12em;
    color: #633806; font-weight: 500; margin: 0 0 0.5rem;
  }
  .amount {
    font-family: var(--font-display, serif);
    font-size: 46px; font-weight: 400; letter-spacing: -0.02em;
    color: #1a1a18; margin: 0 0 0.5rem;
  }
  .subtitle { font-size: 13px; color: #6b6b67; margin: 0; }
  .benefit-grid {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;
    margin-bottom: 1.5rem;
  }
  .btn-stripe {
    width: 100%;
    padding: 14px 20px;
    font-size: 15px; font-weight: 500;
    background: #085041; color: #fff; border: none; border-radius: 10px;
    cursor: pointer; transition: background 0.15s ease;
  }
  .btn-stripe:hover:not(:disabled) { background: #0a6652; }
  .btn-stripe:disabled { opacity: 0.6; cursor: progress; }
  .donation-error {
    background: #fef1ea; color: #9a3412; padding: 10px 14px;
    border-radius: 8px; font-size: 13px; margin-bottom: 1rem;
  }
  .label-note {
    text-align: center; font-size: 11px; color: #9e9e9a;
    margin-top: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em;
  }
  .spinner {
    width: 28px; height: 28px; border: 3px solid rgba(8,80,65,0.15);
    border-top-color: #085041; border-radius: 50%;
    animation: spin 0.9s linear infinite; margin: 1rem auto 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
