"use client";

/**
 * Financials V2 — PR 4: the exceptions queue and quarantine controls.
 *
 * The controls supply only a target status and a note. Identity and timestamps
 * are set inside `finance.resolve_exception()` / `finance.release_quarantine()`
 * from the founder's own session — nothing this component sends can influence
 * attribution, and Postgres refuses a non-founder regardless of what the browser
 * claims.
 *
 * `router.refresh()` after every successful action: the queue is rendered from
 * server-component props, and a page that stays one step behind its own database
 * reads as a failed click (the lesson of the canary panel).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

type ExceptionRow = {
  id: string;
  kind: string;
  provider_object_id: string | null;
  livemode: boolean;
  amount_cents: number | null;
  currency: string | null;
  detail: Record<string, unknown> | null;
  first_detected_at: string;
  last_detected_at: string;
  occurrence_count: number;
  consecutive_failure_runs: number;
  quarantined_at: string | null;
  quarantine_reason: string | null;
  released_at: string | null;
  resolution_status: string;
  resolved_at: string | null;
  resolution_note: string | null;
};

const box: React.CSSProperties = {
  background: "#fff",
  border: "0.5px solid rgba(0,0,0,0.12)",
  borderRadius: 8,
  padding: "1.25rem 1.5rem",
  marginBottom: "1.25rem",
};

const chip: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 8px",
  borderRadius: 10,
  fontSize: 11,
  marginRight: 6,
};

function usd(cents: number | null): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function VerificationQueue({ exceptions }: { exceptions: ExceptionRow[] }) {
  const router = useRouter();
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [showResolved, setShowResolved] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kinds = Array.from(new Set(exceptions.map((e) => e.kind))).sort();

  const open = exceptions.filter((e) => e.resolution_status === "open");
  const quarantined = open.filter((e) => e.quarantined_at && !e.released_at);
  const queue = exceptions.filter((e) => {
    if (!showResolved && e.resolution_status !== "open") return false;
    if (kindFilter !== "all" && e.kind !== kindFilter) return false;
    if (modeFilter === "live" && !e.livemode) return false;
    if (modeFilter === "test" && e.livemode) return false;
    return true;
  });

  async function act(action: "resolve" | "dismiss" | "release", id: string) {
    const note = (notes[id] ?? "").trim();
    if (!note) {
      setError("A note is required—it becomes the permanent record of this decision.");
      return;
    }
    setBusy(id);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/finance/exceptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, exceptionId: id, note }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail ? `${json.error}: ${json.detail}` : (json.error ?? "request failed"));
        return;
      }
      setMessage(
        action === "release"
          ? "Quarantine released—the object returns to normal processing."
          : `Exception ${action === "resolve" ? "resolved" : "dismissed"}.`,
      );
      setNotes((n) => ({ ...n, [id]: "" }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section style={box}>
      <h2 style={{ marginTop: 0, fontSize: 17 }}>
        Exceptions{" "}
        <span style={{ fontWeight: 400, color: "#6b6b60", fontSize: 13 }}>
          {open.length} open · {quarantined.length} quarantined
        </span>
      </h2>

      <p style={{ fontSize: 13, color: "#6b6b60", marginTop: 0 }}>
        <em>provider_without_ledger</em> is the expected shadow-phase signal—money the
        legacy system took, which V2 does not own. A LIVE{" "}
        <em>unattributable_payment</em> needs attention.
      </p>

      {message && <p style={{ color: "#2f6f4f" }}>{message}</p>}
      {error && (
        <p style={{ color: "#8b2f2f" }}>
          <strong>Refused.</strong> {error}
        </p>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12, fontSize: 13 }}>
        <label>
          Kind{" "}
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
            <option value="all">all</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mode{" "}
          <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
            <option value="all">all</option>
            <option value="live">LIVE only</option>
            <option value="test">test only</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
          />{" "}
          show resolved
        </label>
      </div>

      {queue.length === 0 ? (
        <p style={{ color: "#6b6b60", margin: 0 }}>
          {exceptions.length === 0
            ? "No exceptions have been raised."
            : "Nothing matches the current filters."}
        </p>
      ) : (
        queue.map((e) => {
          const isQuarantined = Boolean(e.quarantined_at && !e.released_at);
          const isOpen = e.resolution_status === "open";
          return (
            <div
              key={e.id}
              style={{
                borderTop: "0.5px solid rgba(0,0,0,0.08)",
                padding: "0.75rem 0",
              }}
            >
              <div style={{ marginBottom: 4 }}>
                <strong>{e.kind}</strong>{" "}
                <span
                  style={{
                    ...chip,
                    background: e.livemode ? "#8b2f2f" : "#e8e8e2",
                    color: e.livemode ? "#fff" : "#4a4a42",
                  }}
                >
                  {e.livemode ? "LIVE" : "test"}
                </span>
                {isQuarantined && (
                  <span style={{ ...chip, background: "#6b4a8b", color: "#fff" }}>
                    quarantined
                  </span>
                )}
                {!isOpen && (
                  <span style={{ ...chip, background: "#e8e8e2", color: "#4a4a42" }}>
                    {e.resolution_status}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: "#4a4a42" }}>
                {e.provider_object_id && (
                  <span style={{ fontFamily: "ui-monospace, monospace", marginRight: 10 }}>
                    {e.provider_object_id}
                  </span>
                )}
                {e.amount_cents !== null && <span style={{ marginRight: 10 }}>{usd(e.amount_cents)}</span>}
                <span style={{ color: "#6b6b60" }}>
                  seen {e.occurrence_count}× · last {new Date(e.last_detected_at).toLocaleString()}
                  {e.consecutive_failure_runs > 0 &&
                    ` · failed ${e.consecutive_failure_runs} consecutive run(s)`}
                </span>
              </div>
              {e.detail && (
                <pre
                  style={{
                    fontSize: 12,
                    background: "#fafaf8",
                    padding: "6px 8px",
                    borderRadius: 4,
                    overflow: "auto",
                    maxHeight: 90,
                  }}
                >
                  {JSON.stringify(e.detail)}
                </pre>
              )}
              {!isOpen && e.resolution_note && (
                <p style={{ fontSize: 13, fontStyle: "italic", color: "#4a4a42" }}>
                  “{e.resolution_note}”
                </p>
              )}

              {isOpen && (
                <div style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    placeholder="Required note—why this judgement is correct"
                    value={notes[e.id] ?? ""}
                    onChange={(ev) => setNotes((n) => ({ ...n, [e.id]: ev.target.value }))}
                    style={{
                      width: "60%",
                      padding: "6px 8px",
                      border: "0.5px solid rgba(0,0,0,0.2)",
                      borderRadius: 4,
                      fontSize: 13,
                      marginRight: 8,
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy === e.id}
                    onClick={() => act("resolve", e.id)}
                    style={btn("#2f6f4f")}
                  >
                    Resolve
                  </button>
                  <button
                    type="button"
                    disabled={busy === e.id}
                    onClick={() => act("dismiss", e.id)}
                    style={btn("#6b6b60")}
                  >
                    Dismiss
                  </button>
                  {isQuarantined && (
                    <button
                      type="button"
                      disabled={busy === e.id}
                      onClick={() => act("release", e.id)}
                      style={btn("#6b4a8b")}
                    >
                      Release quarantine
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}

function btn(background: string): React.CSSProperties {
  return {
    padding: "5px 12px",
    borderRadius: 5,
    border: "none",
    background,
    color: "#fff",
    fontSize: 13,
    cursor: "pointer",
    marginRight: 6,
  };
}
