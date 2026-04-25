import { NextResponse } from "next/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

/**
 * POST /api/free-guide
 * Body: { full_name: string, email: string }
 *
 * Public endpoint for the home-page lead capture. Inserts a row into
 * `leads` (source: "Free Guide") and emails the requester the Iboga
 * guide as a PDF attachment + an in-email link, plus a CTA to book a
 * discovery call. Logs the send to notification_log for audit.
 */

function env() {
  return {
    siteUrl:    process.env.NEXT_PUBLIC_SITE_URL ?? "https://vital-kauai.vercel.app",
    resendKey:  process.env.RESEND_API_KEY,
    supaUrl:    process.env.NEXT_PUBLIC_SUPABASE_URL,
    supaKey:    process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const email    = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!fullName || !email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "name and a valid email are required" },
      { status: 400 },
    );
  }

  const { siteUrl, resendKey, supaUrl, supaKey } = env();

  if (!supaUrl || !supaKey) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 500 });
  }

  const service = createServiceSupabase(supaUrl, supaKey, {
    auth: { persistSession: false },
  });

  // Insert lead — non-fatal if it fails (we still want to send the guide)
  const { data: leadRow } = await service
    .from("leads")
    .insert({
      full_name: fullName,
      email,
      source: "Free Guide",
      lead_date: new Date().toISOString(),
    })
    .select("id")
    .single();

  // Log to notification_log (queued)
  const { data: notifRow } = await service
    .from("notification_log")
    .insert({
      lead_id: leadRow?.id ?? null,
      notification_type: "free_guide_email",
      recipient: [email],
      status: "queued",
      payload: { full_name: fullName, source: "Free Guide" },
    })
    .select("id")
    .single();

  // Send the email (PDF attached + link in body)
  try {
    await sendFreeGuideEmail({
      toEmail:  email,
      fullName,
      siteUrl,
      resendKey,
    });

    if (notifRow) {
      await service
        .from("notification_log")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", notifRow.id);
    }

    return NextResponse.json({ ok: true });
  } catch (emailErr: unknown) {
    const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
    if (notifRow) {
      await service
        .from("notification_log")
        .update({ status: "failed", failure_reason: msg })
        .eq("id", notifRow.id);
    }
    // Don't block the user — they still get on-site access on redirect
    return NextResponse.json(
      { ok: true, email_sent: false, error: msg },
      { status: 200 },
    );
  }
}

// ── Email template ───────────────────────────────────────────

async function sendFreeGuideEmail(input: {
  toEmail:   string;
  fullName:  string;
  siteUrl:   string;
  resendKey: string | undefined;
}) {
  const { toEmail, fullName, siteUrl, resendKey } = input;
  if (!resendKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const firstName    = esc(fullName.split(" ")[0] || "Friend");
  const guideUrl     = `${siteUrl}/iboga-guide`;
  const pdfUrl       = `${siteUrl}/iboga-guide-free.pdf`;
  const discoveryUrl = `${siteUrl}/begin-your-journey`;

  // Read the PDF off disk and base64-encode for Resend's attachments field
  const pdfPath  = path.join(process.cwd(), "public", "iboga-guide-free.pdf");
  const pdfBytes = await readFile(pdfPath);
  const pdfB64   = pdfBytes.toString("base64");

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
    h1{color:#f5f0e8;font-size:28px;font-weight:400;line-height:1.25;margin:0 0 20px}
    h1 em{font-style:italic;color:rgba(245,240,232,.7)}
    p{color:rgba(245,240,232,.72);font-size:16px;line-height:1.75;margin:0 0 18px}
    .cta-wrap{margin:28px 0 8px;text-align:center}
    .cta{display:inline-block;background:#c8a96e;color:#1a2e1c;text-decoration:none;font-family:'Helvetica Neue',sans-serif;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:16px 34px;border-radius:3px}
    .cta-secondary{display:inline-block;color:#c8a96e;text-decoration:none;font-family:'Helvetica Neue',sans-serif;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;padding:14px 30px;border:1px solid rgba(200,169,110,.4);border-radius:3px}
    .links{font-family:'Helvetica Neue',sans-serif;font-size:13px;color:rgba(245,240,232,.55);line-height:1.8;margin:0 0 12px}
    .links a{color:#c8a96e;text-decoration:none}
    .footer{font-family:'Helvetica Neue',sans-serif;font-size:11px;color:rgba(245,240,232,.22);text-align:center;line-height:1.9;margin-top:24px}
    hr{border:none;border-top:1px solid rgba(200,169,110,.15);margin:28px 0}
  </style>
</head>
<body>
  <div class="wrap"><div class="card">
    <div class="top-bar"></div>
    <div class="inner">
      <p class="eyebrow">Vital Kauaʻi · Free Resource</p>
      <h1>Your Iboga guide, <em>${firstName}.</em></h1>
      <p>Mahalo for reaching out. The guide we wish existed when we began our own journeys is attached to this email as a PDF, and you can read it on the web anytime at the link below.</p>
      <p>It covers the history and lineage of Iboga, what to expect during ceremony, how we prepare body and nervous system, and how to choose a safe, qualified provider.</p>
      <p class="links">
        • <a href="${esc(guideUrl)}">Read the guide on the web</a><br>
        • <a href="${esc(pdfUrl)}">Download the PDF</a> (also attached)
      </p>
      <hr>
      <p>If, after reading, you sense this work may be for you, the next step is a conversation. We hold discovery calls with everyone before they enter ceremony, and we would be honored to connect with you.</p>
      <div class="cta-wrap">
        <a class="cta" href="${esc(discoveryUrl)}">Book a Discovery Call →</a>
      </div>
      <hr>
      <p class="links">Questions? Reply to this email or reach us at <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a>.</p>
      <div class="footer">With care,<br>Rachel, Josh &amp; the Vital Kauaʻi team<br><br>© 2026 Vital Kauaʻi Church · PO Box 932, Hanalei, HI 96714</div>
    </div>
  </div></div>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from:    "Vital Kauaʻi <aloha@vitalkauai.com>",
      to:      toEmail,
      subject: "Your Free Iboga Guide",
      html,
      attachments: [
        {
          filename: "vital-kauai-iboga-guide.pdf",
          content:  pdfB64,
        },
      ],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Resend ${res.status}: ${txt}`);
  }
}
