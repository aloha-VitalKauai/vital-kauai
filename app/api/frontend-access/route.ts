import { NextResponse } from "next/server";
import {
  FRONTEND_ACCESS_COOKIE,
  FRONTEND_ACCESS_MAX_AGE_SECONDS,
  secretsMatch,
  signFrontendAccessToken,
} from "@/lib/frontend-access";

// The one and only place the shared front-end credentials are compared, and it
// runs on the server. The login form POSTs the typed email/password here before
// it touches Supabase. On a match we set a signed, HTTP-only cookie and tell the
// client to go to the public homepage; the special password never reaches
// Supabase and no member session is created. On anything else we return a
// generic { ok: false } — identical whether the email was the special one with a
// wrong password or any other email — so the special identity is never revealed.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const email = process.env.FRONTEND_ACCESS_EMAIL;
  const password = process.env.FRONTEND_ACCESS_PASSWORD;
  const secret = process.env.FRONTEND_ACCESS_COOKIE_SECRET;

  // Feature is inert unless fully configured. Fall through to member login.
  if (!email || !password || !secret) {
    return NextResponse.json({ ok: false });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false });
  }

  const submittedEmail =
    body && typeof (body as { email?: unknown }).email === "string"
      ? ((body as { email: string }).email)
      : "";
  const submittedPassword =
    body && typeof (body as { password?: unknown }).password === "string"
      ? ((body as { password: string }).password)
      : "";

  // Compare both fields in constant time; evaluate both regardless of the first
  // result so a matching-email / wrong-password attempt is indistinguishable
  // from a wrong-email attempt.
  const emailOk = await secretsMatch(
    submittedEmail.trim().toLowerCase(),
    email.trim().toLowerCase(),
  );
  const passwordOk = await secretsMatch(submittedPassword, password);

  if (!emailOk || !passwordOk) {
    return NextResponse.json({ ok: false });
  }

  const expiryMs = Date.now() + FRONTEND_ACCESS_MAX_AGE_SECONDS * 1000;
  const token = await signFrontendAccessToken(secret, expiryMs);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(FRONTEND_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: FRONTEND_ACCESS_MAX_AGE_SECONDS,
  });
  return response;
}
