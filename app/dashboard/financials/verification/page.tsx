/**
 * Financials V2 — PR 4: the founder's Financial Verification workspace.
 *
 * Canonical V2 state, not a diff. D-082: no trustworthy historical financial
 * reference survives D-077/D-078 — PR 2's importer and variance report were never
 * built, the retired tables are empty and frozen, the audit log records money
 * that never moved, and bookings record intentions rather than receipts. So this
 * page deliberately renders NO retired-reference and NO legacy-delta column, and
 * opens with a clean-start banner instead. A permanently "unavailable" column
 * would be visual noise that no later PR ever fills.
 *
 * Reads run on the founder's own session through `finance_api` (security_invoker
 * views over RLS-forced tables), so a non-founder sees nothing — enforced by
 * Postgres, not this file. Resolution and release go through
 * `finance.resolve_exception()` / `finance.release_quarantine()` via the façade;
 * actor and timestamp are database-generated.
 *
 * The polished Financials dashboard remains PR 7; the member portal is PR 8.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VerificationQueue from "./VerificationQueue";

export const metadata = { title: "Financial Verification—Vital Kauaʻi" };
export const dynamic = "force-dynamic";

type MemberPosition = {
  member_id: string;
  agreement_count: number;
  contribution_cents: number;
  gross_received_cents: number;
  refunded_cents: number;
  net_received_cents: number;
  remaining_cents: number;
  payable_remaining_cents: number;
};

type JourneyPosition = Omit<MemberPosition, "member_id"> & { journey_id: string };

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

type RunRow = {
  id: string;
  livemode: boolean;
  dry_run: boolean;
  status: string;
  window_start: string;
  window_end: string;
  window_exhausted: boolean;
  started_at: string;
  finished_at: string | null;
  objects_scanned: number;
  exceptions_created: number;
  error: string | null;
};

const box: React.CSSProperties = {
  background: "#fff",
  border: "0.5px solid rgba(0,0,0,0.12)",
  borderRadius: 8,
  padding: "1.25rem 1.5rem",
  marginBottom: "1.25rem",
};

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function VerificationPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isFounder } = await supabase.rpc("is_founder");
  if (isFounder !== true) {
    return (
      <main style={{ padding: "2rem", maxWidth: 760 }}>
        <h1 style={{ fontSize: 20 }}>Financial Verification</h1>
        <p style={{ color: "#6b6b60" }}>This page is limited to founders.</p>
      </main>
    );
  }

  // All reads on the founder session; failures render rather than 500 so a
  // partial outage still shows what it can.
  const fin = supabase.schema("finance_api");
  const [membersRes, journeysRes, exceptionsRes, runsRes] = await Promise.all([
    fin.from("member_financials").select("*").returns<MemberPosition[]>(),
    fin.from("journey_financials").select("*").returns<JourneyPosition[]>(),
    fin
      .from("reconciliation_exceptions")
      .select(
        "id, kind, provider_object_id, livemode, amount_cents, currency, detail, " +
          "first_detected_at, last_detected_at, occurrence_count, consecutive_failure_runs, " +
          "quarantined_at, quarantine_reason, released_at, resolution_status, resolved_at, resolution_note",
      )
      .order("last_detected_at", { ascending: false })
      .limit(200)
      .returns<ExceptionRow[]>(),
    fin
      .from("reconciliation_runs")
      .select(
        "id, livemode, dry_run, status, window_start, window_end, window_exhausted, " +
          "started_at, finished_at, objects_scanned, exceptions_created, error",
      )
      .order("started_at", { ascending: false })
      .limit(15)
      .returns<RunRow[]>(),
  ]);

  const members = membersRes.data ?? [];
  const journeys = journeysRes.data ?? [];
  const exceptions = exceptionsRes.data ?? [];
  const runs = runsRes.data ?? [];
  const loadErrors = [membersRes, journeysRes, exceptionsRes, runsRes]
    .map((r) => r.error?.message)
    .filter(Boolean) as string[];

  // Display names, joined under the same founder session. Identity only — the
  // financial figures never key on names (acceptance 21 applies to display too).
  const memberIds = members.map((m) => m.member_id);
  const nameById = new Map<string, string>();
  if (memberIds.length > 0) {
    const { data: profiles } = await supabase
      .from("member_profiles")
      .select("id, full_name, email")
      .in("id", memberIds)
      .returns<{ id: string; full_name: string | null; email: string | null }[]>();
    for (const p of profiles ?? []) {
      nameById.set(p.id, p.full_name || p.email || p.id.slice(0, 8));
    }
  }

  // ── Health, derived from what is actually exposed ──────────────────────────
  const lastCompleted = runs.find((r) => r.status === "completed");
  const runningRun = runs.find((r) => r.status === "running");
  const lastFailed = runs.find((r) => r.status === "failed");
  const openExceptions = exceptions.filter((e) => e.resolution_status === "open");
  const quarantined = openExceptions.filter((e) => e.quarantined_at && !e.released_at);
  const liveUnattributed = openExceptions.filter(
    (e) => e.kind === "unattributable_payment" && e.livemode,
  );

  const healthProblems: string[] = [];
  if (lastFailed && (!lastCompleted || lastFailed.started_at > lastCompleted.started_at)) {
    healthProblems.push(`the most recent finished run failed: ${lastFailed.error ?? "no error text"}`);
  }
  if (liveUnattributed.length > 0) {
    healthProblems.push(`${liveUnattributed.length} unattributed LIVE payment(s) open`);
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 980 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Financial Verification</h1>
      <p style={{ color: "#6b6b60", marginTop: 0, marginBottom: "1.25rem", fontSize: 14 }}>
        Canonical Financials V2 state, and the reconciliation between Stripe and the V2
        ledger.
      </p>

      {/* Clean-start banner — D-082. */}
      <section
        style={{
          ...box,
          background: "#f4f7f5",
          borderColor: "#2f6f4f",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 6, fontSize: 16, color: "#2f6f4f" }}>
          Financials V2 began from a clean state
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "#3a4a40" }}>
          No verified historical payments were imported. Financial activity shown here
          begins with Financials V2. Retired records remain preserved only as forensic
          audit evidence.
        </p>
      </section>

      {loadErrors.length > 0 && (
        <section style={{ ...box, borderColor: "#8b2f2f", color: "#8b2f2f" }}>
          <strong>Some data failed to load.</strong> {loadErrors.join(" · ")}
        </section>
      )}

      {/* System health */}
      <section style={box}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Reconciliation health</h2>
        {healthProblems.length === 0 ? (
          <p style={{ margin: "0 0 0.75rem", color: "#2f6f4f" }}>
            No problems needing attention.
          </p>
        ) : (
          <ul style={{ margin: "0 0 0.75rem", paddingLeft: "1.1rem", color: "#8b2f2f" }}>
            {healthProblems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <p style={{ margin: 0, fontSize: 13, color: "#6b6b60" }}>
          Last completed run:{" "}
          {lastCompleted
            ? `${new Date(lastCompleted.started_at).toLocaleString()} (${lastCompleted.dry_run ? "dry run" : "writing"}, ${lastCompleted.livemode ? "LIVE" : "test"}, ${lastCompleted.objects_scanned} objects)`
            : "none yet"}
          {runningRun ? ` · a ${runningRun.dry_run ? "dry" : "writing"} run is in flight` : ""}
          {` · ${openExceptions.length} open exception(s) · ${quarantined.length} quarantined`}
        </p>
      </section>

      {/* V2 member positions — no legacy columns, per D-082 */}
      <section style={box}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Member positions (V2)</h2>
        {members.length === 0 ? (
          <p style={{ color: "#6b6b60", margin: 0 }}>
            No V2 agreements yet. Positions appear when the first agreement is created
            (PR 5) or the first attributed payment is reconciled.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#6b6b60" }}>
                <th style={{ padding: "6px 8px 6px 0" }}>Member</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Contribution</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Received (net)</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Refunded</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.member_id} style={{ borderTop: "0.5px solid rgba(0,0,0,0.08)" }}>
                  <td style={{ padding: "6px 8px 6px 0" }}>
                    {nameById.get(m.member_id) ?? m.member_id.slice(0, 8)}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{usd(m.contribution_cents)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{usd(m.net_received_cents)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{usd(m.refunded_cents)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{usd(m.remaining_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* V2 journey positions */}
      <section style={box}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Journey positions (V2)</h2>
        {journeys.length === 0 ? (
          <p style={{ color: "#6b6b60", margin: 0 }}>No journey-linked agreements yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#6b6b60" }}>
                <th style={{ padding: "6px 8px 6px 0" }}>Journey</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Contribution</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Received (net)</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {journeys.map((j) => (
                <tr key={j.journey_id} style={{ borderTop: "0.5px solid rgba(0,0,0,0.08)" }}>
                  <td style={{ padding: "6px 8px 6px 0", fontFamily: "ui-monospace, monospace" }}>
                    {j.journey_id.slice(0, 8)}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{usd(j.contribution_cents)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{usd(j.net_received_cents)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{usd(j.remaining_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Exceptions queue + quarantine, with controls */}
      <VerificationQueue exceptions={exceptions} />

      {/* Recent runs */}
      <section style={box}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Recent reconciliation runs</h2>
        {runs.length === 0 ? (
          <p style={{ color: "#6b6b60", margin: 0 }}>No runs yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#6b6b60" }}>
                <th style={{ padding: "6px 8px 6px 0" }}>Started</th>
                <th style={{ padding: "6px 8px" }}>Kind</th>
                <th style={{ padding: "6px 8px" }}>Mode</th>
                <th style={{ padding: "6px 8px" }}>Status</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Scanned</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Exceptions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} style={{ borderTop: "0.5px solid rgba(0,0,0,0.08)" }}>
                  <td style={{ padding: "6px 8px 6px 0" }}>
                    {new Date(r.started_at).toLocaleString()}
                  </td>
                  <td style={{ padding: "6px 8px" }}>{r.dry_run ? "dry run" : "writing"}</td>
                  <td style={{ padding: "6px 8px" }}>{r.livemode ? "LIVE" : "test"}</td>
                  <td style={{ padding: "6px 8px" }}>
                    {r.status}
                    {r.error ? `—${r.error}` : ""}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{r.objects_scanned}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{r.exceptions_created}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
