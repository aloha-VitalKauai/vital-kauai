/**
 * PR 6: founder link issuance, status and revocation.
 *
 * Founder session only; the amount is computed inside issue_payment_link from
 * the canonical view. PR 10B (D-090): the founder may name a chosen amount —
 * checked here for shape only, then capped by the database against the live
 * payable remaining under lock; omitted means the full remaining, as before.
 * PR 10E (D-092): the card processing fee is derived by the database from the
 * policy in force at issuance. The browser may not send a fee, a total or a
 * policy — a body carrying any of them is refused outright, mirroring the
 * D-088 public-support guard. The founder's preview (`GET
 * ?quoteContributionCents=`) is quoted on the server from the database's own
 * fee settings through the display-only twin of the one fee formula; it is
 * never computed in the browser and never sent back to the database.
 * The raw token exists only in this response — the database holds its hash.
 * Issuance sits behind FINANCE_V2_CHECKOUT_READY (fail closed) per the rollout
 * sequence; revocation and status are always available.
 */

import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { generateLinkToken, hashLinkToken, parseCollectionAmountCents } from "@/lib/finance/checkout";
import { quoteProcessingFee } from "@/lib/finance/public-support-fees";

export const runtime = "nodejs";

/**
 * Any of these in an issue body is an attempt to do the server's fee math. The
 * fee is mandatory once enabled and always database-derived, so a smuggled fee,
 * total or policy is refused before any RPC is made (D-092 criterion 6).
 */
export const FORBIDDEN_KEYS = [
  "feeCents", "fee_cents",
  "feeBps", "fee_bps",
  "totalCents", "total_cents",
  "processingFeeCents", "processing_fee_cents",
  "feePolicyVersion", "fee_policy_version",
];

type FeeSettingsRow = {
  fee_enabled: boolean; fee_bps: number; fee_fixed_cents: number; fee_policy_version: string;
};

type LinkRow = {
  id: string; agreement_id: string; status: string; expires_at: string;
  amount_cents: number | null;
  fee_bps: number | null; fee_fixed_cents: number | null; fee_policy_version: string | null;
  [key: string]: unknown;
};

async function requireFounder() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "not_authenticated" };
  const { data: isFounder, error } = await supabase.rpc("is_founder");
  if (error) return { ok: false as const, status: 500, error: "founder_check_failed" };
  if (isFounder !== true) return { ok: false as const, status: 403, error: "founder_required" };
  return { ok: true as const, supabase };
}

/**
 * The link's charge as the drawer and the link strip show it: the display-only
 * twin of the one formula, fed with a snapshot the database wrote. No snapshot
 * means no fee; a snapshot with nothing to quote against (nothing payable)
 * yields null figures rather than a zero.
 */
function chargeForLink(
  link: LinkRow, payableRemainingCents: number | null,
): { processing_fee_cents: number | null; total_cents: number | null } {
  const contribution = link.amount_cents ?? payableRemainingCents;
  if (link.fee_bps === null || link.fee_fixed_cents === null || link.fee_policy_version === null) {
    return contribution !== null && contribution > 0
      ? { processing_fee_cents: 0, total_cents: contribution }
      : { processing_fee_cents: null, total_cents: null };
  }
  if (contribution === null || !Number.isSafeInteger(contribution) || contribution <= 0) {
    return { processing_fee_cents: null, total_cents: null };
  }
  try {
    const q = quoteProcessingFee(contribution, {
      feeBps: link.fee_bps, feeFixedCents: link.fee_fixed_cents, feePolicyVersion: link.fee_policy_version,
    });
    return { processing_fee_cents: q.processingFeeCents, total_cents: q.totalCents };
  } catch {
    return { processing_fee_cents: null, total_cents: null };
  }
}

export async function GET(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const params = new URL(req.url).searchParams;
  const fin = auth.supabase.schema("finance_api");

  // PR 10E: the Collect drawer's preview. Founder-gated, reads the policy in
  // force, writes nothing, touches Stripe never. No settings row → no quote.
  const quoteRaw = params.get("quoteContributionCents");
  if (quoteRaw !== null) {
    const contribution = /^\d{1,16}$/.test(quoteRaw.trim()) ? Number(quoteRaw.trim()) : NaN;
    const parsed = parseCollectionAmountCents(contribution);
    if (!parsed.ok || parsed.amountCents === null) {
      return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
    }
    const { data, error } = await fin.from("fee_settings")
      .select("fee_enabled, fee_bps, fee_fixed_cents, fee_policy_version").limit(1)
      .returns<FeeSettingsRow[]>();
    const settings = data?.[0];
    if (error || !settings) {
      return NextResponse.json({ error: "fee_settings_unavailable" }, { status: 503 });
    }
    if (!settings.fee_enabled) {
      return NextResponse.json({
        ok: true, feeEnabled: false,
        quote: { contributionCents: parsed.amountCents, processingFeeCents: 0, totalCents: parsed.amountCents, feePolicyVersion: null },
      });
    }
    const quote = quoteProcessingFee(parsed.amountCents, {
      feeBps: settings.fee_bps, feeFixedCents: settings.fee_fixed_cents, feePolicyVersion: settings.fee_policy_version,
    });
    return NextResponse.json({ ok: true, feeEnabled: true, quote });
  }

  const agreementId = params.get("agreementId")?.trim();
  if (!agreementId) return NextResponse.json({ error: "agreement_id_required" }, { status: 400 });
  const [links, sessions, balance] = await Promise.all([
    fin.from("payment_links").select("*").eq("agreement_id", agreementId)
      .order("created_at", { ascending: false }).limit(5).returns<LinkRow[]>(),
    fin.from("founder_checkout_sessions").select("*").eq("agreement_id", agreementId)
      .order("created_at", { ascending: false }).limit(5),
    fin.from("agreement_balances").select("payable_remaining_cents").eq("agreement_id", agreementId)
      .returns<{ payable_remaining_cents: number | null }[]>(),
  ]);
  // The strip shows what a live link will charge. Unknown payable remaining
  // (a failed read) yields null figures, never a zero.
  const payable = balance.error ? null : (balance.data?.[0]?.payable_remaining_cents ?? null);
  const enriched = (links.data ?? []).map((l) => ({ ...l, ...chargeForLink(l, payable) }));
  return NextResponse.json({ links: enriched, sessions: sessions.data ?? [] });
}

