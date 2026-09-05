/**
 * PR 10D (D-091) — the founder notice formats figures read from the view,
 * never computes them; dedups by identity before sending; is live-only; and
 * can never throw.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  FOUNDER_NOTICE_EMAILS,
  FOUNDER_NOTICE_SMS,
  notifyFoundersOfPayment,
  renderFounderPaymentNotice,
  type FounderPaymentNoticeSnapshot,
} from "./founder-payment-notice.ts";

const snapshot = (over: Partial<FounderPaymentNoticeSnapshot> = {}): FounderPaymentNoticeSnapshot => ({
  memberName: "Shawn Example",
  memberId: "mem_1",
  purpose: "journey_contribution",
  amountCents: 600000,
  contributionCents: 1500000,
  netReceivedCents: 600000,
  remainingCents: 900000,
  paymentState: "partial",
  occurredAt: "2026-09-05T19:00:00.000Z",
  livemode: true,
  dashboardUrl: "https://vitalkauai.com/dashboard/mem_1",
  ...over,
});

// ─── render ──────────────────────────────────────────────────────────────────

test("journey contribution: subject, rows, Honolulu time, link, SMS", () => {
  const { subject, html, sms } = renderFounderPaymentNotice(snapshot());
  assert.equal(subject, "Payment received — Shawn Example · $6,000.00");
  assert.match(html, /Journey Contribution/);
  assert.match(html, /Contribution<\/td>[\s\S]*?\$15,000\.00/);
  assert.match(html, /Received<\/td>[\s\S]*?\$6,000\.00/);
  assert.match(html, /Remaining<\/td>[\s\S]*?\$9,000\.00/);
  assert.match(html, /Partially received/);
  // 19:00Z on 2026-09-05 is 09:00 HST.
  assert.match(html, /September 5, 2026(,| at) 9:00 AM HST/);
  assert.match(html, /href="https:\/\/vitalkauai\.com\/dashboard\/mem_1"/);
  assert.equal(
    sms,
    "Vital Kauaʻi: $6,000.00 received from Shawn Example toward Journey Contribution. Remaining $9,000.00 (Partially received).",
  );
  assert.ok(sms.length <= 300);
});

test("a gift (null contribution) omits Contribution and Remaining rows and uses the gift SMS", () => {
  const { html, sms } = renderFounderPaymentNotice(snapshot({
    purpose: "additional_gift", contributionCents: null, remainingCents: null,
    paymentState: "not_applicable", amountCents: 25000, netReceivedCents: 25000,
  }));
  assert.doesNotMatch(html, /Contribution<\/td>/);
  assert.doesNotMatch(html, /Remaining<\/td>/);
  assert.match(html, /Additional gift/);
  assert.match(html, /Received<\/td>[\s\S]*?\$250\.00/);
  assert.equal(sms, "Vital Kauaʻi: $250.00 gift received from Shawn Example.");
});

test("amounts render as integer cents with two decimals and grouping; no arithmetic beyond display", () => {
  const { subject } = renderFounderPaymentNotice(snapshot({ amountCents: 123456789 }));
  assert.match(subject, /\$1,234,567\.89/);
  const cents = renderFounderPaymentNotice(snapshot({ amountCents: 1 }));
  assert.match(cents.subject, /\$0\.01/);
});

test("a very long member name keeps the SMS within 300 characters", () => {
  const { sms } = renderFounderPaymentNotice(snapshot({ memberName: "N".repeat(400) }));
  assert.ok(sms.length <= 300);
});

test("purpose labels: membership and other; unknown state falls back to the raw value", () => {
  assert.match(renderFounderPaymentNotice(snapshot({ purpose: "membership" })).html, /Membership Contribution/);
  assert.match(renderFounderPaymentNotice(snapshot({ purpose: "other" })).html, /Contribution<\/td>/);
  assert.match(renderFounderPaymentNotice(snapshot({ paymentState: "paid" })).sms, /Received in full/);
});

test("enrichment failure: amount only — no Received, Remaining or state rows are asserted", () => {
  const { html, sms } = renderFounderPaymentNotice(snapshot({
    memberName: "a member", contributionCents: null, netReceivedCents: null, remainingCents: null,
  }));
  assert.doesNotMatch(html, /Received<\/td>/);
  assert.doesNotMatch(html, /Remaining<\/td>/);
  assert.doesNotMatch(html, /State<\/td>/);
  assert.match(html, /\$6,000\.00/);
  assert.equal(sms, "Vital Kauaʻi: $6,000.00 gift received from a member.");
});

test("HTML escapes the member name", () => {
  const { html } = renderFounderPaymentNotice(snapshot({ memberName: "<b>Evil</b>" }));
  assert.doesNotMatch(html, /<b>Evil<\/b>/);
  assert.match(html, /&lt;b&gt;Evil&lt;\/b&gt;/);
});

// ─── notifyFoundersOfPayment ─────────────────────────────────────────────────

type Op = { table: string; op: string; payload?: unknown; filters: Array<[string, unknown]> };

/**
 * A fake client at the `.from()/.schema().from()` boundary. Every operation is
 * recorded; handlers decide the response.
 */
