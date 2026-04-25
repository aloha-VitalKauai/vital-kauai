"use client";

import { useState, useTransition } from "react";
import {
  auditCeremonyAlignment,
  reconcileMemberAlignment,
  reconcileAllAlignment,
  type DriftRow,
} from "@/app/actions/journeys";

type AuditState = {
  drift: DriftRow[];
  checkedMembers: number;
  checkedJourneys: number;
} | null;

const KIND_LABEL: Record<DriftRow["kind"], string> = {
  member_date_mismatch: "members.ceremony_date wrong",
  record_missing: "ceremony_records row missing",
  record_date_mismatch: "ceremony_records date wrong",
  record_status_mismatch: "ceremony_records status wrong",
};

const KIND_TONE: Record<DriftRow["kind"], { bg: string; text: string; dot: string }> = {
  member_date_mismatch:   { bg: "#FAEEDA", text: "#633806", dot: "#EF9F27" },
  record_missing:         { bg: "#FBE7E1", text: "#7A1F0A", dot: "#D14F2A" },
  record_date_mismatch:   { bg: "#FAEEDA", text: "#633806", dot: "#EF9F27" },
  record_status_mismatch: { bg: "#EEEDFE", text: "#3C3489", dot: "#7F77DD" },
};

export default function CeremonyAuditPanel({
  initial,
}: {
  initial: AuditState;
}) {
  const [state, setState] = useState<AuditState>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      setMessage(null);
      const result = await auditCeremonyAlignment();
      if (result.ok && result.data) {
        setState(result.data);
        setMessage(
          result.data.drift.length === 0
            ? `All ${result.data.checkedMembers} members and ${result.data.checkedJourneys} journeys are aligned.`
            : `${result.data.drift.length} drift row(s) found across ${result.data.checkedMembers} members.`,
        );
      } else {
        setMessage(result.error ?? "Audit failed");
      }
    });
  }

  function healMember(memberId: string) {
    startTransition(async () => {
      setMessage(null);
      const result = await reconcileMemberAlignment(memberId);
      if (result.ok) {
        const re = await auditCeremonyAlignment();
        if (re.ok && re.data) setState(re.data);
        setMessage(`Reconciled ${result.data?.healed ?? 0} journey row(s) for that member.`);
      } else {
        setMessage(result.error ?? "Heal failed");
      }
    });
  }

  function healAll() {
    if (
      !confirm(
        "Reconcile every member's ceremony_records and members.ceremony_date against the journeys table?",
      )
    )
      return;
    startTransition(async () => {
      setMessage(null);
      const result = await reconcileAllAlignment();
      if (result.ok && result.data) {
        const re = await auditCeremonyAlignment();
        if (re.ok && re.data) setState(re.data);
        setMessage(
          `Reconciled ${result.data.membersHealed} member(s), ${result.data.journeysSynced} journey row(s).`,
        );
      } else {
        setMessage(result.error ?? "Heal-all failed");
      }
    });
  }

  const drift = state?.drift ?? [];

  const LABEL: React.CSSProperties = {
    fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em",
    color: "#6B6B67", marginBottom: 6, fontWeight: 500,
  };
  const TH: React.CSSProperties = {
    padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 500,
    color: "#6B6B67", textTransform: "uppercase", letterSpacing: "0.06em",
    borderBottom: "0.5px solid rgba(0,0,0,0.09)", background: "#FAFAF8", whiteSpace: "nowrap",
  };
  const TD: React.CSSProperties = {
    padding: "10px 12px", borderBottom: "0.5px solid rgba(0,0,0,0.06)",
    fontSize: 12, verticalAlign: "middle",
  };
  const BTN_PRIMARY: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, padding: "7px 14px",
    border: "0.5px solid #1D6B4A", background: "#1D6B4A", color: "#fff",
    borderRadius: 6, cursor: pending ? "wait" : "pointer", opacity: pending ? 0.6 : 1,
  };
  const BTN_SECONDARY: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, padding: "7px 14px",
    border: "0.5px solid rgba(0,0,0,0.18)", background: "#fff", color: "#1A1A18",
    borderRadius: 6, cursor: pending ? "wait" : "pointer", opacity: pending ? 0.6 : 1,
  };
  const BTN_ROW: React.CSSProperties = {
    fontSize: 11, fontWeight: 500, padding: "5px 10px",
    border: "0.5px solid rgba(0,0,0,0.18)", background: "#fff", color: "#1A1A18",
    borderRadius: 5, cursor: pending ? "wait" : "pointer", opacity: pending ? 0.6 : 1,
  };

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: "1.25rem" }}>
        <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "1rem 1.1rem" }}>
          <p style={LABEL}>Members checked</p>
          <p style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1, color: "#1A1A18", margin: 0 }}>{state?.checkedMembers ?? "—"}</p>
        </div>
        <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "1rem 1.1rem" }}>
          <p style={LABEL}>Journeys checked</p>
          <p style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1, color: "#1A1A18", margin: 0 }}>{state?.checkedJourneys ?? "—"}</p>
        </div>
        <div style={{ background: drift.length === 0 ? "#E1F5EE" : "#FBE7E1", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "1rem 1.1rem" }}>
          <p style={LABEL}>Drift rows</p>
          <p style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1, color: drift.length === 0 ? "#085041" : "#7A1F0A", margin: 0 }}>{drift.length}</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: "1rem" }}>
        <button onClick={refresh} disabled={pending} style={BTN_SECONDARY}>{pending ? "Working…" : "Re-run audit"}</button>
        <button onClick={healAll} disabled={pending || drift.length === 0} style={BTN_PRIMARY}>Heal everyone</button>
        {message && <span style={{ fontSize: 12, color: "#6B6B67", marginLeft: 4 }}>{message}</span>}
      </div>

      <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "0.875rem 1.25rem", borderBottom: "0.5px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", fontWeight: 500 }}>Drift between journeys, ceremony_records, and members.ceremony_date</span>
          <span style={{ fontSize: 11, color: "#9E9E9A" }}>{drift.length} rows</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Member", "Issue", "Expected", "Actual", "Detail", "Action"].map((h) => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drift.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "2.5rem", textAlign: "center", color: "#9E9E9A", fontSize: 14 }}>Everything is aligned. Portal and dashboard agree.</td></tr>
              ) : (
                drift.map((d, i) => {
                  const tone = KIND_TONE[d.kind];
                  return (
                    <tr key={`${d.memberId}-${d.journeyId ?? "x"}-${d.kind}-${i}`} style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                      <td style={TD}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{d.memberName ?? "Unknown"}</div>
                        <div style={{ fontSize: 11, color: "#9E9E9A" }}>{d.memberEmail ?? d.memberId.slice(0, 8)}</div>
                      </td>
                      <td style={TD}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 99, whiteSpace: "nowrap", background: tone.bg, color: tone.text }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: tone.dot, display: "inline-block" }} />
                          {KIND_LABEL[d.kind]}
                        </span>
                      </td>
                      <td style={{ ...TD, fontFamily: "var(--font-mono, monospace)", fontSize: 11 }}>{d.expected ?? "—"}</td>
                      <td style={{ ...TD, fontFamily: "var(--font-mono, monospace)", fontSize: 11 }}>{d.actual ?? "—"}</td>
                      <td style={{ ...TD, fontSize: 11, color: "#6B6B67", maxWidth: 320 }}>{d.detail}</td>
                      <td style={TD}>
                        <button onClick={() => healMember(d.memberId)} disabled={pending} style={BTN_ROW}>Heal</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
