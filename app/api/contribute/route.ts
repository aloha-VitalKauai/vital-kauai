/**
 * PR 6: the token bridge's only mutation — start (or resume) checkout.
 * Public by necessity; the high-entropy token is the credential. Invalid tokens
 * cause zero Stripe and zero mutation calls (resolve is read-only).
 */
import { NextResponse } from "next/server";
import { startCheckout } from "@/lib/finance/checkout";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let token = "";
  try {
    token = String(((await req.json()) as { token?: string }).token ?? "").trim();
  } catch { /* fall through */ }
  if (!token || token.length < 20) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  const origin = new URL(req.url).origin;
  const result = await startCheckout(token, origin);
  if (result.ok) return NextResponse.json({ url: result.url });
  const status = result.reason === "provider_unavailable" ? 503 : 409;
  return NextResponse.json({ error: result.reason }, { status });
}
