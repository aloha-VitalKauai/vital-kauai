import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/account-deletion
//
// Member-initiated account deletion request. A signed-in member taps
// "Request account deletion" in the portal; we notify staff, who remove the
// account and member data and confirm with them. Accounts are staff-
// provisioned (there is no in-app or public sign-up), so deletion is completed
// manually — this route is the in-app initiation point that App Review 5.1.1(v)
// looks for. No self-service creation means no self-service hard-delete.
const STAFF = ["joshuaperdue2@gmail.com", "aloha@vitalkauai.com"];

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { error: "We couldn't submit that just now. Please email aloha@vitalkauai.com." },
      { status: 500 },
    );
  }

  const email = user.email ?? "(no email on file)";
  const requestedAt = new Date().toISOString();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: "Vital Kauaʻi <aloha@vitalkauai.com>",
      to: STAFF,
      reply_to: email,
      subject: `Account deletion request — ${email}`,
      html:
        `<p>A member has requested deletion of their Vital Kauaʻi account.</p>` +
        `<p><strong>Member email:</strong> ${email}<br>` +
        `<strong>User ID:</strong> ${user.id}<br>` +
        `<strong>Requested:</strong> ${requestedAt}</p>` +
        `<p>Please remove their account and member data, then confirm with them by email.</p>`,
    }),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "We couldn't submit that just now. Please email aloha@vitalkauai.com." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
