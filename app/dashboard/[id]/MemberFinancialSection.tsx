"use client";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type CommitmentData = {
  id: string;
  expected_amount_cents: number;
  status: string;
  journey_id: string | null;
  kind: string | null;
};

type PaymentToken = {
  token: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

type DonationRow = {
  id: string;
  amount_cents: number;
  completed_at: string | null;
  kind: string;
  metadata: Record<string, unknown> | null;
};

type Props = {
  commitment: CommitmentData | null | undefined;
  collectedCents: number;
  journeyTitle: string | null;
  journeyEndAt: string | null;
  tokens: PaymentToken[];
  tokenAmounts: Record<string, number>;
  donations: DonationRow[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtMonth(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function donationSource(d: DonationRow): string {
  if (d.kind === "initial_membership") return "via onboarding";
  if ((d.metadata as Record<string, unknown>)?.token_used) return "via Stripe link";
  if (d.kind === "journey_contribution") return "via portal";
  if (d.kind === "additional_gift") return "via gift";
  return "via portal";
}

function kindLabel(kind: string): string {
  if (kind === "initial_membership") return "Initial membership";
  if (kind === "journey_contribution") return "Journey contribution";
  if (kind === "additional_gift") return "Additional gift";
  if (kind === "monthly_membership") return "Monthly membership";
  return "Donation";
}

// ── Component ──────────────────────────────────────────────────────────────

export default function MemberFinancialSection({
  commitment,
  collectedCents,
  journeyTitle,
  journeyEndAt,
  tokens,
  tokenAmounts,
  donations,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const remainingCents = commitment
    ? Math.max(commitment.expected_amount_cents - collectedCents, 0)
    : 0;
  const pct =
    commitment && commitment.expected_amount_cents > 0
      ? Math.min(Math.round((collectedCents / commitment.expected_amount_cents) * 100), 100)
      : 0;

  // Adjust amount
  const [adjusting, setAdjusting] = useState(false);
  const [newAmount, setNewAmount] = useState(
    commitment ? (commitment.expected_amount_cents / 100).toString() : "",
  );
  const [adjustLoading, setAdjustLoading] = useState(false);

  // Record offline
  const [recording, setRecording] = useState(false);
  const [offlineAmount, setOfflineAmount] = useState("");
  const [offlineNotes, setOfflineNotes] = useState("");
  const [offlineLoading, setOfflineLoading] = useState(false);

  // Link generation
  const [linkLoading, setLinkLoading] = useState(false);

  // Revoke token
  const [revokingToken, setRevokingToken] = useState<string | null>(null);

  // Status message
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);

  function flash(text: string, err?: boolean) {
    setMsg({ text, err });
    setTimeout(() => setMsg(null), 5000);
  }

  async function handleGenerateLink() {
    if (!commitment) return;
    setLinkLoading(true);
    const res = await fetch("/api/payments/generate-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commitment_id: commitment.id }),
    });
    const { url, expires_at, error } = await res.json();
    setLinkLoading(false);
    if (error || !url) {
      flash(error ?? "Failed to generate link", true);
      return;
    }
    await navigator.clipboard.writeText(url);
    flash(`Link copied — expires ${fmtDate(expires_at)}`);
    startTransition(() => router.refresh());
  }

  async function handleAdjustAmount() {
    if (!commitment) return;
    const cents = Math.round(parseFloat(newAmount) * 100);
    if (!Number.isFinite(cents) || cents < 100) return;
    setAdjustLoading(true);
    const { error } = await supabase
      .from("financial_commitments")
      .update({ expected_amount_cents: cents })
      .eq("id", commitment.id);
    setAdjustLoading(false);
    if (!error) {
      setAdjusting(false);
      flash("Commitment amount updated");
      startTransition(() => router.refresh());
    } else {
      flash("Update failed", true);
    }
  }

  async function handleMarkFulfilled() {
    if (!commitment) return;
    if (!confirm("Mark this commitment as fulfilled?")) return;
    const { error } = await supabase
      .from("financial_commitments")
      .update({ status: "paid" })
      .eq("id", commitment.id);
    if (!error) {
      flash("Commitment marked as fulfilled");
      startTransition(() => router.refresh());
    } else {
      flash("Update failed", true);
    }
  }

  async function handleRecordOffline() {
    if (!commitment || !offlineAmount) return;
    const cents = Math.round(parseFloat(offlineAmount) * 100);
    if (!Number.isFinite(cents) || cents < 100) return;
    setOfflineLoading(true);
    const res = await fetch("/api/payments/record-offline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commitment_id: commitment.id,
        amount_cents: cents,
        notes: offlineNotes,
      }),
    });
    const { error } = await res.json();
    setOfflineLoading(false);
    if (error) {
      flash(error, true);
    } else {
      setRecording(false);
      setOfflineAmount("");
      setOfflineNotes("");
      flash("Offline payment recorded");
      startTransition(() => router.refresh());
    }
  }

  async function handleRevokeToken(token: string) {
    if (!confirm("Revoke this link? The member will no longer be able to use it.")) return;
    setRevokingToken(token);
    const res = await fetch("/api/payments/revoke-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const { error } = await res.json();
    setRevokingToken(null);
    if (!error) {
      flash("Token revoked");
      startTransition(() => router.refresh());
    } else {
      flash("Revoke failed", true);
    }
  }

  const canAct =
    commitment &&
    commitment.status !== "paid" &&
    commitment.status !== "waived";

  const statusLabel = commitment?.status.replace(/_/g, " ").toUpperCase();
  const statusBg =
    commitment?.status === "paid"
      ? "rgba(104,168,112,0.15)"
      : "rgba(165,200,176,0.1)";
  const statusColor =
    commitment?.status === "paid" ? "#68A870" : "#A5C8B0";

  if (!commitment && donations.length === 0 && tokens.length === 0) return null;

  return (
    <div
      style={{
        marginTop: "1.5rem",
        background: "#0F1A14",
        borderRadius: 16,
        padding: "1.75rem",
        fontFamily: "var(--font-body, sans-serif)",
        color: "#E8DDC8",
      }}
    >
      {/* Status message */}
      {msg && (
        <div
          style={{
            background: msg.err ? "rgba(163,45,45,0.2)" : "rgba(104,168,112,0.15)",
            color: msg.err ? "#E88A8A" : "#68A870",
            padding: "8px 14px",
            borderRadius: 8,
            fontSize: 13,
            marginBottom: "1.25rem",
          }}
        >
          {msg.text}
        </div>
      )}

      {/* ── Active Commitment ────────────────────────────────────────── */}
      {commitment && (
        <div style={{ marginBottom: "1.5rem" }}>
          <p style={SECTION_LABEL}>Active Commitment</p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 220px",
              gap: 14,
              alignItems: "start",
            }}
          >
            {/* Stats card */}
            <div style={INNER_CARD}>
              {/* Journey name + badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: "1.25rem",
                }}
              >
                <h2
                  style={{
                    fontFamily: "var(--font-display, serif)",
                    fontSize: 22,
                    fontWeight: 400,
                    color: "#E8DDC8",
                    margin: 0,
                    lineHeight: 1.25,
                  }}
                >
                  {journeyTitle ?? "Journey Commitment"}
                </h2>
                {statusLabel && (
                  <span
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 99,
                      background: statusBg,
                      color: statusColor,
                      border: `0.5px solid ${statusColor}`,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {statusLabel}
                  </span>
                )}
              </div>

              {/* Three stat columns */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 16,
                  marginBottom: "1rem",
                }}
              >
                {/* Pledged */}
                <div>
                  <p style={STAT_LABEL}>Pledged</p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={STAT_VALUE}>{fmt(commitment.expected_amount_cents)}</span>
                    {!adjusting && (
                      <button
                        onClick={() => {
                          setAdjusting(true);
                          setNewAmount((commitment.expected_amount_cents / 100).toString());
                        }}
                        style={LINK_BTN}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {adjusting && (
                    <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <input
                        type="number"
                        min={1}
                        step="0.01"
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                        style={{ ...DARK_INPUT, width: 100 }}
                        placeholder="0"
                      />
                      <button
                        onClick={handleAdjustAmount}
                        disabled={adjustLoading}
                        style={SMALL_BTN}
                      >
                        {adjustLoading ? "…" : "Save"}
                      </button>
                      <button
                        onClick={() => setAdjusting(false)}
                        style={{ ...SMALL_BTN, background: "rgba(255,255,255,0.08)" }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {/* Collected */}
                <div>
                  <p style={STAT_LABEL}>Collected</p>
                  <span style={STAT_VALUE}>{fmt(collectedCents)}</span>
                </div>

                {/* Remaining */}
                <div>
                  <p style={STAT_LABEL}>Remaining</p>
                  <span
                    style={{
                      ...STAT_VALUE,
                      color: remainingCents > 0 ? "#B8683D" : "#68A870",
                    }}
                  >
                    {fmt(remainingCents)}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  height: 6,
                  background: "rgba(255,255,255,0.08)",
                  borderRadius: 3,
                  overflow: "hidden",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: "#68A870",
                    borderRadius: 3,
                    transition: "width 0.6s ease",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "rgba(232,221,200,0.45)",
                }}
              >
                <span>{pct}% collected</span>
                {journeyEndAt && (
                  <span>Expected close: {fmtMonth(journeyEndAt)}</span>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <p style={SECTION_LABEL}>Quick Actions</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Send payment link */}
                <button
                  onClick={handleGenerateLink}
                  disabled={!canAct || linkLoading}
                  style={{ ...ACTION_CARD, opacity: !canAct ? 0.4 : 1 }}
                >
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#E8DDC8" }}>
                      {linkLoading ? "Generating…" : "Send payment link"}
                    </p>
                    <p
                      style={{
                        margin: "3px 0 0",
                        fontSize: 11,
                        color: "rgba(232,221,200,0.45)",
                        lineHeight: 1.4,
                      }}
                    >
                      Copies a single-use {fmt(remainingCents)} link
                    </p>
                  </div>
                  <span style={{ color: "#B8683D", fontSize: 16, flexShrink: 0 }}>→</span>
                </button>

                {/* Record offline payment */}
                <button
                  onClick={() => setRecording(!recording)}
                  disabled={!canAct}
                  style={{ ...ACTION_CARD, opacity: !canAct ? 0.4 : 1 }}
                >
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#E8DDC8" }}>
                      Record offline payment
                    </p>
                  </div>
                  <span style={{ color: "rgba(232,221,200,0.45)", fontSize: 16, flexShrink: 0 }}>→</span>
                </button>

                {/* Adjust commitment amount */}
                <button
                  onClick={() => setAdjusting(!adjusting)}
                  style={ACTION_CARD}
                >
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#E8DDC8" }}>
                      Adjust commitment amount
                    </p>
                  </div>
                  <span style={{ color: "rgba(232,221,200,0.45)", fontSize: 16, flexShrink: 0 }}>→</span>
                </button>

                {/* Mark commitment fulfilled */}
                <button
                  onClick={handleMarkFulfilled}
                  disabled={!canAct}
                  style={{ ...ACTION_CARD, opacity: !canAct ? 0.4 : 1 }}
                >
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#E8DDC8" }}>
                      Mark commitment fulfilled
                    </p>
                  </div>
                  <span style={{ color: "rgba(232,221,200,0.45)", fontSize: 16, flexShrink: 0 }}>→</span>
                </button>
              </div>
            </div>
          </div>

          {/* Offline recording inline form */}
          {recording && (
            <div style={{ ...INNER_CARD, marginTop: 12 }}>
              <p style={{ ...SECTION_LABEL, marginBottom: 12 }}>Record offline payment</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div>
                  <label style={FIELD_LABEL}>Amount ($)</label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    placeholder="0.00"
                    value={offlineAmount}
                    onChange={(e) => setOfflineAmount(e.target.value)}
                    style={{ ...DARK_INPUT, width: 120 }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={FIELD_LABEL}>Notes (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. cash, check #1234"
                    value={offlineNotes}
                    onChange={(e) => setOfflineNotes(e.target.value)}
                    style={{ ...DARK_INPUT, width: "100%" }}
                  />
                </div>
                <button
                  onClick={handleRecordOffline}
                  disabled={offlineLoading || !offlineAmount}
                  style={{ ...SMALL_BTN, padding: "9px 18px" }}
                >
                  {offlineLoading ? "Saving…" : "Record"}
                </button>
                <button
                  onClick={() => setRecording(false)}
                  style={{ ...SMALL_BTN, background: "rgba(255,255,255,0.08)", padding: "9px 14px" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Payment Tokens ───────────────────────────────────────────── */}
      {tokens.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.75rem",
            }}
          >
            <p style={{ ...SECTION_LABEL, margin: 0 }}>Active Payment Tokens</p>
            {commitment && canAct && (
              <button
                onClick={handleGenerateLink}
                disabled={linkLoading}
                style={{
                  fontSize: 12,
                  color: "#B8683D",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {linkLoading ? "Generating…" : "Generate new link"}
              </button>
            )}
          </div>
          <div style={{ ...INNER_CARD, padding: 0 }}>
            {tokens.map((tok, i) => {
              const isConsumed = !!tok.consumed_at;
              const days = !isConsumed ? daysUntil(tok.expires_at) : null;
              const isExpired = days !== null && days <= 0;
              const amount = isConsumed
                ? tokenAmounts[tok.token]
                : remainingCents > 0
                  ? remainingCents
                  : null;
              return (
                <div
                  key={tok.token}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "170px 100px 160px 90px 60px",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    borderBottom:
                      i < tokens.length - 1
                        ? "0.5px solid rgba(232,221,200,0.08)"
                        : "none",
                    opacity: isConsumed || isExpired ? 0.45 : 1,
                  }}
                >
                  <code
                    style={{
                      fontSize: 12,
                      color: "#E8DDC8",
                      textDecoration: isConsumed ? "line-through" : "none",
                      fontFamily: "monospace",
                    }}
                  >
                    {tok.token.slice(0, 14)}…
                  </code>
                  <span style={{ fontSize: 12, color: "rgba(232,221,200,0.5)" }}>
                    {fmtDate(tok.created_at)}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: isConsumed
                        ? "rgba(232,221,200,0.5)"
                        : isExpired
                          ? "#E88A8A"
                          : days !== null && days <= 4
                            ? "#B8683D"
                            : "#E8DDC8",
                    }}
                  >
                    {isConsumed
                      ? "Consumed"
                      : isExpired
                        ? "Expired"
                        : `Expires in ${days} day${days === 1 ? "" : "s"}`}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#E8DDC8",
                    }}
                  >
                    {amount != null ? fmt(amount) : "—"}
                  </span>
                  <span>
                    {!isConsumed && !isExpired && (
                      <button
                        onClick={() => handleRevokeToken(tok.token)}
                        disabled={revokingToken === tok.token}
                        style={LINK_BTN}
                      >
                        {revokingToken === tok.token ? "…" : "Revoke"}
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Payment History ──────────────────────────────────────────── */}
      {donations.length > 0 && (
        <div>
          <p style={SECTION_LABEL}>Payment History</p>
          <div style={INNER_CARD}>
            {donations.map((d, i) => (
              <div
                key={d.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "130px 1fr 140px auto",
                  alignItems: "center",
                  gap: 16,
                  padding: "12px 0",
                  borderBottom:
                    i < donations.length - 1
                      ? "0.5px solid rgba(232,221,200,0.08)"
                      : "none",
                }}
              >
                <span
                  style={{ fontSize: 14, fontWeight: 600, color: "#E8DDC8" }}
                >
                  {fmtDate(d.completed_at)}
                </span>
                <span style={{ fontSize: 14, color: "#E8DDC8" }}>
                  {kindLabel(d.kind)}
                </span>
                <code
                  style={{
                    fontSize: 12,
                    color: "rgba(232,221,200,0.5)",
                    fontFamily: "monospace",
                  }}
                >
                  {donationSource(d)}
                </code>
                <span
                  style={{ fontSize: 14, fontWeight: 600, color: "#E8DDC8", textAlign: "right" }}
                >
                  {fmt(d.amount_cents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(232,221,200,0.45)",
  fontWeight: 500,
  margin: "0 0 0.75rem",
};

const INNER_CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "0.5px solid rgba(232,221,200,0.1)",
  borderRadius: 12,
  padding: "1.25rem",
};

const STAT_LABEL: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(232,221,200,0.45)",
  margin: "0 0 4px",
};

const STAT_VALUE: React.CSSProperties = {
  fontFamily: "var(--font-display, serif)",
  fontSize: 26,
  color: "#E8DDC8",
  display: "inline",
};

const ACTION_CARD: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: "rgba(255,255,255,0.04)",
  border: "0.5px solid rgba(232,221,200,0.08)",
  borderRadius: 10,
  padding: "12px 14px",
  cursor: "pointer",
  width: "100%",
  fontFamily: "inherit",
};

const DARK_INPUT: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "0.5px solid rgba(232,221,200,0.2)",
  borderRadius: 7,
  padding: "7px 10px",
  fontSize: 13,
  color: "#E8DDC8",
  fontFamily: "inherit",
  outline: "none",
};

const SMALL_BTN: React.CSSProperties = {
  background: "#B8683D",
  color: "#fff",
  border: "none",
  borderRadius: 7,
  padding: "7px 12px",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

const LINK_BTN: React.CSSProperties = {
  fontSize: 11,
  color: "#B8683D",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  textDecoration: "underline",
  padding: 0,
};

const FIELD_LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(232,221,200,0.45)",
  marginBottom: 4,
};
