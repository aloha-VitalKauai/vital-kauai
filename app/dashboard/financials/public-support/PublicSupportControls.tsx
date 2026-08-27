"use client";

/**
 * PR 10C: founder configuration and the activate/retire controls.
 *
 * Every submit lands on the founder-session API route; the DATABASE authorises
 * (is_founder() under the founder's JWT) and enforces completeness (VK428).
 * This component holds no authority — it collects inputs and a reason.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

const FOREST = "#1E3A2C";
const COPPER = "#B8683D";

type Current = {
  legalName: string | null;
  einLast4: string | null;
  taxExemptBasis: string | null;
  receiptFooter: string | null;
  receiptContact: string | null;
  ackTaxLanguage: string | null;
  ackNoGoodsStatement: string | null;
  ackEnabled: boolean;
  minCents: number;
  maxCents: number;
  boundsApproved: boolean;
  feeBps: number;
  feeFixedCents: number;
  feePolicyVersion: string;
};

async function post(body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch("/api/finance/public-support", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return null;
  const j = await res.json().catch(() => ({}));
  return typeof j.error === "string" ? j.error : `request failed (${res.status})`;
}

const box: React.CSSProperties = { border: "1px solid #d8d6cd", borderRadius: 12, padding: "18px 20px", marginBottom: 18, background: "#fff" };
const label: React.CSSProperties = { display: "block", fontSize: 12, color: "#8A8A84", margin: "10px 0 4px" };
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: "1px solid #d8d6cd", fontSize: 14 };
const btn = (danger = false): React.CSSProperties => ({
  padding: "10px 16px", borderRadius: 9, border: "none", cursor: "pointer",
  background: danger ? COPPER : FOREST, color: "#f5f0e8", fontSize: 14, marginTop: 12,
});

export default function PublicSupportControls({
  campaignId,
  entityId,
  status,
  configured,
  current,
}: {
  campaignId: string;
  entityId: string;
  status: string;
  configured: boolean;
  current: Current;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [legalName, setLegalName] = useState(current.legalName ?? "");
  const [einLast4, setEinLast4] = useState(current.einLast4 ?? "");
  const [basis, setBasis] = useState(current.taxExemptBasis ?? "");
  const [footer, setFooter] = useState(current.receiptFooter ?? "");
  const [contact, setContact] = useState(current.receiptContact ?? "");
  const [taxLang, setTaxLang] = useState(current.ackTaxLanguage ?? "");
  const [noGoods, setNoGoods] = useState(current.ackNoGoodsStatement ?? "");
  const [enableAck, setEnableAck] = useState(current.ackEnabled);
  const [minDollars, setMinDollars] = useState(String(current.minCents / 100));
  const [maxDollars, setMaxDollars] = useState(String(current.maxCents / 100));
  const [reason, setReason] = useState("");

  async function run(body: Record<string, unknown>, okMsg: string) {
    setBusy(true);
    setMsg(null);
    const err = await post(body);
    setBusy(false);
    setMsg(err ? `Refused: ${err}` : okMsg);
    if (!err) router.refresh();
  }

  return (
    <div>
      {msg ? (
        <p style={{ padding: "10px 14px", borderRadius: 9, background: msg.startsWith("Refused") ? "#fbeee6" : "#eef5ee", color: msg.startsWith("Refused") ? "#8a4b2f" : FOREST, fontSize: 14 }}>
          {msg}
        </p>
      ) : null}

      <section style={box}>
        <h2 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 20, color: FOREST, margin: 0 }}>Receipt identity &amp; acknowledgment wording</h2>
        <label style={label}>Legal name (appears on every acknowledgment)</label>
        <input style={input} value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>EIN last 4 (optional)</label>
            <input style={input} value={einLast4} onChange={(e) => setEinLast4(e.target.value)} maxLength={4} />
          </div>
          <div style={{ flex: 2 }}>
            <label style={label}>Tax-exempt basis (founder-confirmed)</label>
            <input style={input} value={basis} onChange={(e) => setBasis(e.target.value)} />
          </div>
        </div>
        <label style={label}>Tax-deductibility language (shown verbatim)</label>
        <textarea style={{ ...input, minHeight: 64 }} value={taxLang} onChange={(e) => setTaxLang(e.target.value)} />
        <label style={label}>No-goods-or-services statement (shown verbatim)</label>
        <textarea style={{ ...input, minHeight: 64 }} value={noGoods} onChange={(e) => setNoGoods(e.target.value)} />
        <label style={label}>Receipt footer</label>
        <textarea style={{ ...input, minHeight: 48 }} value={footer} onChange={(e) => setFooter(e.target.value)} />
        <label style={label}>Receipt contact</label>
        <input style={input} value={contact} onChange={(e) => setContact(e.target.value)} />
        <label style={{ ...label, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#46564e" }}>
          <input type="checkbox" checked={enableAck} onChange={(e) => setEnableAck(e.target.checked)} />
          I approve this wording for written acknowledgments
        </label>
        <button
          style={btn()}
          disabled={busy}
          onClick={() =>
            run(
              {
                action: "configure_entity", entityId, legalName, einLast4: einLast4 || null,
                taxExemptBasis: basis, receiptFooter: footer, receiptContact: contact,
                ackTaxLanguage: taxLang, ackNoGoodsStatement: noGoods,
                enableAcknowledgments: enableAck,
              },
              "Receipt identity saved.",
            )
          }
        >
          Save receipt identity
        </button>
      </section>

      <section style={box}>
        <h2 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 20, color: FOREST, margin: 0 }}>
          Contribution bounds {current.boundsApproved ? "· founder-approved ✓" : "· NOT yet approved"}
        </h2>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Minimum (USD)</label>
            <input style={input} type="number" value={minDollars} onChange={(e) => setMinDollars(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Maximum (USD)</label>
            <input style={input} type="number" value={maxDollars} onChange={(e) => setMaxDollars(e.target.value)} />
          </div>
        </div>
        <button
          style={btn()}
          disabled={busy}
          onClick={() =>
            run(
              {
                action: "set_bounds", campaignId,
                minCents: Math.round(Number(minDollars) * 100),
                maxCents: Math.round(Number(maxDollars) * 100),
              },
              "Bounds approved.",
            )
          }
        >
          Approve bounds
        </button>
      </section>

      <section style={box}>
        <h2 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 20, color: FOREST, margin: 0 }}>Activation</h2>
        <p style={{ fontSize: 13, color: "#8A8A84", margin: "8px 0 0" }}>
          {configured
            ? "Configuration is complete. Activation opens /support to the public—complete the mandatory-fee compliance review first."
            : "Activation is refused (VK428) until the receipt identity, wording and bounds above are complete."}
        </p>
        <label style={label}>Reason (recorded permanently)</label>
        <input style={input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Compliance review complete; opening General Support" />
        {status === "active" ? (
          <button style={btn(true)} disabled={busy || !reason.trim()} onClick={() => run({ action: "retire", campaignId, reason }, "Campaign retired.")}>
            Retire campaign
          </button>
        ) : (
          <button style={btn()} disabled={busy || !reason.trim()} onClick={() => run({ action: "activate", campaignId, reason }, "Campaign ACTIVATED—/support is live.")}>
            Activate campaign
          </button>
        )}
      </section>
    </div>
  );
}
