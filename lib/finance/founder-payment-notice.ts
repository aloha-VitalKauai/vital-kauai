/**
 * Financials V2 — PR 10D (D-091): founders are told when live Stripe money posts.
 *
 * A side effect of the money fact, never a condition of it. The worker calls
 * `notifyFoundersOfPayment` AFTER `record_v2_stripe_payment` has committed;
 * nothing in here throws to the caller, and a dead Resend or a dead Twilio
 * leaves the event `processed` and the ledger correct (D-091 rule 1).
 *
 * No figure is computed here. Received, Remaining and state are read from
 * `finance_api.agreement_balances` after the write; this module formats, it
 * never sums (D-091 rule 5). Integer cents throughout; `/ 100` for display only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendJourneyEmail } from "@/lib/journey-emails";

/**
 * The founder set (D-091 rule 4): the email pair the Calendly founder notice
 * already uses (`app/api/calendly-webhook/route.ts`, `founder_approval`), and
 * the founder number given in the commission. Held here as constants — never
 * read from event metadata or any payload.
 */
export const FOUNDER_NOTICE_EMAILS = ["joshuaperdue2@gmail.com", "aloha@vitalkauai.com"] as const;
export const FOUNDER_NOTICE_SMS = ["+16233308017"] as const;

export const FOUNDER_NOTICE_TYPE = "founder_payment_posted";

export type FounderPaymentNoticeSnapshot = {
  memberName: string;
  memberId: string;
  purpose: string;
  amountCents: number;
  contributionCents: number | null;
  /** null only when the view could not be read — the notice then shows the amount alone. */
  netReceivedCents: number | null;
  remainingCents: number | null;
  paymentState: string;
  occurredAt: string | null;
  livemode: boolean;
  dashboardUrl: string;
};

export type FounderNoticeOutcome = "sent" | "partial" | "failed" | "duplicate" | "skipped";

const PURPOSE_LABEL: Record<string, string> = {
  journey_contribution: "Journey Contribution",
  membership: "Membership Contribution",
  additional_gift: "Additional gift",
  other: "Contribution",
};

const STATE_LABEL: Record<string, string> = {
  unpaid: "Payment needed",
  partial: "Partially received",
  paid: "Received in full",
  overpaid: "More than Contribution received",
  refunded: "Refunded",
  not_applicable: "Gift",
};

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function honoluluTime(iso: string | null): string {
  if (!iso) return "time not reported by Stripe";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "time not reported by Stripe";
  return `${d.toLocaleString("en-US", {
    timeZone: "Pacific/Honolulu",
    year: "numeric", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit",
  })} HST`;
}

export function purposeLabel(purpose: string): string {
  return PURPOSE_LABEL[purpose] ?? "Contribution";
}