function fakeClient(opts: {
  insertError?: { code?: string; message: string } | null;
  balance?: Record<string, unknown> | null;
  balanceError?: { message: string } | null;
  member?: Record<string, unknown> | null;
  memberError?: { message: string } | null;
  updateError?: { message: string } | null;
} = {}) {
  const ops: Op[] = [];
  const builder = (table: string, schema: string) => {
    const cur: Op = { table: `${schema}.${table}`, op: "select", filters: [] };
    const b = {
      insert(payload: unknown) { cur.op = "insert"; cur.payload = payload; return b; },
      update(payload: unknown) { cur.op = "update"; cur.payload = payload; return b; },
      select() { return b; },
      eq(k: string, v: unknown) { cur.filters.push([k, v]); return b; },
      single() { return b; },
      maybeSingle() { return b; },
      then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
        ops.push(cur);
        let res: { data: unknown; error: unknown };
        if (cur.op === "insert") {
          res = opts.insertError ? { data: null, error: opts.insertError } : { data: { id: "nl_1" }, error: null };
        } else if (cur.op === "update") {
          res = { data: null, error: opts.updateError ?? null };
        } else if (cur.table === "finance_api.agreement_balances") {
          res = opts.balanceError
            ? { data: null, error: opts.balanceError }
            : { data: opts.balance === undefined ? sampleBalance : opts.balance, error: null };
        } else if (cur.table === "public.members") {
          res = opts.memberError
            ? { data: null, error: opts.memberError }
            : { data: opts.member === undefined ? { full_name: "Shawn Example" } : opts.member, error: null };
        } else {
          res = { data: null, error: { message: `no handler ${cur.table}` } };
        }
        return Promise.resolve(res).then(resolve, reject);
      },
    };
    return b;
  };
  const client = {
    from: (t: string) => builder(t, "public"),
    schema: (s: string) => ({ from: (t: string) => builder(t, s) }),
    functions: { invoke: async () => { throw new Error("functions.invoke must not be reached when sendSms is injected"); } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { client, ops };
}

const sampleBalance = {
  member_id: "mem_1", purpose: "journey_contribution", contribution_cents: 1500000,
  net_received_cents: 600000, remaining_cents: 900000, payment_state: "partial",
};

const baseArgs = {
  paymentIntentId: "pi_live_1",
  agreementId: "agr_1",
  amountCents: 600000,
  livemode: true,
  occurredAt: "2026-09-05T19:00:00.000Z",
  siteUrl: "https://vitalkauai.com",
};

function senders(over: {
  email?: (a: { to: string; subject: string; html: string }) => Promise<string | null>;
  sms?: (a: { to: string; message: string }) => Promise<{ ok: boolean; error?: string }>;
} = {}) {
  const emails: Array<{ to: string; subject: string; html: string }> = [];
  const smss: Array<{ to: string; message: string }> = [];
  const sendEmail = over.email ?? (async (a: { to: string; subject: string; html: string }) => { emails.push(a); return "msg_1"; });
  const sendSms = over.sms ?? (async (a: { to: string; message: string }) => { smss.push(a); return { ok: true }; });
  return {
    emails, smss,
    sendEmail: async (a: { to: string; subject: string; html: string }) => { if (over.email) emails.push(a); return sendEmail(a); },
    sendSms: async (a: { to: string; message: string }) => { if (over.sms) smss.push(a); return sendSms(a); },
  };
}

test("livemode=false → skipped, nothing touched", async () => {
  const { client, ops } = fakeClient();
  const s = senders();
  const out = await notifyFoundersOfPayment(client, { ...baseArgs, livemode: false, ...s });
  assert.equal(out, "skipped");
  assert.equal(ops.length, 0);
  assert.equal(s.emails.length, 0);
  assert.equal(s.smss.length, 0);
});

test("23505 on the dedup insert → duplicate, zero sends, no reads", async () => {
  const { client, ops } = fakeClient({ insertError: { code: "23505", message: "duplicate key value" } });
  const s = senders();
  const out = await notifyFoundersOfPayment(client, { ...baseArgs, ...s });
  assert.equal(out, "duplicate");
  assert.equal(ops.length, 1);
  assert.equal(ops[0]!.op, "insert");
  assert.equal(s.emails.length, 0);
  assert.equal(s.smss.length, 0);
});

test("any other insert error → failed, zero sends (no row, no dedup identity)", async () => {
  const { client, ops } = fakeClient({ insertError: { code: "42501", message: "permission denied" } });
  const s = senders();
  const out = await notifyFoundersOfPayment(client, { ...baseArgs, ...s });
  assert.equal(out, "failed");
  assert.equal(ops.length, 1);
  assert.equal(s.emails.length + s.smss.length, 0);
});

test("happy path: one insert first, view + member read, 2 emails + 1 SMS, status sent", async () => {
  const { client, ops } = fakeClient();
  const s = senders();
  const out = await notifyFoundersOfPayment(client, { ...baseArgs, ...s });
  assert.equal(out, "sent");

  assert.equal(ops.filter((o) => o.op === "insert").length, 1);
  assert.equal(ops[0]!.op, "insert", "the dedup row is claimed before anything else");
  const ins = ops[0]!.payload as Record<string, unknown>;
  assert.equal(ins.notification_type, "founder_payment_posted");
  assert.equal(ins.status, "queued");
  assert.deepEqual(ins.recipient, [...FOUNDER_NOTICE_EMAILS, ...FOUNDER_NOTICE_SMS]);
  assert.deepEqual(ins.payload, {
    payment_intent_id: "pi_live_1", livemode: "true", agreement_id: "agr_1", amount_cents: 600000,
  });

  const bal = ops.find((o) => o.table === "finance_api.agreement_balances");
  assert.deepEqual(bal?.filters, [["agreement_id", "agr_1"]]);
  const mem = ops.find((o) => o.table === "public.members");
  assert.deepEqual(mem?.filters, [["id", "mem_1"]]);

  assert.deepEqual(s.emails.map((e) => e.to), [...FOUNDER_NOTICE_EMAILS]);
  assert.equal(s.emails[0]!.subject, "Payment received — Shawn Example · $6,000.00");
  assert.match(s.emails[0]!.html, /\$9,000\.00/);
  assert.match(s.emails[0]!.html, /dashboard\/mem_1/);
  assert.deepEqual(s.smss.map((m) => m.to), [...FOUNDER_NOTICE_SMS]);
  assert.match(s.smss[0]!.message, /^Vital Kauaʻi: \$6,000\.00 received from Shawn Example/);

  const upd = ops.find((o) => o.op === "update");
  assert.deepEqual(upd?.filters, [["id", "nl_1"]]);
  const p = upd?.payload as Record<string, unknown>;
  assert.equal(p.status, "sent");
  assert.equal(p.failure_reason, null);
  assert.equal(typeof p.sent_at, "string");
});

test("SMS failure → partial, with the SMS error in failure_reason", async () => {
  const { client, ops } = fakeClient();
  const s = senders({ sms: async () => ({ ok: false, error: "Authentication Error - invalid username" }) });
  const out = await notifyFoundersOfPayment(client, { ...baseArgs, ...s });
  assert.equal(out, "partial");
  const p = ops.find((o) => o.op === "update")?.payload as Record<string, unknown>;
  assert.equal(p.status, "partial");
  assert.match(String(p.failure_reason), /sms \+16233308017: Authentication Error - invalid username/);
});

test("sendEmail throwing never propagates; partial when SMS still lands, failed when nothing does", async () => {
  {
    const { client, ops } = fakeClient();
    const s = senders({ email: async () => { throw new Error("Resend 500"); } });
    const out = await notifyFoundersOfPayment(client, { ...baseArgs, ...s });
    assert.equal(out, "partial");
    const p = ops.find((o) => o.op === "update")?.payload as Record<string, unknown>;
    assert.match(String(p.failure_reason), /email joshuaperdue2@gmail.com: Resend 500/);
    assert.match(String(p.failure_reason), /email aloha@vitalkauai.com: Resend 500/);
  }
  {
    const { client, ops } = fakeClient();
    const s = senders({
      email: async () => { throw new Error("Resend 500"); },
      sms: async () => { throw new Error("edge function down"); },
    });
    const out = await notifyFoundersOfPayment(client, { ...baseArgs, ...s });
    assert.equal(out, "failed");
    const p = ops.find((o) => o.op === "update")?.payload as Record<string, unknown>;
    assert.equal(p.status, "failed");
    assert.match(String(p.failure_reason), /sms \+16233308017: edge function down/);
  }
});

test("email sender returning null (no RESEND_API_KEY) is recorded truthfully, never as sent", async () => {
  const { client, ops } = fakeClient();
  const s = senders({ email: async () => null });
  const out = await notifyFoundersOfPayment(client, { ...baseArgs, ...s });
  assert.equal(out, "partial");
  const p = ops.find((o) => o.op === "update")?.payload as Record<string, unknown>;
  assert.match(String(p.failure_reason), /RESEND_API_KEY/);
});

test("view read failure still sends the amount to 'a member' and notes the failure", async () => {
  const { client, ops } = fakeClient({ balanceError: { message: "view unavailable" } });
  const s = senders();
  const out = await notifyFoundersOfPayment(client, { ...baseArgs, ...s });
  assert.equal(out, "sent");
  assert.equal(s.emails.length, 2);
  assert.equal(s.emails[0]!.subject, "Payment received — a member · $6,000.00");
  assert.doesNotMatch(s.emails[0]!.html, /Remaining<\/td>/);
  assert.doesNotMatch(s.emails[0]!.html, /Received<\/td>/);
  assert.equal(s.smss[0]!.message, "Vital Kauaʻi: $6,000.00 gift received from a member.");
  const p = ops.find((o) => o.op === "update")?.payload as Record<string, unknown>;
  assert.equal(p.status, "sent");
  assert.match(String(p.failure_reason), /enrich: agreement_balances: view unavailable/);
});

test("a client that explodes on .from never throws out of the function", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = { from() { throw new Error("boom"); }, schema() { throw new Error("boom"); } } as any;
  const out = await notifyFoundersOfPayment(client, { ...baseArgs, ...senders() });
  assert.equal(out, "failed");
});

test("the default SMS sender maps the edge function response like the checkins cron", async () => {
  const { client } = fakeClient();
  const invocations: unknown[] = [];
  client.functions.invoke = async (name: string, o: unknown) => {
    invocations.push([name, o]);
    return { data: { ok: false, error: "Authentication Error - invalid username" }, error: null };
  };
  const s = senders();
  const out = await notifyFoundersOfPayment(client, { ...baseArgs, sendEmail: s.sendEmail });
  assert.equal(out, "partial");
  assert.equal(invocations.length, 1);
  const [name, o] = invocations[0] as [string, { body: Record<string, unknown> }];
  assert.equal(name, "send-notification");
  assert.equal(o.body.channel, "sms");
  assert.equal(o.body.to, "+16233308017");
  assert.equal(o.body.to_name, "Founder");
  assert.match(String(o.body.message), /^Vital Kauaʻi: /);
});
