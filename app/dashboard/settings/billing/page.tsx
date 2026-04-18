"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function BillingSettings() {
  const supabase = createClient();
  const [dollars, setDollars] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("billing_config")
      .select("value_json")
      .eq("key", "membership_donation")
      .single()
      .then(({ data }) => {
        const amt = data?.value_json?.amount_cents ?? 0;
        setDollars((amt / 100).toFixed(2));
      });
  }, [supabase]);

  async function save() {
    setSaving(true);
    setMessage(null);
    const cents = Math.round(parseFloat(dollars) * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      setMessage("Enter a valid amount.");
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("billing_config")
      .update({
        value_json: {
          amount_cents: cents,
          currency: "usd",
          label: "Membership Donation",
        },
        updated_at: new Date().toISOString(),
      })
      .eq("key", "membership_donation");
    setSaving(false);
    setMessage(error ? `Error: ${error.message}` : "Saved.");
  }

  return (
    <div
      style={{
        maxWidth: 520,
        padding: "2rem",
        fontFamily: "var(--font-body, sans-serif)",
      }}
    >
      <p
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: "#9E9E9A",
          marginBottom: 3,
        }}
      >
        Billing settings
      </p>
      <h1
        style={{
          fontFamily: "var(--font-display, serif)",
          fontSize: 26,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          color: "#1A1A18",
          marginBottom: "1.5rem",
        }}
      >
        Membership Donation Amount
      </h1>

      <label
        style={{
          display: "block",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#6B6B67",
          marginBottom: 6,
          fontWeight: 500,
        }}
      >
        Amount (USD)
      </label>
      <input
        value={dollars}
        onChange={(e) => setDollars(e.target.value)}
        inputMode="decimal"
        style={{
          width: "100%",
          padding: "10px 12px",
          fontSize: 15,
          border: "0.5px solid rgba(0,0,0,0.2)",
          borderRadius: 8,
          marginBottom: "1rem",
          background: "#fff",
        }}
      />
      <button
        onClick={save}
        disabled={saving}
        style={{
          padding: "10px 18px",
          fontSize: 13,
          fontWeight: 500,
          background: "#085041",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: saving ? "progress" : "pointer",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "Saving…" : "Save"}
      </button>
      {message && (
        <p style={{ fontSize: 12, color: "#6B6B67", marginTop: "0.75rem" }}>
          {message}
        </p>
      )}
      <p
        style={{
          fontSize: 12,
          color: "#9E9E9A",
          marginTop: "1.5rem",
          lineHeight: 1.5,
        }}
      >
        Changes apply to all new checkout sessions immediately. No deploy
        required.
      </p>
    </div>
  );
}
