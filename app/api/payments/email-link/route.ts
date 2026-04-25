import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

/**
 * POST /api/payments/email-link
 * Body: { commitment_id: string }
 *
 * Founder-only. Mints a fresh single-use payment token (same shape
 * as /api/payments/generate-link) and emails it to the member via
 * Resend. Logs to notification_log so we can audit sends.
 */

function env() {
  return {
    siteUrl:    process.env.NEXT_PUBLIC_SITE_URL ?? "https://vital-kauai.vercel.app",
    resendKey:  process.env.RESEND_API_KEY,
  };
}

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: Request) {
  const { commitment_id } = await req
    .json()
    .catch(() => ({} as Record<string, unknown>));
  if (!commitment_id) {
    return NextResponse.json(
      { error: "commitment_id required" },
      { status: 400 },
    );
  }

  // Founder gate (mirrors generate-link)
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (role?.role !== "founder") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Service client — bypasses RLS for the token insert + member lookup
  const service = createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Load commitment + member in one shot
  const { data: commit } = await service
    .from("financial_commitments")
    .select(
      "id, status, expected_amount_cents, member_id, member:members(full_name, email, lead_id)",
    )
    .eq("id", commitment_id)
    .single();

  if (
    !commit ||
    !["draft", "active", "partially_paid"].includes(commit.status)
  ) {
    return NextResponse.json(
      { error: "commitment not open" },
      { status: 400 },
    );
  }

  const member = (commit as unknown as {
    member: { full_name: string | null; email: string | null; lead_id: string | null } | null;
  }).member;

  if (!member?.email) {
    return NextResponse.json(
      { error: "Member has no email on file" },
      { status: 400 },
    );
  }

  // Compute remaining (what the link should charge)
  const { data: allocs } = await service
    .from("payment_allocations")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select("allocated_amount_cents, donation:donations(status)" as any)
    .eq("commitment_id", commitment_id);

  const collectedCents = ((allocs ?? []) as unknown as Array<{
    allocated_amount_cents: number;
    donation: { status: string } | null;
  }>)
    .filter((r) => r.donation?.status === "completed")
    .reduce((sum, r) => sum + (r.allocated_amount_cents ?? 0), 0);

  const remainingCents = Math.max(
    commit.expected_amount_cents - collectedCents,
    0,
  );

  if (remainingCents <= 0) {
    return NextResponse.json(
      { error: "Nothing remaining to charge on this commitment" },
      { status: 400 },
    );
  }

  // Mint token (mirrors generate-link)
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error: insertErr } = await service.from("payment_tokens").insert({
    token,
    commitment_id,
    created_by: user.id,
    expires_at: expiresAt,
  });
  if (insertErr) {
    return NextResponse.json(
      { error: "token_insert_failed" },
      { status: 500 },
    );
  }

  const payUrl = `${env().siteUrl}/pay/${token}`;

  // Log to notification_log before sending
  const { data: notifRow } = await service
    .from("notification_log")
    .insert({
      lead_id: member.lead_id ?? null,
      notification_type: "payment_link_email",
      recipient: [member.email],
      status: "queued",
      payload: {
        member_id:        commit.member_id,
        commitment_id:    commit.id,
        amount_cents:     remainingCents,
        token,
        expires_at:       expiresAt,
        trigger:          "founder_dashboard",
      },
    })
    .select("id")
    .single();

  // Send the email
  try {
    await sendPaymentEmail({
      toEmail:        member.email,
      fullName:       member.full_name ?? "",
      amountCents:    remainingCents,
      payUrl,
    });

    if (notifRow) {
      await service
        .from("notification_log")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", notifRow.id);
    }

    return NextResponse.json({
      ok:         true,
      url:        payUrl,
      expires_at: expiresAt,
      sent_to:    member.email,
      message:    `Payment link emailed to ${member.full_name ?? member.email}`,
    });
  } catch (emailErr: unknown) {
    const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
    if (notifRow) {
      await service
        .from("notification_log")
        .update({ status: "failed", failure_reason: msg })
        .eq("id", notifRow.id);
    }
    return NextResponse.json(
      { error: `Email send failed: ${msg}` },
      { status: 500 },
    );
  }
}

