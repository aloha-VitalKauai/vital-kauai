/**
 * Financials V2 — PR 3B: the Supabase implementation of `FinanceDb`.
 *
 * Every mutation goes through a D-079/D-080 SECURITY DEFINER function. Nothing
 * here UPDATEs or DELETEs a `finance` table directly, because `service_role`
 * holds no such grant — the schema is append-only to the application role, and
 * that is the enforcement rather than a convention.
 *
 * The one direct write is `INSERT` into `finance.ledger_entries`, which
 * `service_role` does hold, and which the table's own CHECK constraints (L1, L3,
 * L12, L13) validate.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  FinanceDb,
  RunStatus,
} from "@/lib/finance/reconciliation/run";
import type { LedgerRow } from "@/lib/finance/reconciliation/diff";

/** System actor for reconciliation-written rows (`finance.system_actor`). */
const RECONCILIATION_ACTOR = "reconciliation";

export function financeServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service credentials are not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Surface a PostgREST failure with its message rather than a bare null. */
function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

export function createSupabaseFinanceDb(client?: SupabaseClient): FinanceDb {
  const db = client ?? financeServiceClient();
  const fin = () => db.schema("finance");

  return {
    async startRun(a) {
      const res = await fin().rpc("start_reconciliation_run", {
        p_livemode: a.livemode,
        p_implementation_version: a.implementationVersion,
        p_window_start: a.windowStart.toISOString(),
        p_window_end: a.windowEnd.toISOString(),
        p_dry_run: a.dryRun,
        p_cursor: a.cursor ?? {},
        p_resumed_from_run_id: a.resumedFromRunId ?? null,
        p_authorized_by_run_id: a.authorizedByRunId ?? null,
      });
      return must(res, "start_reconciliation_run") as string;
    },

    async advanceRun(a) {
      must(
        await fin().rpc("advance_reconciliation_run", {
          p_run_id: a.runId,
          p_cursor: a.cursor ?? null,
          p_objects_scanned: a.objectsScanned ?? 0,
          p_objects_matched: a.objectsMatched ?? 0,
          p_api_calls: a.apiCalls ?? 0,
          p_retries: a.retries ?? 0,
          p_exceptions_created: a.exceptionsCreated ?? 0,
          p_exceptions_reopened: a.exceptionsReopened ?? 0,
        }),
        "advance_reconciliation_run",
      );
    },

    async finishRun(a) {
      must(
        await fin().rpc("finish_reconciliation_run", {
          p_run_id: a.runId,
          p_status: a.status as RunStatus,
          p_window_exhausted: a.windowExhausted ?? false,
          p_error: a.error ?? null,
          p_cursor: a.cursor ?? null,
        }),
        "finish_reconciliation_run",
      );
    },

    async recordDryRunReport(a) {
      must(
        await fin().rpc("record_dry_run_report", {
          p_run_id: a.runId,
          p_would_create_count: a.wouldCreateCount,
          p_would_reopen_count: a.wouldReopenCount,
          p_prospective_by_kind: a.prospectiveByKind,
          p_report_samples: a.reportSamples ?? null,
          p_report_version: a.reportVersion,
        }),
        "record_dry_run_report",
      );
    },

    async raiseException(a) {
      const res = await fin().rpc("raise_reconciliation_exception", {
        p_kind: a.kind,
        p_livemode: a.livemode,
        p_detail: a.detail,
        p_run_id: a.runId,
        p_provider_object_id: a.providerObjectId ?? null,
        p_ledger_entry_id: a.ledgerEntryId ?? null,
        p_agreement_id: a.agreementId ?? null,
        p_legacy_donation_id: null,
        p_amount_cents: a.amountCents ?? null,
        // The ledger is USD-only and `raise_reconciliation_exception` enforces it,
        // so forwarding the offending currency would make a `currency_violation`
        // impossible to record: the raise throws, the run fails, the window never
        // advances, and the next run re-scans the same charge and fails again —
        // one foreign-currency payment wedges reconciliation permanently. The
        // actual currency is preserved in `detail`.
        p_currency: a.currency === "usd" ? "usd" : null,
      });
      return must(res, "raise_reconciliation_exception") as string;
    },

    async writeLedgerEntry(entry) {
      // Attribution is `recorded_by_system`, never `recorded_by`: no human made
      // this entry, and `ledger_single_attribution` permits only one of the two.
      // `source` is always 'stripe' here — L13 forbids provider ids on an
      // external-sourced row, so a reconciliation entry could not be anything else.
      const res = await fin()
        .from("ledger_entries")
        .insert({
          agreement_id: entry.agreementId,
          entry_type: entry.entryType,
          amount_cents: entry.amountCents,
          currency: "usd",
          source: "stripe",
          provider_object_id: entry.providerObjectId,
          provider_payment_intent_id: entry.providerPaymentIntentId,
          parent_entry_id: entry.parentEntryId,
          occurred_at: entry.occurredAt.toISOString(),
          recorded_by_system: RECONCILIATION_ACTOR,
          livemode: entry.livemode,
        });
      if (res.error) {
        throw new Error(
          `ledger_entries insert (${entry.entryType} ${entry.providerObjectId}): ${res.error.message}`,
        );
      }
    },

    async lastCompletedWindowEnd(livemode) {
      // Only a `completed` run advances the watermark (18b); `partial`, `failed`
      // and `abandoned` deliberately do not.
      const res = await fin()
        .from("reconciliation_runs")
        .select("window_end")
        .eq("livemode", livemode)
        .eq("status", "completed")
        .eq("dry_run", false)
        .order("window_end", { ascending: false })
        .limit(1)
        .returns<{ window_end: string }[]>();
      const rows = must(res, "lastCompletedWindowEnd") ?? [];
      return rows.length ? new Date(rows[0].window_end) : null;
    },

    async earliestLedgerOccurredAt(livemode) {
      const res = await fin()
        .from("ledger_entries")
        .select("occurred_at")
        .eq("livemode", livemode)
        .order("occurred_at", { ascending: true })
        .limit(1)
        .returns<{ occurred_at: string }[]>();
      const rows = must(res, "earliestLedgerOccurredAt") ?? [];
      return rows.length ? new Date(rows[0].occurred_at) : null;
    },

    async ledgerForWindow(a): Promise<LedgerRow[]> {
      // The window is widened by nothing here: matching is by identity, so a row
      // outside the window simply is not a candidate. Widening would invite the
      // heuristic matching acceptance 21 forbids.
      const res = await fin()
        .from("ledger_entries")
        .select(
          "id, agreement_id, entry_type, amount_cents, provider_object_id, provider_payment_intent_id, livemode",
        )
        .eq("livemode", a.livemode)
        .gte("occurred_at", a.windowStart.toISOString())
        .lt("occurred_at", a.windowEnd.toISOString())
        .returns<
          {
            id: string;
            agreement_id: string;
            entry_type: LedgerRow["entryType"];
            amount_cents: number;
            provider_object_id: string | null;
            provider_payment_intent_id: string | null;
            livemode: boolean;
          }[]
        >();
      return (must(res, "ledgerForWindow") ?? []).map((r) => ({
        id: r.id,
        agreementId: r.agreement_id,
        entryType: r.entry_type,
        amountCents: r.amount_cents,
        providerObjectId: r.provider_object_id,
        providerPaymentIntentId: r.provider_payment_intent_id,
        livemode: r.livemode,
      }));
    },

    async openExceptionSubjects(livemode) {
      const res = await fin()
        .from("reconciliation_exceptions")
        .select("kind, provider_object_id")
        .eq("livemode", livemode)
        .eq("resolution_status", "open")
        .not("provider_object_id", "is", null)
        .returns<{ kind: string; provider_object_id: string }[]>();
      return (must(res, "openExceptionSubjects") ?? []).map(
        (r) => `${r.kind}:${r.provider_object_id}`,
      );
    },

    async quarantinedObjectIds(livemode) {
      // Actively quarantined means quarantined and not since released. A released
      // object returns to normal processing (18e), so filtering on
      // `quarantined_at` alone would keep skipping it forever.
      const res = await fin()
        .from("reconciliation_exceptions")
        .select("provider_object_id")
        .eq("livemode", livemode)
        .not("quarantined_at", "is", null)
        .is("released_at", null)
        .not("provider_object_id", "is", null)
        .returns<{ provider_object_id: string }[]>();
      return new Set((must(res, "quarantinedObjectIds") ?? []).map((r) => r.provider_object_id));
    },
  };
}
