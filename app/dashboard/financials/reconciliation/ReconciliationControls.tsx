"use client";

/**
 * Financials V2 — PR 3B: the founder's approval controls.
 *
 * Deliberately plain. The founder signs into the portal as usual and uses this
 * page; they never see a token, open a console, or construct a request. The
 * browser sends its existing session cookie, the API route calls
 * `finance.approve_dry_run` on that session, and Postgres decides via
 * `is_founder()`. Nothing here asserts a role — a role asserted by a client is
 * not a credential.
 *
 * The polished Financials dashboard is PR 7; this is the operational minimum.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

type RunSummary = {
  id: string;
  livemode: boolean;
  dry_run: boolean;
  status: string;
  window_start: string;
  window_end: string;
  window_exhausted: boolean;
  implementation_version: string;
  objects_scanned: number;
  objects_matched: number;
  would_create_count: number | null;
  prospective_by_kind: Record<string, number> | null;
  report_completed_at: string | null;
  approved_at: string | null;
  approval_note: string | null;
  error: string | null;
};

const box: React.CSSProperties = {
  background: "#fff",
  border: "0.5px solid rgba(0,0,0,0.12)",
  borderRadius: 8,
  padding: "1.25rem 1.5rem",
  marginBottom: "1.25rem",
};

const label: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#6b6b60",
};

function Money({ n }: { n: number | null }) {
  return <strong>{n === null ? "—" : n}</strong>;
}

export default function ReconciliationControls({
  awaitingApproval,
  latestApproved,
  recentRuns,
}: {
  awaitingApproval: RunSummary | null;
  latestApproved: RunSummary | null;
  recentRuns: RunSummary[];
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(body: unknown) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      // Same-origin, cookie-authenticated. No token is read or sent by hand.
      const res = await fetch("/api/finance/reconciliation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail ? `${json.error}: ${json.detail}` : (json.error ?? "request failed"));
        return null;
      }
      // Re-fetch the server component. Approval and canary state are rendered from
      // props resolved at page load, so without this the page stays one step behind
      // its own database: approving would show a success message while the "Start
      // the canary" panel never appeared, which reads as a failed click.
      router.refresh();
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!awaitingApproval) return;
    const json = await post({ action: "approve", runId: awaitingApproval.id, note: note.trim() });
    if (json) {
      setMessage(
        json.already_approved
          ? "This run was already approved — nothing changed."
          : "Approved. You can now start the canary.",
      );
    }
  }

  async function startCanary(runId: string) {
    const json = await post({ action: "start_canary", approvedRunId: runId });
    if (json) {
      setMessage(
        `Canary started (run ${json.run_id}), covering ${new Date(json.window_start).toLocaleString()} to ${new Date(json.window_end).toLocaleString()}.`,
      );
    }
  }

  return (
    <div>
      {message && (
        <div style={{ ...box, borderColor: "#2f6f4f", color: "#2f6f4f" }}>{message}</div>
      )}
      {error && (
        <div style={{ ...box, borderColor: "#8b2f2f", color: "#8b2f2f" }}>
          <strong>Refused.</strong> {error}
        </div>
      )}

      <section style={box}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Step 1 — Review the dry run</h2>
        {!awaitingApproval && !latestApproved && (
          <p style={{ color: "#6b6b60" }}>
            No completed dry run is waiting. A dry run must finish, exhaust its window and
            produce a report before it can be approved.
          </p>
        )}

        {awaitingApproval && (
          <>
            <p style={label}>Run</p>
            <p style={{ margin: "0 0 0.75rem", fontFamily: "ui-monospace, monospace" }}>
              {awaitingApproval.id}
            </p>
            <p style={label}>Mode</p>
            <p style={{ margin: "0 0 0.75rem" }}>
              {awaitingApproval.livemode ? "LIVE" : "test"} · build{" "}
              {awaitingApproval.implementation_version}
            </p>
            <p style={label}>Window</p>
            <p style={{ margin: "0 0 0.75rem" }}>
              {new Date(awaitingApproval.window_start).toLocaleString()} —{" "}
              {new Date(awaitingApproval.window_end).toLocaleString()}
            </p>
            <p style={label}>What it examined</p>
            <p style={{ margin: "0 0 0.75rem" }}>
              {awaitingApproval.objects_scanned} objects scanned,{" "}
              {awaitingApproval.objects_matched} already matched the ledger
            </p>
            <p style={label}>What it would create</p>
            <p style={{ margin: "0 0 0.5rem" }}>
              <Money n={awaitingApproval.would_create_count} /> exception(s)
            </p>
            {awaitingApproval.prospective_by_kind && (
              <ul style={{ margin: "0 0 0.75rem", paddingLeft: "1.1rem" }}>
                {Object.entries(awaitingApproval.prospective_by_kind).map(([k, v]) => (
                  <li key={k}>
                    {k}: <strong>{v}</strong>
                  </li>
                ))}
              </ul>
            )}
            <p style={{ fontSize: 13, color: "#6b6b60", marginBottom: 0 }}>
              A dry run writes nothing. These are the findings a writing run would record.
              <br />
              <em>provider_without_ledger</em> is expected during the shadow phase — it is
              money the legacy system took, which V2 does not own.
            </p>
          </>
        )}
      </section>

      {awaitingApproval && (
        <section style={box}>
          <h2 style={{ marginTop: 0, fontSize: 17 }}>Step 2 — Approve this run</h2>
          <p style={{ fontSize: 13, color: "#6b6b60" }}>
            Your note is stored with the approval as the record of your decision. Approving
            authorises one canary against this exact run — nothing else.
          </p>
          <label htmlFor="approval-note" style={label}>
            Approval note (required)
          </label>
          <textarea
            id="approval-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. Reviewed the findings; the provider_without_ledger rows are the known legacy charges."
            style={{
              width: "100%",
              marginTop: 6,
              marginBottom: 12,
              padding: 10,
              border: "0.5px solid rgba(0,0,0,0.2)",
              borderRadius: 6,
              fontFamily: "inherit",
              fontSize: 14,
            }}
          />
          <button
            type="button"
            onClick={approve}
            disabled={busy || note.trim().length === 0}
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: 6,
              border: "none",
              background: note.trim().length === 0 ? "#c9c9c0" : "#2f6f4f",
              color: "#fff",
              fontSize: 14,
              cursor: busy || note.trim().length === 0 ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Working…" : "Approve this dry run"}
          </button>
        </section>
      )}

      {latestApproved && (
        <section style={box}>
          <h2 style={{ marginTop: 0, fontSize: 17 }}>Step 3 — Start the canary</h2>
          <p style={{ margin: "0 0 0.5rem" }}>
            Approved {new Date(latestApproved.approved_at!).toLocaleString()}
          </p>
          {latestApproved.approval_note && (
            <p style={{ margin: "0 0 0.75rem", fontStyle: "italic", color: "#4a4a42" }}>
              “{latestApproved.approval_note}”
            </p>
          )}
          <p style={{ fontSize: 13, color: "#6b6b60" }}>
            The canary is the first run that may write. It is limited to the approved window
            and to at most 24 hours, whichever is shorter.
          </p>
          <button
            type="button"
            onClick={() => startCanary(latestApproved.id)}
            disabled={busy}
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: 6,
              border: "none",
              background: "#2f4f6f",
              color: "#fff",
              fontSize: 14,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Working…" : "Start the canary"}
          </button>
        </section>
      )}

      <section style={box}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Recent runs</h2>
        {recentRuns.length === 0 && <p style={{ color: "#6b6b60" }}>No runs yet.</p>}
        {recentRuns.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#6b6b60" }}>
                <th style={{ padding: "6px 8px 6px 0" }}>Started</th>
                <th style={{ padding: "6px 8px" }}>Kind</th>
                <th style={{ padding: "6px 8px" }}>Mode</th>
                <th style={{ padding: "6px 8px" }}>Status</th>
                <th style={{ padding: "6px 8px" }}>Scanned</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((r) => (
                <tr key={r.id} style={{ borderTop: "0.5px solid rgba(0,0,0,0.08)" }}>
                  <td style={{ padding: "6px 8px 6px 0" }}>
                    {new Date(r.window_start).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "6px 8px" }}>{r.dry_run ? "dry run" : "writing"}</td>
                  <td style={{ padding: "6px 8px" }}>{r.livemode ? "LIVE" : "test"}</td>
                  <td style={{ padding: "6px 8px" }}>
                    {r.status}
                    {r.error ? ` — ${r.error}` : ""}
                  </td>
                  <td style={{ padding: "6px 8px" }}>{r.objects_scanned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