/** PURE: formats the snapshot; performs no arithmetic on money. */
export function renderFounderPaymentNotice(s: FounderPaymentNoticeSnapshot): {
  subject: string;
  html: string;
  sms: string;
} {
  const purpose = purposeLabel(s.purpose);
  const state = STATE_LABEL[s.paymentState] ?? s.paymentState;
  const isGift = s.contributionCents === null || s.remainingCents === null;

  const subject = `Payment received — ${s.memberName} · ${usd(s.amountCents)}`;

  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:4px 0;color:#46564e;font-size:14px">${esc(label)}</td>
        <td style="padding:4px 0;text-align:right;color:#1E3A2C;font-size:${strong ? 18 : 14}px${strong ? ";font-weight:bold" : ""}">${esc(value)}</td></tr>`;

  const rows = [
    row("Purpose", purpose),
    row("This payment", usd(s.amountCents), true),
    ...(s.contributionCents === null ? [] : [row("Contribution", usd(s.contributionCents))]),
    ...(s.netReceivedCents === null ? [] : [row("Received", usd(s.netReceivedCents))]),
    ...(s.remainingCents === null ? [] : [row("Remaining", usd(s.remainingCents))]),
    ...(s.netReceivedCents === null ? [] : [row("State", state)]),
  ].join("\n");

  const html = `<div style="max-width:560px;margin:0 auto;font-family:Georgia,'Times New Roman',serif;color:#1A1A18;background:#f8f5ef;padding:28px">
    <p style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#46564e;margin:0 0 12px">Vital Kauaʻi · Payment received${s.livemode ? "" : " · TEST MODE"}</p>
    <h1 style="font-size:22px;font-weight:normal;color:#1E3A2C;margin:0 0 16px">${esc(s.memberName)} paid ${esc(usd(s.amountCents))}</h1>
    <table style="width:100%;border-collapse:collapse;margin:18px 0" role="presentation">
${rows}
    </table>
    <p style="font-size:14px;color:#46564e;margin:0 0 16px">Posted ${esc(honoluluTime(s.occurredAt))}.</p>
    <p style="font-size:14px;margin:0"><a href="${esc(s.dashboardUrl)}" style="color:#1E3A2C">Open ${esc(s.memberName)} in the dashboard</a></p>
  </div>`;

  const sms = isGift
    ? `Vital Kauaʻi: ${usd(s.amountCents)} gift received from ${s.memberName}.`
    : `Vital Kauaʻi: ${usd(s.amountCents)} received from ${s.memberName} toward ${purpose}. Remaining ${usd(s.remainingCents as number)} (${state}).`;

  return { subject, html, sms: sms.slice(0, 300) };
}

export type FounderNoticeEmailSender = (a: { to: string; subject: string; html: string }) => Promise<string | null>;
export type FounderNoticeSmsSender = (a: { to: string; message: string }) => Promise<{ ok: boolean; error?: string }>;

export type NotifyFoundersArgs = {
  paymentIntentId: string;
  agreementId: string;
  amountCents: number;
  livemode: boolean;
  occurredAt: string | null;
  siteUrl: string;
  sendEmail?: FounderNoticeEmailSender;
  sendSms?: FounderNoticeSmsSender;
};

/**
 * The canonical SMS sender: the `send-notification` edge function, mapped to
 * {ok, error} exactly as `app/api/cron/checkins/route.ts` does.
 */
function edgeSmsSender(client: SupabaseClient): FounderNoticeSmsSender {
  return async ({ to, message }) => {
    const { data, error } = await client.functions.invoke("send-notification", {
      body: { channel: "sms", to, message, to_name: "Founder" },
    });
    if (error) return { ok: false, error: error.message };
    const body = data as { ok?: boolean; error?: string | null } | null;
    if (!body?.ok) return { ok: false, error: body?.error ?? "send failed" };
    return { ok: true };
  };
}

type BalanceRow = {
  member_id: string;
  purpose: string;
  contribution_cents: number | null;
  net_received_cents: number;
  remaining_cents: number | null;
  payment_state: string;
};

/**
 * Notify the founders that live money posted. NEVER throws: every path
 * returns an outcome, and the catch-all logs and returns "failed".
 *
 * Order matters. The dedup row is inserted FIRST (D-091 rule 2): a 23505 means
 * another delivery of the same PaymentIntent already won, so nothing is sent.
 * Only then are the balances read and the messages sent; the row is closed
 * with the truthful per-recipient outcome.
 */
export async function notifyFoundersOfPayment(
  client: SupabaseClient,
  args: NotifyFoundersArgs,
): Promise<FounderNoticeOutcome> {
  try {
    // D-091 rule 3: live mode only. Test-mode payments record and notify no one.
    if (!args.livemode) return "skipped";

    const sendEmail = args.sendEmail ?? sendJourneyEmail;
    const sendSms = args.sendSms ?? edgeSmsSender(client);
    const recipients = [...FOUNDER_NOTICE_EMAILS, ...FOUNDER_NOTICE_SMS];

    // (b) Claim the identity before anything is sent.
    const ins = await client
      .from("notification_log")
      .insert({
        notification_type: FOUNDER_NOTICE_TYPE,
        recipient: recipients,
        status: "queued",
        payload: {
          payment_intent_id: args.paymentIntentId,
          livemode: String(args.livemode),
          agreement_id: args.agreementId,
          amount_cents: args.amountCents,
        },
      })
      .select("id")
      .single();
    if (ins.error) {
      if (ins.error.code === "23505") return "duplicate";
      console.error("worker: founder notice dedup insert failed", args.paymentIntentId, ins.error.message);
      // Without the row there is no dedup identity, so nothing may be sent.
      return "failed";
    }
    const noticeId = (ins.data as { id: string }).id;

    // (c) Enrich from the view. A failed read still sends the amount — the
    // founders should hear about money even when the enrichment fails.
    const failures: string[] = [];
    let snapshot: FounderPaymentNoticeSnapshot = {
      memberName: "a member",
      memberId: "",
      purpose: "other",
      amountCents: args.amountCents,
      contributionCents: null,
      netReceivedCents: null,
      remainingCents: null,
      paymentState: "not_applicable",
      occurredAt: args.occurredAt,
      livemode: args.livemode,
      dashboardUrl: `${args.siteUrl}/dashboard`,
    };
    try {
      const bal = await client
        .schema("finance_api")
        .from("agreement_balances")
        .select("member_id, purpose, contribution_cents, net_received_cents, remaining_cents, payment_state")
        .eq("agreement_id", args.agreementId)
        .maybeSingle();
      if (bal.error) throw new Error(`agreement_balances: ${bal.error.message}`);
      const b = bal.data as BalanceRow | null;
      if (!b) throw new Error(`agreement_balances: no row for ${args.agreementId}`);
      snapshot = {
        ...snapshot,
        memberId: b.member_id,
        purpose: b.purpose,
        contributionCents: b.contribution_cents,
        netReceivedCents: b.net_received_cents,
        remainingCents: b.remaining_cents,
        paymentState: b.payment_state,
        dashboardUrl: `${args.siteUrl}/dashboard/${b.member_id}`,
      };
      const mem = await client.from("members").select("full_name").eq("id", b.member_id).maybeSingle();
      if (mem.error) throw new Error(`members: ${mem.error.message}`);
      const name = (mem.data as { full_name?: string | null } | null)?.full_name?.trim();
      if (name) snapshot.memberName = name;
      else failures.push(`enrich members: no name for ${b.member_id}`);
    } catch (e) {
      failures.push(`enrich: ${e instanceof Error ? e.message : String(e)}`);
    }

    // (d) Render once, send to every founder, collect outcomes.
    const { subject, html, sms } = renderFounderPaymentNotice(snapshot);
    let succeeded = 0;
    let attempted = 0;
    for (const to of FOUNDER_NOTICE_EMAILS) {
      attempted += 1;
      try {
        const id = await sendEmail({ to, subject, html });
        if (id === null) failures.push(`email ${to}: email sending disabled (no RESEND_API_KEY)`);
        else succeeded += 1;
      } catch (e) {
        failures.push(`email ${to}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    for (const to of FOUNDER_NOTICE_SMS) {
      attempted += 1;
      try {
        const r = await sendSms({ to, message: sms });
        if (r.ok) succeeded += 1;
        else failures.push(`sms ${to}: ${r.error ?? "send failed"}`);
      } catch (e) {
        failures.push(`sms ${to}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // (e) Close the row truthfully.
    const outcome: FounderNoticeOutcome =
      succeeded === attempted ? "sent" : succeeded > 0 ? "partial" : "failed";
    const upd = await client
      .from("notification_log")
      .update({
        status: outcome,
        sent_at: new Date().toISOString(),
        failure_reason: failures.length ? failures.join("; ").slice(0, 2000) : null,
      })
      .eq("id", noticeId);
    if (upd.error) {
      console.error("worker: founder notice bookkeeping failed", noticeId, upd.error.message);
    }
    return outcome;
  } catch (e) {
    // (f) Nothing here may reach the event loop.
    console.error("worker: founder notice failed", args.paymentIntentId, e instanceof Error ? e.message : String(e));
    return "failed";
  }
}
