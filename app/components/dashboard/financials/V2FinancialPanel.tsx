"use client";

/**
 * Financials V2 — PR 5: the reusable founder financial panel.
 *
 * Canonical terms throughout: Contribution, Received, Remaining, Payment state.
 * Figures come only from finance_api.agreement_balances — nothing is calculated
 * client-side, because a browser-computed balance is an invitation for the
 * screen to disagree with the ledger.
 *
 * Every mutation calls /api/finance/agreements, which runs on the founder's own
 * session; identity and timestamps are derived inside Postgres. The external
 * payment form generates its idempotency key ONCE when the drawer opens
 * (D-083), so a double-click or retry re-submits the SAME submission and the
 * database returns the existing entry instead of duplicating money.
 *
 * Design: ivory panel, forest serif headings, sage states, one restrained
 * copper action per state, confirmation preview before anything writes.
 * Deliberately prop-driven and route-relative so PR 7 can mount it unchanged.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// ── Palette (Vital Kauaʻi) ───────────────────────────────────────────────────
const IVORY = "#FBFAF6";
const FOREST = "#1E3A2C";
const INK = "#1A1A18";
const MUTED = "#8A8A84";
const LINE = "rgba(0,0,0,0.1)";
const COPPER = "#B8683D";
const SAGE = "#68A870";
const SAGE_SOFT = "#A5C8B0";
const DANGER = "#A32D2D";

type Balance = {
  agreement_id: string;
  member_id: string;
  journey_id: string | null;
  purpose: string;
  contribution_cents: number;
  net_received_cents: number;
  refunded_cents: number;
  reversed_cents: number;
  remaining_cents: number;
  payment_state: string;
  lifecycle_status: string;
};
type AmountRow = {
  id: string; agreement_id: string; amount_cents: number;
  effective_at: string; reason: string; created_at: string;
};
type LifecycleRow = {
  id: string; agreement_id: string; from_status: string | null;
  to_status: string; reason: string; occurred_at: string;
};
type LedgerRow = {
  id: string; agreement_id: string; entry_type: string; amount_cents: number;
  source: string; external_method: string | null; occurred_at: string;
  reason: string | null; parent_entry_id: string | null; livemode: boolean;
};
type Journey = { id: string; booking_type: string | null; status: string | null; start_at: string | null };

type Data = {
  agreements: Balance[];
  amounts: AmountRow[];
  lifecycle: LifecycleRow[];
  ledger: LedgerRow[];
  journeys: Journey[];
};

type DrawerState =
  | { kind: "create" }
  | { kind: "collect"; agreement: Balance }
  | { kind: "amend"; agreement: Balance }
  | { kind: "payment"; agreement: Balance; idempotencyKey: string }
  | { kind: "reverse"; agreement: Balance; entry: LedgerRow }
  | { kind: "transition"; agreement: Balance; toStatus: string; label: string }
  | null;

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const PAYMENT_STATE_LABEL: Record<string, { label: string; tone: string }> = {
  unpaid: { label: "Unpaid", tone: MUTED },
  partial: { label: "Partially received", tone: COPPER },
  paid: { label: "Received in full", tone: SAGE },
  overpaid: { label: "Overpaid", tone: DANGER },
  refunded: { label: "Refunded", tone: DANGER },
  not_applicable: { label: "No Contribution set", tone: MUTED },
};

const LIFECYCLE_LABEL: Record<string, string> = {
  draft: "Draft", active: "Active", fulfilled: "Fulfilled",
  canceled: "Canceled", waived: "Waived",
};

/** Legal next transitions, mirroring tg_lifecycle_transition exactly. */
const TRANSITIONS: Record<string, { to: string; label: string }[]> = {
  draft: [
    { to: "active", label: "Activate agreement" },
    { to: "canceled", label: "Cancel" },
    { to: "waived", label: "Waive" },
  ],
  active: [
    { to: "fulfilled", label: "Mark fulfilled" },
    { to: "canceled", label: "Cancel" },
    { to: "waived", label: "Waive" },
  ],
  fulfilled: [{ to: "active", label: "Reopen" }],
  canceled: [],
  waived: [],
};

