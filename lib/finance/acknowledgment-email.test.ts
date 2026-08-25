/**
 * PR 10C — the acknowledgment renders ONLY founder-configured legal language
 * plus the verified amounts, and shows the full amount paid with its
 * Contribution / card processing fee breakdown (amendment #12).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  renderAcknowledgmentEmail,
  type AcknowledgmentSnapshot,
} from "./acknowledgment-email.ts";

const snapshot = (over: Partial<AcknowledgmentSnapshot> = {}): AcknowledgmentSnapshot => ({
  ack_id: "ack_1",
  receipt_number: "VK-2026-00042",
  amount_cents: 10330,
  contribution_cents: 10000,
  processing_fee_cents: 330,
  contribution_date: "2026-08-25",
  legal_name: "Configured Legal Name",
  receipt_footer: "Configured footer text.",
  tax_language: "Configured tax-deductibility language.",
  no_goods_statement: "Configured no-goods statement.",
  template_version: "v1",
  fund_display_name: "General Support",
  delivery_status: "pending",
  ...over,
});

test("the acknowledgment shows the FULL amount paid and its breakdown", () => {
  const { html, subject } = renderAcknowledgmentEmail(snapshot());
  assert.match(html, /\$103\.30/);
  assert.match(html, /\$100\.00/);
  assert.match(html, /\$3\.30/);
  assert.match(html, /Card processing fee/);
  assert.match(html, /Total paid/);
  assert.match(subject, /VK-2026-00042/);
});

test("every legal statement is the configured text, never hardcoded", () => {
  const { html } = renderAcknowledgmentEmail(snapshot());
  assert.match(html, /Configured Legal Name/);
  assert.match(html, /Configured tax-deductibility language\./);
  assert.match(html, /Configured no-goods statement\./);
  assert.match(html, /Configured footer text\./);
  // No improvised tax claims beyond the configured strings.
  assert.doesNotMatch(html, /501\(c\)|508\(c\)|IRS|EIN/i);
});

test("configured text is HTML-escaped, not interpreted", () => {
  const { html } = renderAcknowledgmentEmail(
    snapshot({ legal_name: 'Name <script>alert("x")</script>' }),
  );
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("an unknown template version is refused, never improvised", () => {
  assert.throws(() => renderAcknowledgmentEmail(snapshot({ template_version: "v9" })));
});

test("the date renders from the snapshot without timezone drift", () => {
  const { html } = renderAcknowledgmentEmail(snapshot({ contribution_date: "2026-01-01" }));
  assert.match(html, /January 1, 2026/);
});
