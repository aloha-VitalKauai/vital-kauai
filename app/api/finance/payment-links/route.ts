/**
 * PR 6: founder link issuance, status and revocation.
 *
 * Founder session only; the amount is computed inside issue_payment_link from
 * the canonical view. The raw token exists only in this response — the database
 * holds its hash. Issuance sits behind FINANCE_V2_CHECKOUT_READY (fail closed)
 * per the rollout sequence; revocation and status are always available.
 */

import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { generateLinkToken, hashLinkToken } from "@/lib/finance/checkout";

export const runtime = "nodejs";

async function requireFounder() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "not_authenticated" };
  const { data: isFounder, error } = await supabase.rpc("is_founder");
  if (error) return { ok: false as const, status: 500, error: "founder_check_failed" };
  if (isFounder !== true) return { ok: false as const, status: 403, error: "founder_required" };
  return { ok: true as const, supabase };
}

export async function GET(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const agreementId = new URL(req.url).searchParams.get("agreementId")?.trim();
  if (!agreementId) return NextResponse.json({ error: "agreement_id_required" }, { status: 400 });
  const fin = auth.supabase.schema("finance_api");
  const [links, sessions] = await Promise.all([
    fin.from("payment_links").select("*").eq("agreement_id", agreementId)
      .order("created_at", { ascending: false }).limit(5),
    fin.from("founder_checkout_sessions").select("*").eq("agreement_id", agreementId)
      .order("created_at", { ascending: false }).limit(5),
  ]);
  return NextResponse.json({ links: links.data ?? [], sessions: sessions.data ?? [] });
}

type Body =
  | { action: "issue"; agreementId: string; reason: string; email: boolean }
  | { action: "revoke"; linkId: string };

export async function POST(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: Body;
  try { body = (await req.json()) as Body; } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const fin = auth.supabase.schema("finance_api");

  if (body.action === "revoke") {
    const { error } = await fin.rpc("revoke_payment_link", { p_link_id: body.linkId });
    if (error) return NextResponse.json({ error: "refused", detail: error.message }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  if (body.action !== "issue") return NextResponse.json({ error: "unknown_action" }, { status: 400 });

  // Rollout gate: fail closed until the controlled live exercise passes.
  if (process.env.FINANCE_V2_CHECKOUT_READY !== "true") {
    return NextResponse.json({ error: "checkout_not_enabled" }, { status: 503 });
  }
  const reason = body.reason?.trim();
  if (!reason) return NextResponse.json({ error: "reason_required" }, { status: 400 });

  // The raw token is generated here, hashed for storage, returned exactly once.
  const token = generateLinkToken();
  const { data, error } = await fin.rpc("issue_payment_link", {
    p_agreement_id: body.agreementId,
    p_token_hash: hashLinkToken(token),
    p_reason: reason,
  });
  if (error) return NextResponse.json({ error: "refused", detail: error.message }, { status: 409 });
  const row = (data as unknown as { link_id: string; amount_cents: number; expires_at: string }[] | null)?.[0];
  if (!row) return NextResponse.json({ error: "issue_failed" }, { status: 500 });

  const url = `https://vitalkauai.com/contribute/${token}`;
  let emailed = false;
  let emailError: string | null = null;
  if (body.email) {
    try {
      const sent = await sendLinkEmail(auth.supabase, body.agreementId, url, row.amount_cents, row.expires_at);
      emailed = sent.ok;
      emailError = sent.ok ? null : sent.error;
    } catch (e) {
      emailError = e instanceof Error ? e.message : String(e);
    }
  }
  // Truthful partial success (proof #25): the link is live either way.
  return NextResponse.json({
    ok: true, linkId: row.link_id, url,
    amountCents: row.amount_cents, expiresAt: row.expires_at,
    emailed, emailError,
  });
}

async function sendLinkEmail(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  agreementId: string, url: string, amountCents: number, expiresAt: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "email is not configured" };
  const { data: bal } = await supabase.schema("finance_api")
    .from("agreement_balances").select("member_id").eq("agreement_id", agreementId)
    .returns<{ member_id: string }[]>();
  const memberId = bal?.[0]?.member_id;
  if (!memberId) return { ok: false, error: "member not found" };
  const { data: prof } = await supabase.from("member_profiles")
    .select("email, full_name").eq("id", memberId)
    .returns<{ email: string | null; full_name: string | null }[]>();
  const to = prof?.[0]?.email;
  if (!to) return { ok: false, error: "member has no email" };
  const amount = (amountCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const expires = new Date(expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Vital Kauaʻi <notifications@vitalkauai.com>",
      to: [to],
      subject: "Your secure contribution link—Vital Kauaʻi",
      html: `<p>Aloha${prof?.[0]?.full_name ? ` ${prof[0].full_name}` : ""},</p>
<p>Here is your secure, single-use link to complete your contribution of <strong>${amount}</strong>:</p>
<p><a href="${url}">${url}</a></p>
<p>This link expires on ${expires}. Payment is processed securely by Stripe; Vital Kauaʻi never sees your card details.</p>
<p>With aloha,<br/>Vital Kauaʻi</p>`,
    }),
  });
  if (!res.ok) return { ok: false, error: `email send failed (${res.status})` };
  return { ok: true };
}