// ── Email template ───────────────────────────────────────────

async function sendPaymentEmail(input: {
  toEmail:     string;
  fullName:    string;
  amountCents: number;
  payUrl:      string;
}) {
  const { toEmail, fullName, amountCents, payUrl } = input;
  const firstName = esc(fullName?.split(" ")[0] || "Friend");
  const amount = fmt(amountCents);
  const escUrl = esc(payUrl);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{box-sizing:border-box}
    body{font-family:Georgia,'Times New Roman',serif;background:#f5f0e8;margin:0;padding:40px 16px}
    .wrap{max-width:560px;margin:0 auto}
    .card{background:#1a2e1c;border-radius:6px;overflow:hidden}
    .top-bar{background:#c8a96e;height:4px}
    .inner{padding:48px 44px 44px}
    .eyebrow{font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c8a96e;margin:0 0 22px}
    h1{color:#f5f0e8;font-size:30px;font-weight:400;line-height:1.2;margin:0 0 20px}
    h1 em{font-style:italic;color:rgba(245,240,232,.7)}
    p{color:rgba(245,240,232,.7);font-size:16px;line-height:1.75;margin:0 0 18px}
    .amount-box{background:rgba(200,169,110,.08);border:1px solid rgba(200,169,110,.25);border-radius:6px;padding:22px 26px;margin:28px 0;text-align:center}
    .amount-label{font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(200,169,110,.85);margin:0 0 8px}
    .amount-value{font-family:Georgia,serif;font-size:36px;color:#f5f0e8;font-weight:400}
    .cta-wrap{margin:32px 0 24px;text-align:center}
    .cta{display:inline-block;background:#c8a96e;color:#1a2e1c;text-decoration:none;font-family:'Helvetica Neue',sans-serif;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:17px 38px;border-radius:3px}
    .note{font-family:'Helvetica Neue',sans-serif;font-size:12px;color:rgba(245,240,232,.3);line-height:1.6;margin:0 0 12px}
    .note a{color:#c8a96e;text-decoration:none}
    .footer{font-family:'Helvetica Neue',sans-serif;font-size:11px;color:rgba(245,240,232,.22);text-align:center;line-height:1.9;margin-top:18px}
    hr{border:none;border-top:1px solid rgba(200,169,110,.15);margin:28px 0}
  </style>
</head>
<body>
  <div class="wrap"><div class="card">
    <div class="top-bar"></div>
    <div class="inner">
      <p class="eyebrow">Vital Kaua\u02BBi \u00B7 Journey Contribution</p>
      <h1>A link for you, <em>${firstName}.</em></h1>
      <p>Here\u2019s a single-use payment link for your journey contribution. It opens a secure Stripe checkout pre-filled with your amount.</p>
      <div class="amount-box">
        <p class="amount-label">Amount</p>
        <span class="amount-value">${amount}</span>
      </div>
      <div class="cta-wrap">
        <a class="cta" href="${escUrl}">Complete Contribution \u2192</a>
      </div>
      <hr>
      <p class="note">This link is single-use and expires in <strong style="color:rgba(245,240,232,.45)">7 days</strong>. If anything looks off, reply to this email and we\u2019ll sort it out together.</p>
      <p class="note">Questions? Reply to this email or reach us at <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a></p>
      <div class="footer">\u00A9 2026 Vital Kaua\u02BBi Church \u00B7 PO Box 932, Hanalei, HI 96714<br>aloha@vitalkauai.com</div>
    </div>
  </div></div>
</body>
</html>`;

  if (!env().resendKey) {
    console.log("[payments/email-link] No RESEND_API_KEY \u2014 skipping email");
    throw new Error("RESEND_API_KEY not configured");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${env().resendKey}`,
    },
    body: JSON.stringify({
      from:    "Vital Kaua\u02BBi <aloha@vitalkauai.com>",
      to:      toEmail,
      subject: `Your Vital Kaua\u02BBi journey contribution \u2014 ${amount}`,
      html,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Resend ${res.status}: ${txt}`);
  }
}