export default function V2FinancialPanel({
  memberId,
  memberName,
}: {
  memberId: string;
  memberName: string | null;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [flash, setFlash] = useState<{ text: string; err?: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/finance/agreements?memberId=${encodeURIComponent(memberId)}`);
      const json = await res.json();
      if (!res.ok) {
        setLoadError(json.error ?? "load failed");
        return;
      }
      setData(json as Data);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, [memberId]);

  useEffect(() => {
    void load();
  }, [load]);

  function showFlash(text: string, err?: boolean) {
    setFlash({ text, err });
    setTimeout(() => setFlash(null), 6000);
  }

  const agreements = data?.agreements ?? [];

  return (
    <div style={PANEL}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <p style={SECTION_LABEL}>Financials V2</p>
          <h2 style={HEADING}>Financial overview</h2>
        </div>
        {agreements.length > 0 && (
          <button type="button" style={BTN_GHOST} onClick={() => setDrawer({ kind: "create" })}>
            New agreement
          </button>
        )}
      </div>

      {flash && (
        <div
          style={{
            background: flash.err ? "rgba(163,45,45,0.08)" : "rgba(104,168,112,0.12)",
            color: flash.err ? DANGER : "#3d6b47",
            border: `0.5px solid ${flash.err ? DANGER : SAGE}`,
            padding: "8px 14px", borderRadius: 8, fontSize: 13, margin: "12px 0",
          }}
        >
          {flash.text}
        </div>
      )}

      {loadError && (
        <p style={{ color: DANGER, fontSize: 13 }}>Could not load financials: {loadError}</p>
      )}

      {!data && !loadError && <p style={{ color: MUTED, fontSize: 13 }}>Loading…</p>}

      {data && agreements.length === 0 && (
        <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
          <p style={{ fontFamily: "var(--font-display, serif)", fontSize: 19, color: FOREST, margin: "0 0 6px" }}>
            No Contribution agreement yet
          </p>
          <p style={{ fontSize: 13, color: MUTED, maxWidth: 420, margin: "0 auto 1.25rem" }}>
            {memberName ?? "This member"} has no Financials V2 agreement. Create one to set
            the Contribution and begin recording payments.
          </p>
          <button type="button" style={BTN_COPPER} onClick={() => setDrawer({ kind: "create" })}>
            Create Contribution agreement
          </button>
        </div>
      )}

      {data &&
        agreements.map((a) => (
          <AgreementCard
            key={a.agreement_id}
            a={a}
            amounts={data.amounts.filter((x) => x.agreement_id === a.agreement_id)}
            lifecycle={data.lifecycle.filter((x) => x.agreement_id === a.agreement_id)}
            ledger={data.ledger.filter((x) => x.agreement_id === a.agreement_id)}
            openDrawer={setDrawer}
          />
        ))}

      {drawer && (
        <ActionDrawer
          drawer={drawer}
          memberId={memberId}
          memberName={memberName}
          journeys={data?.journeys ?? []}
          onClose={() => setDrawer(null)}
          onDone={(text) => {
            setDrawer(null);
            showFlash(text);
            void load();
          }}
          onError={(text) => showFlash(text, true)}
        />
      )}
    </div>
  );
}

// ── One agreement ────────────────────────────────────────────────────────────

function AgreementCard({
  a, amounts, lifecycle, ledger, openDrawer,
}: {
  a: Balance;
  amounts: AmountRow[];
  lifecycle: LifecycleRow[];
  ledger: LedgerRow[];
  openDrawer: (d: DrawerState) => void;
}) {
  const [tab, setTab] = useState<"activity" | "contribution" | "lifecycle">("activity");
  const state = PAYMENT_STATE_LABEL[a.payment_state] ?? { label: a.payment_state, tone: MUTED };
  const transitions = TRANSITIONS[a.lifecycle_status] ?? [];
  const terminal = a.lifecycle_status === "canceled" || a.lifecycle_status === "waived";

  // One dominant action per state (PR6_BUILD_SPEC §4.1): draft → Activate;
  // active with money remaining → Collect; active fully received → none.
  const dominant =
    a.lifecycle_status === "draft"
      ? { label: "Activate agreement", act: () => openDrawer({ kind: "transition", agreement: a, toStatus: "active", label: "Activate agreement" }) }
      : a.lifecycle_status === "active" && a.remaining_cents > 0
        ? { label: "Collect remaining balance", act: () => openDrawer({ kind: "collect", agreement: a }) }
        : null;

  return (
    <div style={{ borderTop: `0.5px solid ${LINE}`, marginTop: 18, paddingTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-display, serif)", fontSize: 17, color: FOREST }}>
          {a.purpose === "journey_contribution" ? "Journey Contribution" : a.purpose.replace(/_/g, " ")}
        </span>
        <Chip color={SAGE_SOFT} dark>{LIFECYCLE_LABEL[a.lifecycle_status] ?? a.lifecycle_status}</Chip>
        <Chip color={state.tone}>{state.label}</Chip>
      </div>

      {/* Canonical figures, straight from the view */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, margin: "14px 0" }}>
        <Stat label="Contribution" value={usd(a.contribution_cents)} />
        <Stat label="Received" value={usd(a.net_received_cents)} accent={a.net_received_cents > 0 ? SAGE : undefined} />
        <Stat label="Remaining" value={usd(a.remaining_cents)} accent={a.remaining_cents > 0 ? COPPER : undefined} />
        <Stat label="Payment state" value={state.label} />
      </div>

      {/* Actions: one copper dominant, quiet secondaries */}
      {!terminal && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {dominant && (
            <button type="button" style={BTN_COPPER} onClick={dominant.act}>
              {dominant.label}
            </button>
          )}
          <button type="button" style={BTN_GHOST} onClick={() => openDrawer({ kind: "amend", agreement: a })}>
            Amend Contribution
          </button>
          {a.lifecycle_status === "active" && (
            <button
              type="button"
              style={BTN_GHOST}
              onClick={() => openDrawer({ kind: "payment", agreement: a, idempotencyKey: crypto.randomUUID() })}
            >
              Record external payment
            </button>
          )}
          {a.lifecycle_status === "draft" && (
            <button
              type="button"
              style={BTN_GHOST}
              onClick={() => openDrawer({ kind: "payment", agreement: a, idempotencyKey: crypto.randomUUID() })}
            >
              Record external payment
            </button>
          )}
          {transitions
            .filter((t) => t.to !== "active" || a.lifecycle_status !== "draft")
            .map((t) => (
              <button
                key={t.to}
                type="button"
                style={t.to === "canceled" || t.to === "waived" ? BTN_QUIET_DANGER : BTN_GHOST}
                onClick={() => openDrawer({ kind: "transition", agreement: a, toStatus: t.to, label: t.label })}
              >
                {t.label}
              </button>
            ))}
        </div>
      )}
      {a.lifecycle_status === "active" && <LinkStrip agreementId={a.agreement_id} />}

      {terminal && transitions.length === 0 && (
        <p style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>
          This agreement is {LIFECYCLE_LABEL[a.lifecycle_status]?.toLowerCase()}. Its history remains below.
        </p>
      )}

      {/* Histories: the permanent audit record, append-only by construction */}
      <div style={{ display: "flex", gap: 14, borderBottom: `0.5px solid ${LINE}`, marginBottom: 10 }}>
        {([["activity", `Payment activity (${ledger.length})`],
           ["contribution", `Contribution history (${amounts.length})`],
           ["lifecycle", `Lifecycle (${lifecycle.length})`]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              background: "none", border: "none", padding: "6px 2px", fontSize: 12,
              cursor: "pointer", fontFamily: "inherit",
              color: tab === key ? FOREST : MUTED,
              borderBottom: tab === key ? `2px solid ${COPPER}` : "2px solid transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "activity" && (
        ledger.length === 0 ? (
          <p style={{ fontSize: 13, color: MUTED }}>No payments recorded yet.</p>
        ) : (
          ledger.map((e) => {
            const reversed = ledger.some((r) => r.parent_entry_id === e.id && r.entry_type === "reversal");
            return (
              <div key={e.id} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "7px 0", borderBottom: `0.5px solid ${LINE}`, fontSize: 13 }}>
                <span style={{ minWidth: 86, color: MUTED, fontSize: 12 }}>{fmtDate(e.occurred_at)}</span>
                <span style={{ flex: 1 }}>
                  {e.entry_type === "external_payment" && `External payment${e.external_method ? ` · ${e.external_method}` : ""}`}
                  {e.entry_type === "stripe_payment" && "Stripe payment"}
                  {e.entry_type === "refund" && "Refund"}
                  {e.entry_type === "reversal" && "Reversal"}
                  {e.reason && <span style={{ color: MUTED }}>—{e.reason}</span>}
                  {reversed && <Chip color={DANGER}>reversed</Chip>}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: e.amount_cents < 0 ? DANGER : INK }}>
                  {usd(e.amount_cents)}
                </span>
                {e.entry_type !== "reversal" && !reversed && (
                  <button
                    type="button"
                    style={{ ...BTN_QUIET_DANGER, padding: "2px 8px", fontSize: 11 }}
                    onClick={() => openDrawer({ kind: "reverse", agreement: a, entry: e })}
                  >
                    Reverse…
                  </button>
                )}
              </div>
            );
          })
        )
      )}

      {tab === "contribution" && amounts.map((r, i) => (
        <div key={r.id} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: `0.5px solid ${LINE}`, fontSize: 13 }}>
          <span style={{ minWidth: 86, color: MUTED, fontSize: 12 }}>{fmtDate(r.created_at)}</span>
          <span style={{ flex: 1 }}>
            {i === amounts.length - 1 ? "Contribution set" : "Amended"}
            <span style={{ color: MUTED }}>—{r.reason}</span>
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{usd(r.amount_cents)}</span>
        </div>
      ))}

      {tab === "lifecycle" && lifecycle.map((r) => (
        <div key={r.id} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: `0.5px solid ${LINE}`, fontSize: 13 }}>
          <span style={{ minWidth: 86, color: MUTED, fontSize: 12 }}>{fmtDate(r.occurred_at)}</span>
          <span style={{ flex: 1 }}>
            {r.from_status ? `${LIFECYCLE_LABEL[r.from_status]} → ${LIFECYCLE_LABEL[r.to_status]}` : `Created as ${LIFECYCLE_LABEL[r.to_status]}`}
            <span style={{ color: MUTED }}>—{r.reason}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ── The drawer: form → confirmation preview → execute ────────────────────────

function ActionDrawer({
  drawer, memberId, memberName, journeys, onClose, onDone, onError,
}: {
  drawer: NonNullable<DrawerState>;
  memberId: string;
  memberName: string | null;
  journeys: Journey[];
  onClose: () => void;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("check");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [purpose, setPurpose] = useState("journey_contribution");
  const [journeyId, setJourneyId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const cents = useMemo(() => {
    const v = Math.round(parseFloat(amount) * 100);
    return Number.isFinite(v) ? v : NaN;
  }, [amount]);

  const needsAmount = drawer.kind === "create" || drawer.kind === "amend" || drawer.kind === "payment";
  // collect: amount is server-derived; only the reason gates the buttons.
  const valid =
    reason.trim().length > 0 &&
    (!needsAmount || (Number.isInteger(cents) && (drawer.kind === "payment" ? cents > 0 : cents >= 0)));

  const title =
    drawer.kind === "collect" ? "Collect remaining balance"
    : drawer.kind === "create" ? "Create Contribution agreement"
    : drawer.kind === "amend" ? "Amend Contribution"
    : drawer.kind === "payment" ? "Record external payment"
    : drawer.kind === "reverse" ? "Reverse entry"
    : drawer.label;

  // The confirmation preview: exactly what will be recorded, before it is.
  function preview(): string {
    switch (drawer.kind) {
      case "collect":
        return `Create a secure, single-use Stripe link for ${usd(drawer.agreement.remaining_cents)}—the live Payable Remaining. The amount is calculated from the live V2 ledger when the link is created.`;
      case "create":
        return `Create a ${purpose.replace(/_/g, " ")} agreement for ${memberName ?? "this member"} with a Contribution of ${usd(cents)}.`;
      case "amend":
        return `Change the Contribution from ${usd(drawer.agreement.contribution_cents)} to ${usd(cents)}. The previous value stays in the history.`;
      case "payment":
        return `Record ${usd(cents)} received by ${method} on ${fmtDate(occurredAt)}. This adds to Received and reduces Remaining.`;
      case "reverse":
        return `Reverse the ${drawer.entry.entry_type.replace(/_/g, " ")} of ${usd(drawer.entry.amount_cents)} from ${fmtDate(drawer.entry.occurred_at)}. A negating entry is added; nothing is deleted.`;
      case "transition":
        return `${drawer.label}: ${LIFECYCLE_LABEL[drawer.agreement.lifecycle_status]} → ${LIFECYCLE_LABEL[drawer.toStatus]}.`;
    }
  }

  const [issued, setIssued] = useState<{
    url: string; amountCents: number; expiresAt: string; emailed: boolean; emailError: string | null;
  } | null>(null);

  async function executeCollect(email: boolean) {
    if (drawer.kind !== "collect") return;
    setBusy(true);
    try {
      const res = await fetch("/api/finance/payment-links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "issue", agreementId: drawer.agreement.agreement_id, reason: reason.trim(), email }),
      });
      const json = await res.json();
      if (!res.ok) {
        onError(json.detail ? `${json.error}: ${json.detail}` : (json.error ?? "request failed"));
        return;
      }
      // The raw token exists only in this response (proof #24): show it once.
      setIssued({ url: json.url, amountCents: json.amountCents, expiresAt: json.expiresAt, emailed: json.emailed, emailError: json.emailError });
    } finally {
      setBusy(false);
    }
  }

  async function execute() {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { reason: reason.trim() };
      if (drawer.kind === "create") {
        Object.assign(body, {
          action: "create", memberId, purpose,
          journeyId: journeyId || null, amountCents: cents,
        });
      } else if (drawer.kind === "amend") {
        Object.assign(body, { action: "amend", agreementId: drawer.agreement.agreement_id, amountCents: cents });
      } else if (drawer.kind === "payment") {
        Object.assign(body, {
          action: "record_external_payment",
          agreementId: drawer.agreement.agreement_id,
          amountCents: cents, method,
          occurredAt: new Date(`${occurredAt}T12:00:00Z`).toISOString(),
          // Generated once when the drawer opened: a retry re-sends the SAME key
          // and the database returns the existing entry (D-083).
          idempotencyKey: drawer.idempotencyKey,
        });
      } else if (drawer.kind === "reverse") {
        Object.assign(body, { action: "reverse", entryId: drawer.entry.id });
      } else if (drawer.kind === "transition") {
        Object.assign(body, { action: "transition", agreementId: drawer.agreement.agreement_id, toStatus: drawer.toStatus });
      } else {
        return; // collect executes through executeCollect, never here
      }

      const res = await fetch("/api/finance/agreements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        onError(json.detail ? `${json.error}: ${json.detail}` : (json.error ?? "request failed"));
        return;
      }
      onDone(
        drawer.kind === "payment" ? "Payment recorded."
        : drawer.kind === "create" ? "Agreement created."
        : drawer.kind === "amend" ? "Contribution amended."
        : drawer.kind === "reverse" ? "Entry reversed."
        : "Status updated.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(20,26,22,0.45)", zIndex: 60,
        display: "flex", justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: IVORY, width: "100%", maxWidth: 440, height: "100%",
          padding: "1.75rem", overflowY: "auto", boxShadow: "-8px 0 30px rgba(0,0,0,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={SECTION_LABEL}>Financials V2</p>
        <h3 style={{ ...HEADING, fontSize: 21, marginBottom: 16 }}>{title}</h3>

        {issued ? (
          <>
            <div style={{ background: "#edf6ee", border: `0.5px solid ${SAGE}`, borderRadius: 10, padding: "16px 18px" }}>
              <p style={{ margin: "0 0 6px", fontWeight: 650, color: FOREST }}>Secure contribution link created</p>
              <p style={{ margin: "0 0 8px", fontFamily: "var(--font-display, serif)", fontSize: 22, color: FOREST }}>
                {usd(issued.amountCents)} <span style={{ fontSize: 13, color: MUTED, fontFamily: "var(--font-body, sans-serif)" }}>· expires {fmtDate(issued.expiresAt)}</span>
              </p>
              {issued.emailed ? (
                <p style={{ margin: 0, fontSize: 13, color: "#3d6b47" }}>Sent by email.</p>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: DANGER }}>
                  {issued.emailError
                    ? `The link is active, but the email was not sent (${issued.emailError}). Copy it now or revoke it and create another.`
                    : "Copy the link now—it cannot be shown again after this drawer closes."}
                </p>
              )}
              <button type="button" style={{ ...BTN_GHOST, marginTop: 10 }}
                onClick={() => { void navigator.clipboard.writeText(issued.url); }}>
                Copy secure link
              </button>
            </div>
            <div style={{ marginTop: 16 }}>
              <button type="button" style={BTN_COPPER} onClick={() => onDone("Secure link created.")}>Done</button>
            </div>
          </>
        ) : !confirming ? (
          <>
            {drawer.kind === "create" && (
              <>
                <Field label="Purpose">
                  <select value={purpose} onChange={(e) => setPurpose(e.target.value)} style={INPUT}>
                    <option value="journey_contribution">Journey Contribution</option>
                    <option value="membership">Membership</option>
                    <option value="additional_gift">Additional gift</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                {journeys.length > 0 && (
                  <Field label="Journey (optional)">
                    <select value={journeyId} onChange={(e) => setJourneyId(e.target.value)} style={INPUT}>
                      <option value="">Not linked to a journey</option>
                      {journeys.map((j) => (
                        <option key={j.id} value={j.id}>
                          {(j.booking_type ?? "journey").replace(/_/g, " ")}
                          {j.start_at ? `—${fmtDate(j.start_at)}` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </>
            )}

            {drawer.kind === "collect" && (
              <div style={{ background: "#f3f7f2", border: "0.5px solid #9fbea8", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
                <p style={{ ...SECTION_LABEL, color: "#57906e", marginBottom: 4 }}>Amount to collect</p>
                <p style={{ margin: 0, fontFamily: "var(--font-display, serif)", fontSize: 30, color: FOREST, fontVariantNumeric: "tabular-nums" }}>
                  {usd(drawer.agreement.remaining_cents)}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED }}>
                  Calculated from the live V2 ledger when the link is created. This amount cannot be edited here.
                </p>
              </div>
            )}

            {needsAmount && (
              <Field label={drawer.kind === "payment" ? "Amount received ($)" : "Contribution ($)"}>
                <input type="number" min={0} step="0.01" value={amount}
                  onChange={(e) => setAmount(e.target.value)} style={INPUT} placeholder="0.00" />
              </Field>
            )}

            {drawer.kind === "payment" && (
              <>
                <Field label="Method">
                  <select value={method} onChange={(e) => setMethod(e.target.value)} style={INPUT}>
                    <option value="check">Cheque</option>
                    <option value="cash">Cash</option>
                    <option value="wire">Wire</option>
                    <option value="zelle">Zelle</option>
                    <option value="venmo">Venmo</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Date received">
                  <input type="date" value={occurredAt} max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setOccurredAt(e.target.value)} style={INPUT} />
                </Field>
              </>
            )}

            {drawer.kind === "reverse" && (
              <p style={{ fontSize: 13, color: INK, background: "rgba(163,45,45,0.06)", border: `0.5px solid ${DANGER}`, borderRadius: 8, padding: "10px 12px" }}>
                Reversing adds a negating entry of {usd(-drawer.entry.amount_cents)}. The original
                entry is never edited or deleted—both remain in the permanent history.
              </p>
            )}

            <Field label="Reason (required—becomes the permanent record)">
              <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                style={{ ...INPUT, resize: "vertical" }}
                placeholder={
                  drawer.kind === "payment" ? "e.g. Cheque #204 received by post"
                  : drawer.kind === "reverse" ? "e.g. Cheque bounced on deposit"
                  : "Why this is correct"
                } />
            </Field>

            {drawer.kind === "collect" ? (
              <div style={{ display: "grid", gap: 9, marginTop: 18 }}>
                <button type="button" disabled={busy || reason.trim().length === 0}
                  style={{ ...BTN_COPPER, minHeight: 46, opacity: reason.trim() ? 1 : 0.45 }}
                  onClick={() => void executeCollect(true)}>
                  {busy ? "Creating secure link…" : "Create and email secure link"}
                </button>
                <button type="button" disabled={busy || reason.trim().length === 0}
                  style={{ ...BTN_GHOST, minHeight: 46, opacity: reason.trim() ? 1 : 0.45 }}
                  onClick={() => void executeCollect(false)}>
                  Create link only
                </button>
                <button type="button" style={{ ...BTN_GHOST, border: "none", color: MUTED }} onClick={onClose}>Cancel</button>
                <p style={{ textAlign: "center", fontSize: 11, color: MUTED, margin: 0 }}>
                  Single-use link · Secure payment powered by Stripe
                </p>
              </div>
            ) : (
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button type="button" style={{ ...BTN_COPPER, opacity: valid ? 1 : 0.45, cursor: valid ? "pointer" : "default" }}
                disabled={!valid} onClick={() => setConfirming(true)}>
                Review
              </button>
              <button type="button" style={BTN_GHOST} onClick={onClose}>Cancel</button>
            </div>
            )}
          </>
        ) : (
          <>
            <div style={{ background: "#fff", border: `0.5px solid ${LINE}`, borderRadius: 10, padding: "14px 16px", fontSize: 14, color: INK, lineHeight: 1.5 }}>
              <p style={{ margin: "0 0 8px" }}>{preview()}</p>
              <p style={{ margin: 0, fontStyle: "italic", color: MUTED }}>“{reason.trim()}”</p>
            </div>
            <p style={{ fontSize: 12, color: MUTED, margin: "10px 0 16px" }}>
              Recorded under your founder account with a database-generated timestamp.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" style={BTN_COPPER} disabled={busy} onClick={execute}>
                {busy ? "Recording…" : "Confirm"}
              </button>
              <button type="button" style={BTN_GHOST} disabled={busy} onClick={() => setConfirming(false)}>
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Link/session status strip (member-safe labels; spec §4.4) ────────────────

function LinkStrip({ agreementId }: { agreementId: string }) {
  const router = useRouter();
  const [data, setData] = useState<{
    links: { id: string; status: string; expires_at: string; consumed_by_session_id: string | null }[];
    sessions: { id: string; status: string; expires_at: string; stripe_session_id: string | null }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetch(`/api/finance/payment-links?agreementId=${agreementId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j) setData(j); })
      .catch(() => {});
    return () => { alive = false; };
  }, [agreementId]);

  if (!data) return null;
  const link = data.links[0];
  const session = data.sessions.find((s) => s.status === "open" || s.status === "creating") ?? data.sessions[0];
  if (!link && !session) return null;

  let label = ""; let canRevoke = false;
  if (session?.status === "open") { label = `Stripe checkout open · expires ${new Date(session.expires_at).toLocaleDateString()}`; }
  else if (session?.status === "completed") { label = "Payment confirmed"; }
  else if (session?.status === "expired") { label = "Checkout expired"; }
  else if (link?.status === "active") { label = `Link ready · expires ${new Date(link.expires_at).toLocaleDateString()}`; canRevoke = true; }
  else if (link?.status === "creating") { label = "Creating secure checkout…"; }
  else if (link?.status === "consumed") { label = session ? "Link used · checkout still available" : "Link used"; }
  else if (link?.status === "revoked") { label = "Link revoked"; }
  if (!label) return null;

  async function revoke() {
    if (!link) return;
    setBusy(true);
    try {
      await fetch("/api/finance/payment-links", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "revoke", linkId: link.id }),
      });
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, borderTop: `0.5px solid ${LINE}`, paddingTop: 12, marginBottom: 14, fontSize: 12, color: MUTED }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: SAGE, display: "inline-block" }} />
      <strong style={{ color: FOREST, fontWeight: 650 }}>{label}</strong>
      <span style={{ flex: 1 }} />
      {canRevoke && (
        <button type="button" disabled={busy} onClick={() => void revoke()}
          style={{ background: "none", border: "none", color: DANGER, fontSize: 12, cursor: "pointer" }}>
          {busy ? "Revoking…" : "Revoke"}
        </button>
      )}
    </div>
  );
}

