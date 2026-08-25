/**
 * PR 8 (D-085): POST /api/finance/member-checkout.
 *
 * Identity comes ONLY from the caller's Supabase session — the body carries no
 * member id, email or role, and a Contribution request that tries to smuggle an
 * amount is rejected outright: the database derives the full payable remaining
 * under lock. Ownership failures return 404 (indistinguishable from a missing
 * id) so agreement ids cannot be enumerated. Issuance is fail-closed behind
 * FINANCE_V2_CHECKOUT_READY; reads elsewhere never depend on that flag.
 */

import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import {
  startMemberCheckout,
  cancelMemberGiftCheckout,
  GIFT_MIN_CENTS,
  GIFT_MAX_CENTS,
  type MemberCheckoutRefusal,
} from "@/lib/finance/member-checkout";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REFUSAL_STATUS: Record<MemberCheckoutRefusal, number> = {
  not_found: 404,
  invalid_request: 400,
  not_active: 409,
  nothing_payable: 409,
  already_received: 409,
  gift_in_progress: 409,
  amount_changed: 409,
  stale_attempt: 409,
  provider_unavailable: 502,
  conflict: 409,
};

/**
 * Bounded confirmation polling: the member's own session reads their own
 * attempt through member_checkout_status (RLS + view boundary scope it).
 * Only the opaque V2 attempt id and its presentation-safe status are exposed.
 */
export async function GET(req: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const attemptId = new URL(req.url).searchParams.get("attempt") ?? "";
  if (!UUID_RE.test(attemptId)) {
    return NextResponse.json({ error: "attempt_required" }, { status: 400 });
  }
  const { data, error } = await supabase.schema("finance_api")
    .from("member_checkout_status")
    .select("attempt_id, status, completed_at")
    .eq("attempt_id", attemptId)
    .returns<{ attempt_id: string; status: string; completed_at: string | null }[]>();
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const row = data?.[0];
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ status: row.status, completedAt: row.completed_at });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  if (process.env.FINANCE_V2_CHECKOUT_READY !== "true") {
    return NextResponse.json({ error: "checkout_unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Canceling needs no intent id: it resolves the caller's OWN live gift
  // attempt server-side from their authenticated email, confirms the Session
  // is dead at Stripe first, and never touches a paid session.
  if (body.kind === "cancel_gift") {
    if (!user.email) return NextResponse.json({ error: "conflict" }, { status: 409 });
    const result = await cancelMemberGiftCheckout(user.email);
    if (!result.ok) {
      const status =
        result.reason === "nothing_to_cancel" ? 404 :
        result.reason === "already_received" ? 409 :
        result.reason === "provider_unavailable" ? 502 : 409;
      return NextResponse.json({ error: result.reason }, { status });
    }
    return NextResponse.json({ ok: true, canceled: result.canceled });
  }

  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  if (!UUID_RE.test(requestId)) {
    return NextResponse.json({ error: "request_id_required" }, { status: 400 });
  }
  const origin = new URL(req.url).origin;

  if (body.kind === "contribution") {
    // The browser cannot submit or alter a Contribution amount — any amount
    // property is a hard refusal, not a value to ignore.
    if ("amountCents" in body || "amount" in body || "amount_cents" in body) {
      return NextResponse.json({ error: "amount_not_accepted" }, { status: 400 });
    }
    const agreementId = typeof body.agreementId === "string" ? body.agreementId : "";
    if (!UUID_RE.test(agreementId)) {
      return NextResponse.json({ error: "agreement_id_required" }, { status: 400 });
    }
    const result = await startMemberCheckout(
      supabase,
      { kind: "contribution", agreementId, requestId },
      origin,
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason, retryWithNewRequest: result.retryWithNewRequest ?? false },
        { status: REFUSAL_STATUS[result.reason] },
      );
    }
    return NextResponse.json({ ok: true, url: result.url, attemptId: result.attemptId });
  }

  if (body.kind === "additional_gift") {
    const amountCents = body.amountCents;
    if (
      typeof amountCents !== "number" || !Number.isSafeInteger(amountCents) ||
      amountCents < GIFT_MIN_CENTS || amountCents > GIFT_MAX_CENTS || amountCents % 100 !== 0
    ) {
      return NextResponse.json({ error: "invalid_gift_amount" }, { status: 400 });
    }
    const result = await startMemberCheckout(
      supabase,
      { kind: "additional_gift", amountCents, requestId },
      origin,
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason, retryWithNewRequest: result.retryWithNewRequest ?? false },
        { status: REFUSAL_STATUS[result.reason] },
      );
    }
    return NextResponse.json({ ok: true, url: result.url, attemptId: result.attemptId });
  }

  return NextResponse.json({ error: "unknown_kind" }, { status: 400 });
}
