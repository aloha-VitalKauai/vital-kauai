import { NextResponse } from "next/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface ReconciliationCheck {
  check_name: string;
  passed: boolean;
  failure_count: number;
  details: unknown;
}

/**
 * Daily reconciliation. Runs `fn_reconcile_financial_state()` and emails
 * the founder if any invariant has failed.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. We accept
 * either that header OR an explicit `?secret=...` query param (handy for
 * manually triggering during ops).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set");
    return NextResponse.json({ error: "cron_not_configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const headerAuth = req.headers.get("authorization");
  const querySecret = url.searchParams.get("secret");
  const authorized =
    headerAuth === `Bearer ${secret}` || querySecret === secret;
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const service = createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await service.rpc("fn_reconcile_financial_state");
  if (error) {
    console.error("reconciliation rpc failed", error);
    return NextResponse.json(
      { error: "reconciliation_failed", details: error.message },
      { status: 500 },
    );
  }

  const checks = (data ?? []) as ReconciliationCheck[];
  const failures = checks.filter((c) => !c.passed);
  const allPassed = failures.length === 0;

  if (!allPassed) {
    await emailFounderOnFailure(failures);
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    allPassed,
    checks,
  });
}

async function emailFounderOnFailure(failures: ReconciliationCheck[]) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("RESEND_API_KEY missing — skipping reconciliation email");
    return;
  }
  const founderEmail =
    process.env.FOUNDER_EMAIL ?? "aloha@vitalkauai.com";

  const failureList = failures
    .map(
      (f) =>
        `<li><b>${escapeHtml(f.check_name)}</b>: ${f.failure_count} failure${
          f.failure_count === 1 ? "" : "s"
        }<pre style="background:#f4f4f0;padding:8px;font-size:12px;overflow:auto;">${escapeHtml(
          JSON.stringify(f.details, null, 2),
        )}</pre></li>`,
    )
    .join("");

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Vital Kauaʻi <notifications@vitalkauai.com>",
        to: [founderEmail],
        subject: `[Vital Kauaʻi] Financial reconciliation failed (${failures.length} check${
          failures.length === 1 ? "" : "s"
        })`,
        html: `
          <p>Daily reconciliation detected drift in financial state.</p>
          <ul>${failureList}</ul>
          <p>Run <code>SELECT * FROM fn_reconcile_financial_state();</code> in Supabase to investigate, then check <code>audit_log</code> for who did what.</p>
        `,
      }),
    });
  } catch (err) {
    console.error("reconciliation email send failed", err);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