// ── Primitives ───────────────────────────────────────────────────────────────

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: "#fff", border: `0.5px solid ${LINE}`, borderRadius: 10, padding: "10px 12px" }}>
      <p style={{ ...SECTION_LABEL, marginBottom: 3 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 17, fontFamily: "var(--font-display, serif)", color: accent ?? INK, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
    </div>
  );
}

function Chip({ children, color, dark }: { children: React.ReactNode; color: string; dark?: boolean }) {
  return (
    <span style={{
      fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", fontWeight: 600,
      padding: "3px 9px", borderRadius: 99, border: `0.5px solid ${color}`,
      color: dark ? FOREST : color, background: "transparent", whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ ...SECTION_LABEL, display: "block", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

const PANEL: React.CSSProperties = {
  background: IVORY,
  border: `0.5px solid ${LINE}`,
  borderRadius: 16,
  padding: "1.75rem",
  fontFamily: "var(--font-body, sans-serif)",
  color: INK,
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
  color: MUTED, fontWeight: 500, margin: "0 0 0.4rem",
};

const HEADING: React.CSSProperties = {
  fontFamily: "var(--font-display, serif)",
  fontSize: 22, fontWeight: 400, color: FOREST, margin: 0, lineHeight: 1.25,
};

const INPUT: React.CSSProperties = {
  background: "#fff", border: "0.5px solid rgba(0,0,0,0.2)", borderRadius: 7,
  padding: "9px 12px", fontSize: 13, color: INK, fontFamily: "inherit",
  outline: "none", width: "100%",
};

const BTN_COPPER: React.CSSProperties = {
  background: COPPER, color: "#fff", border: "none", borderRadius: 7,
  padding: "9px 18px", fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: "pointer",
};

const BTN_GHOST: React.CSSProperties = {
  background: "transparent", color: FOREST, border: `0.5px solid rgba(0,0,0,0.2)`,
  borderRadius: 7, padding: "9px 14px", fontSize: 13, fontFamily: "inherit", cursor: "pointer",
};

const BTN_QUIET_DANGER: React.CSSProperties = {
  background: "transparent", color: DANGER, border: `0.5px solid ${DANGER}`,
  borderRadius: 7, padding: "9px 14px", fontSize: 13, fontFamily: "inherit", cursor: "pointer",
};