type Body =
  | { action: "issue"; agreementId: string; reason: string; email: boolean; amountCents?: number }
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

  // D-092 criterion 6: the browser cannot do fee math. Refused before any RPC.
  if (body && typeof body === "object" && FORBIDDEN_KEYS.some((k) => k in (body as object))) {
    return NextResponse.json({ error: "amount_math_not_accepted" }, { status: 400 });
  }

  // Rollout gate: fail closed until the controlled live exercise passes.
  if (process.env.FINANCE_V2_CHECKOUT_READY !== "true") {
    return NextResponse.json({ error: "checkout_not_enabled" }, { status: 503 });
  }
  const reason = body.reason?.trim();
  if (!reason) return NextResponse.json({ error: "reason_required" }, { status: 400 });
  // A chosen amount is refused for shape here, before any RPC (D-090). Whether
  // it is within the live payable remaining is the database's decision.
  const chosen = parseCollectionAmountCents(body.amountCents);
  if (!chosen.ok) return NextResponse.json({ error: chosen.reason }, { status: 400 });
  const amountCents = chosen.amountCents;

  // The raw token is generated here, hashed for storage, returned exactly once.
  // p_amount_cents is forwarded only when the founder supplied one; omitted, the
  // database default (NULL = the full payable remaining) applies.
  const token = generateLinkToken();
  const args: Record<string, unknown> = {
    p_agreement_id: body.agreementId,
    p_token_hash: hashLinkToken(token),
    p_reason: reason,
  };
  if (amountCents !== null) args.p_amount_cents = amountCents;
  const { data, error } = await fin.rpc("issue_payment_link", args);
  if (error) return NextResponse.json({ error: "refused", detail: error.message }, { status: 409 });
  const row = (data as unknown as {
    link_id: string; amount_cents: number; expires_at: string;
    processing_fee_cents: number; total_cents: number;
  }[] | null)?.[0];
  if (!row) return NextResponse.json({ error: "issue_failed" }, { status: 500 });
  // The database states the charge in three figures; anything else is a refusal.
  if (
    !Number.isSafeInteger(row.processing_fee_cents) || row.processing_fee_cents < 0 ||
    !Number.isSafeInteger(row.total_cents) || row.amount_cents + row.processing_fee_cents !== row.total_cents
  ) {
    return NextResponse.json({ error: "issue_failed" }, { status: 500 });
  }

  const url = `https://vitalkauai.com/contribute/${token}`;
  let emailed = false;
  let emailError: string | null = null;
  if (body.email) {
    try {
      const sent = await sendLinkEmail(auth.supabase, body.agreementId, url, row.amount_cents, row.processing_fee_cents, row.total_cents, row.expires_at);
      emailed = sent.ok;
      emailError = sent.ok ? null : sent.error;
    } catch (e) {
      emailError = e instanceof Error ? e.message : String(e);
    }
  }
  // Truthful partial success (proof #25): the link is live either way.
  return NextResponse.json({
    ok: true, linkId: row.link_id, url,
    amountCents: row.amount_cents, processingFeeCents: row.processing_fee_cents, totalCents: row.total_cents,
    expiresAt: row.expires_at,
    emailed, emailError,
  });
}

async function sendLinkEmail(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  agreementId: string, url: string, amountCents: number, processingFeeCents: number, totalCents: number, expiresAt: string,
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
  const usd = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const amount = usd(amountCents);
  const expires = new Date(expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  // D-092 L: the email states the same split the bridge and Stripe will show.
  const feeSentence = processingFeeCents > 0
    ? `<p>A card processing fee of <strong>${usd(processingFeeCents)}</strong> is added at checkout, so the total charged to your card is <strong>${usd(totalCents)}</strong>. Your full contribution of ${amount} reaches Vital Kauaʻi.</p>\n`
    : "";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Vital Kauaʻi <notifications@vitalkauai.com>",
      to: [to],
      subject: "Your secure contribution link—Vital Kauaʻi",
      html: `<p>Aloha${prof?.[0]?.full_name ? ` ${prof[0].full_name}` : ""},</p>
<p>Here is your secure, single-use link for your contribution payment of <strong>${amount}</strong>:</p>
<p><a href="${url}">${url}</a></p>
${feeSentence}<p>This link expires on ${expires}. Payment is processed securely by Stripe; Vital Kauaʻi never sees your card details.</p>
<p>With aloha,<br/>Vital Kauaʻi</p>`,
    }),
  });
  if (!res.ok) return { ok: false, error: `email send failed (${res.status})` };
  return { ok: true };
}
