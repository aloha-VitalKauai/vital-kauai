import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * D-078 legacy Stripe shutdown — static proof.
 *
 * These assertions read the shipped source rather than booting Next.js, because
 * the property that matters is structural: the guard must sit BEFORE any
 * provider call or database write on every legacy path. A runtime test that
 * merely observes a 503 would still pass if the guard had been moved after a
 * Stripe request, which is the exact regression worth preventing.
 */

// npm test runs from the package root; resolve from cwd so this works under ESM.
const ROOT = process.cwd();
const R = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

const API_ROUTES = [
  "app/api/donations/create-session/route.ts",
  "app/api/donations/create-gift-session/route.ts",
  "app/api/payments/create-journey-session/route.ts",
  "app/api/square/create-payment-link/route.ts",
];
const PAGE = "app/pay/[token]/page.tsx";
const ALL_PATHS = [...API_ROUTES, PAGE];

/** Anything that reaches a payment provider or the database. */
const SIDE_EFFECT =
  /getStripe\(\)|getSquareClient\(\)|createServerSupabase\(\)|createServiceSupabase\(|\.from\(|stripe\./;

function entryIndex(lines: string[]): number {
  const i = lines.findIndex(
    (l) =>
      l.startsWith("export async function POST") ||
      l.startsWith("export default async function"),
  );
  assert.ok(i >= 0, "no request entry point found");
  return i;
}

test("the flag fails closed for every value except the exact string 'true'", () => {
  const src = R("lib/payments/legacy-enabled.ts");
  assert.match(
    src,
    /process\.env\.LEGACY_PAYMENTS_ENABLED === "true"/,
    "must compare strictly against the literal 'true'",
  );
  for (const wrong of ["1", "yes", "TRUE", "True", "on", "enabled", ""]) {
    assert.ok(
      wrong !== "true",
      `sanity: ${wrong} must not be the enabling value`,
    );
  }
  assert.ok(
    !/\|\||\?\?/.test(src.split("export function legacyPaymentsEnabled")[1].split("}")[0]),
    "no fallback/default may widen the enabling condition",
  );
});

test("the server guard is imported by all five legacy paths", () => {
  for (const p of ALL_PATHS) {
    assert.match(
      R(p),
      /@\/lib\/payments\/legacy-enabled"/,
      `${p} must import the centralised guard`,
    );
  }
});

test("the guard precedes every provider call and database write", () => {
  for (const p of ALL_PATHS) {
    const lines = R(p).split("\n");
    const body = lines.slice(entryIndex(lines));
    const guard = body.findIndex((l) => l.includes("legacyPaymentsEnabled()"));
    assert.ok(guard >= 0, `${p}: no guard inside the entry point`);
    const effect = body.findIndex((l) => SIDE_EFFECT.test(l));
    if (effect >= 0) {
      assert.ok(
        guard < effect,
        `${p}: guard at ${guard} must precede first side effect at ${effect} (${body[effect].trim()})`,
      );
    }
  }
});

test("no legacy path can create a Stripe Checkout Session before the guard", () => {
  for (const p of ALL_PATHS) {
    const lines = R(p).split("\n");
    const body = lines.slice(entryIndex(lines));
    const guard = body.findIndex((l) => l.includes("legacyPaymentsEnabled()"));
    body.forEach((l, i) => {
      if (/checkout\.sessions\.create|paymentLinks|createPaymentLink/.test(l)) {
        assert.ok(
          i > guard,
          `${p}:${i} creates a provider session before the guard`,
        );
      }
    });
  }
});

test("no legacy path writes donations, financial_commitments or payment_tokens before the guard", () => {
  const PROTECTED = ["donations", "financial_commitments", "payment_tokens"];
  for (const p of ALL_PATHS) {
    const lines = R(p).split("\n");
    const body = lines.slice(entryIndex(lines));
    const guard = body.findIndex((l) => l.includes("legacyPaymentsEnabled()"));
    body.forEach((l, i) => {
      for (const t of PROTECTED) {
        if (l.includes(`.from("${t}")`) || l.includes(`.from('${t}')`)) {
          assert.ok(i > guard, `${p}:${i} touches ${t} before the guard`);
        }
      }
    });
  }
});

test("no legacy path references the finance schema at all", () => {
  for (const p of ALL_PATHS) {
    const src = R(p);
    assert.ok(!/finance\./.test(src), `${p} must not reference finance.*`);
    assert.ok(
      !/schema\(["']finance["']\)/.test(src),
      `${p} must not bind the finance schema`,
    );
  }
});

test("the client display flag is presentation-only and also fails closed", () => {
  const src = R("lib/payments/legacy-enabled-client.ts");
  assert.match(src, /NEXT_PUBLIC_LEGACY_PAYMENTS_ENABLED === "true"/);
  // The doc comment wraps, so collapse whitespace/JSDoc asterisks before matching.
  const flat = src.replace(/\s*\*\s*/g, " ").replace(/\s+/g, " ");
  assert.match(
    flat,
    /NOT the enforcement point/i,
    "must document that it is not authorisation",
  );
});

test("every legacy UI control is gated on legacyDisabled", () => {
  const UI = [
    "app/portal/onboarding/donation/DonationCard.tsx",
    "app/portal/donate/DonateClient.tsx",
    "app/portal/journey/payment/JourneyPaymentCard.tsx",
  ];
  for (const p of UI) {
    const src = R(p);
    assert.match(src, /legacyPaymentsEnabledForDisplay\(\)/, `${p}: no display guard`);
    assert.match(src, /legacyDisabled/, `${p}: no disabled state`);
  }
});

/**
 * The unredacted wipe archive contains member identifiers and payment tokens.
 * It lives outside the repository on purpose; this proves Git cannot take it.
 */
test("the unredacted wipe archive cannot enter Git", () => {
  const ignore = existsSync(path.join(ROOT, ".gitignore"))
    ? R(".gitignore")
    : "";
  assert.match(
    ignore,
    /wipe-archive/,
    ".gitignore must exclude the unredacted wipe archive by name pattern",
  );

  // Nothing matching the archive pattern may be tracked.
  const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" });
  const offenders = tracked
    .split("\n")
    .filter((f) => /wipe-archive|census_salt/.test(f));
  assert.deepEqual(offenders, [], `archive-like files are tracked: ${offenders}`);

  // git must actively refuse a file at the ignored path.
  const probe = "vital-kauai-financial-wipe-archive-PROBE.md";
  const out = execFileSync("git", ["check-ignore", "-v", "--no-index", probe], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.match(out, /wipe-archive/, "git must report the ignore rule that blocks it");
});

test("the committed recovery record carries no member identifiers or tokens", () => {
  const rec = R("docs/financials-v2/PR2_WIPE_RECOVERY_REDACTED.md");
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  assert.ok(!UUID.test(rec), "no UUID may appear in the redacted record");
  assert.ok(!/cs_test_|cs_live_/.test(rec), "no Stripe Checkout Session ids");
  assert.ok(!/\b(pi|ch|re|seti|cus)_[A-Za-z0-9]{8,}/.test(rec), "no Stripe object ids");
  assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(rec), "no email addresses");
  // Opaque-token check. The archive FILENAME is long but is not a secret, so it
  // is excluded by name; anything else 40+ chars of token alphabet fails.
  const withoutKnownFilenames = rec.replace(/[\w-]*wipe-archive[\w.-]*/g, "");
  const opaque = withoutKnownFilenames.match(/[A-Za-z0-9_-]{40,}/g) ?? [];
  assert.deepEqual(opaque, [], `token-length opaque strings present: ${opaque}`);
});
