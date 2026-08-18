import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { ROUTE_CASES } from "../../supabase/tests/legacy-cases.mjs";
import {
  FAKE_ENV,
  RESOLVER,
  ONBOARDING_RESOLVER,
  ONBOARDING_FETCH,
  squareSignature,
  TEST_URL,
} from "../../supabase/tests/legacy-fixtures.mjs";

/**
 * D-078 legacy payment shutdown — BEHAVIOURAL proof.
 *
 * WHAT REPLACED WHAT, AND WHY.
 * The previous version of this file read the shipped source and compared line
 * numbers: "the guard appears before the first `.from(` on this line". An
 * independent review showed that proof was vacuous, and direct experiment
 * confirmed it — inverting the guard to `if (legacyPaymentsEnabled())` and
 * deleting its `return` BOTH left all 25 assertions green. A test that a comment
 * can satisfy is not evidence about runtime behaviour.
 *
 * Every assertion below instead CALLS the real handler through
 * `supabase/tests/legacy-loader.mjs` and observes what it did:
 *   - the response is 503 with the machine-readable disabled code, and
 *   - the recording stubs logged ZERO calls, meaning no Stripe request, no
 *     Square request, no Supabase query or write, no mail send, not even an
 *     authorisation lookup.
 *
 * ANTI-VACUITY. "Zero calls were recorded" is only meaningful if this harness is
 * capable of recording a call at all. `positive control` below runs every one of
 * the same handlers with the flag ENABLED and asserts each one does reach the
 * instrumented world. Without that control, a broken loader would make every
 * assertion here pass for the wrong reason — which is precisely the failure
 * being remediated.
 */

const ROOT = process.cwd();
const R = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

declare const globalThis: {
  __VK_CALLS: Array<{ module: string; path: string; call: string; arg0?: string }>;
} & typeof global;

/**
 * Every falsy-in-our-sense value the environment variable can hold. "true " with
 * a trailing space and "TRUE" matter: a deploy pipeline that trims badly or
 * upper-cases must not switch a money path back on.
 */
const DISABLED_VALUES = [undefined, "", "false", "FALSE", "TRUE", "True", "1", "yes", "on", "true "];

/**
 * Provider and database credentials are populated with obviously-fake values.
 *
 * This is not convenience — it strengthens every assertion below. In production
 * these variables ARE set, so a handler that only refuses because a key is
 * missing would be relying on an accident of configuration rather than on the
 * guard. Supplying them makes "the handler did nothing" attributable to the
 * shutdown and nothing else. The values are inert: all provider modules are
 * replaced by recording stubs, so nothing can leave the process.
 */
Object.assign(process.env, FAKE_ENV);

function setFlag(v: string | undefined) {
  if (v === undefined) delete process.env.LEGACY_PAYMENTS_ENABLED;
  else process.env.LEGACY_PAYMENTS_ENABLED = v;
}

function resetCalls() {
  globalThis.__VK_CALLS.length = 0;
}

/**
 * Build the request for a case. `signed` cases get a real Square HMAC over
 * (url + raw body) so the route's own verifier accepts it — the raw string is
 * signed and sent byte-for-byte, since re-serialising would change the digest.
 */
const buildRequest = (body: unknown, signed?: boolean) => {
  const raw = JSON.stringify(body);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signed) headers["x-square-hmacsha256-signature"] = squareSignature(raw, TEST_URL);
  return new Request(TEST_URL, { method: "POST", headers, body: raw });
};

/**
 * Routes that must REFUSE outright while legacy payments are off, with a body
 * valid enough to get past their own input validation — otherwise a 400 would
 * mask the guard and the "zero calls" assertion would prove nothing.
 */
const REFUSING = ROUTE_CASES;

async function callPost(file: string, body: unknown, signed?: boolean) {
  const mod = (await import(path.join(ROOT, file))) as {
    POST: (r: Request) => Promise<Response>;
  };
  return mod.POST(buildRequest(body, signed));
}

for (const { file, body, signed } of REFUSING) {
  for (const value of DISABLED_VALUES) {
    const shown = value === undefined ? "absent" : JSON.stringify(value);
    test(`${file} refuses and does nothing when the flag is ${shown}`, async () => {
      setFlag(value);
      resetCalls();
      // No resolver: the handler must refuse without any help from fixtures.
      delete (globalThis as Record<string, unknown>).__VK_RESOLVE;

      const res = await callPost(file, body, signed);

      assert.equal(res.status, 503, `${file}: expected 503, got ${res.status}`);
      const payload = (await res.json()) as { error?: string };
      assert.equal(
        payload.error,
        "legacy_payments_disabled",
        `${file}: wrong refusal code`,
      );

      // The single most important assertion in this file: the handler must not
      // have touched Stripe, Square, Supabase, the mailer, or the auth check.
      assert.deepEqual(
        globalThis.__VK_CALLS.map((c) => c.call),
        [],
        `${file}: performed side effects while disabled`,
      );
    });
  }
}

/**
 * POSITIVE CONTROL — proves the harness can observe side effects.
 *
 * Each refusing route is run again with the flag enabled. It must stop being a
 * 503 AND reach the instrumented world. If this test ever fails, every "zero
 * calls" assertion above becomes untrustworthy and must not be read as evidence.
 */
test("positive control: with the flag enabled every route reaches its expected mutation", async () => {
  const bad: string[] = [];
  for (const { file, body, expect, reachabilityOnly, signed } of REFUSING) {
    setFlag("true");
    resetCalls();
    // Fixtures drive the route down an authorised path so it can reach the
    // write itself, rather than stopping at the auth lookup.
    (globalThis as Record<string, unknown>).__VK_RESOLVE = RESOLVER;
    try {
      await callPost(file, body, signed);
    } catch {
      /* the calls it made before failing are what matter */
    }
    const paths = globalThis.__VK_CALLS.map((c) => c.path);
    if (!paths.some((p) => expect.test(p))) {
      bad.push(
        `${file}: never reached ${expect}${reachabilityOnly ? " (reachability-only case)" : ""}` +
          `\n    deepest: ${paths.at(-1) ?? "(no calls at all)"}`,
      );
    }
  }
  delete (globalThis as Record<string, unknown>).__VK_RESOLVE;
  assert.deepEqual(
    bad,
    [],
    "these routes did not reach the specific call their disabled-state " +
      "assertions claim to prevent, so that evidence is not trustworthy:\n" + bad.join("\n"),
  );
});

/**
 * Guards the guard: all but one case must be MUTATION-precise. If someone
 * weakens an expectation to something incidental (an auth call, a config read)
 * the positive control would still pass while proving much less, so the
 * strength of each expectation is itself asserted.
 */
test("every positive-control expectation is mutation-precise (no weak controls remain)", () => {
  const weak = REFUSING.filter((c) => c.reachabilityOnly).map((c) => c.file);
  assert.deepEqual(weak, [], "reachability-only controls are no longer accepted");

  /**
   * Decoy call paths: things every route touches anyway (auth, role lookup,
   * unrelated tables) or that are simply not a legacy mutation.
   *
   * Checking the regex SHAPE was not enough — independent review showed
   * `expect: /\(donations\)\.(insert|update)|./` passes a shape check while
   * matching literally any recorded path, leaving the control worthless. An
   * expectation now has to REJECT all of these to count as precise, which a
   * trivially-true pattern cannot do.
   */
  const DECOYS = [
    "createClient.().auth.getUser",
    "@/lib/auth/founder-check:verifyFounder",
    "createClient.(url).from.(user_roles).select.(role).eq.(user_id).single",
    "createClient.(url).from.(journeys).select.(id).eq.(id).single",
    "createClient.(url).from.(bookings).select.(id).maybeSingle",
    "createClient.(url).from.(donations).select.(amount_cents).eq",
    "getSquareEnv",
    "fetch(https://api.resend.com/emails)",
  ];

  const sloppy: string[] = [];
  for (const c of REFUSING) {
    const matched = DECOYS.filter((d) => c.expect.test(d));
    if (matched.length) sloppy.push(`${c.file}: ${c.expect} also matches ${JSON.stringify(matched)}`);
  }
  assert.deepEqual(
    sloppy,
    [],
    "these expectations match calls that are NOT the route's legacy mutation, " +
      "so the positive control could pass without the write ever happening:\n" +
      sloppy.join("\n"),
  );

  // And each must still be, structurally, a legacy-table mutation.
  const notMutation = REFUSING.filter(
    (c) =>
      !/\\\((donations|financial_commitments|payment_tokens|payment_allocations)\\\)\\\.\(?(insert|update|upsert|delete)/.test(
        c.expect.source,
      ),
  ).map((c) => c.file);
  assert.deepEqual(notMutation, [], "these expectations are not legacy-table mutations");
});

/**
 * The token payment page is a React Server Component, not a route handler, so it
 * is exercised through its default export rather than POST.
 */
test("the token payment page renders the disabled notice and touches nothing", async () => {
  for (const value of DISABLED_VALUES) {
    setFlag(value);
    resetCalls();
    const mod = (await import(path.join(ROOT, "app/pay/[token]/page.tsx"))) as {
      default: (p: { params: Promise<{ token: string }> }) => Promise<unknown>;
    };
    const el = (await mod.default({
      params: Promise.resolve({ token: "tok_probe" }),
    })) as { type?: { name?: string } };

    assert.deepEqual(
      globalThis.__VK_CALLS.map((c) => c.call),
      [],
      `pay page performed side effects while disabled (flag=${value})`,
    );
    assert.equal(
      el?.type?.name,
      "LegacyPaymentsDisabled",
      "pay page must render the disabled notice",
    );
  }
});

/**
 * ONBOARDING ROUTES ARE DELIBERATELY NOT REFUSED.
 *
 * `approve-member` and `add-member-manually` write a $0 draft commitment as a
 * step the code itself marks non-blocking. Refusing the whole route would break
 * member approval, which carries no money, so only the legacy WRITE is
 * suppressed.
 *
 * WHY THIS IS A PAIRED CONTROL. An earlier version asserted only "no
 * financial_commitments write happened while disabled" — and independent review
 * showed both routes could not reach that write in the harness AT ALL, so the
 * assertion held for free and deleting the suppression outright kept the suite
 * green. That is the same vacuity as commit 0f75583 wearing a different hat.
 * The ENABLED half below proves the harness genuinely observes the seed; only
 * then does the DISABLED half mean anything.
 */
const ONBOARDING = [
  {
    file: "app/api/approve-member/route.ts",
    body: { token: "tok1", decidedBy: "founder-1" },
  },
  {
    file: "app/api/add-member-manually/route.ts",
    body: { full_name: "Probe Onboarding", email: "probe@onboarding.test" },
  },
];

const seedWrites = () =>
  globalThis.__VK_CALLS.filter((c) =>
    /\(financial_commitments\)\.insert/.test(c.path),
  );

async function runOnboarding(file: string, body: unknown) {
  resetCalls();
  (globalThis as Record<string, unknown>).__VK_RESOLVE = ONBOARDING_RESOLVER;
  (globalThis as Record<string, unknown>).__VK_FETCH_RESOLVE = ONBOARDING_FETCH;
  try {
    await callPost(file, body);
  } catch {
    /* later steps may fail on stubs; the seed is what is under test */
  }
  delete (globalThis as Record<string, unknown>).__VK_RESOLVE;
  delete (globalThis as Record<string, unknown>).__VK_FETCH_RESOLVE;
}

for (const { file, body } of ONBOARDING) {
  test(`${file} DOES seed a commitment when legacy payments are ENABLED (positive control)`, async () => {
    setFlag("true");
    await runOnboarding(file, body);
    assert.ok(
      seedWrites().length > 0,
      "the harness cannot observe this route's commitment seed, so the " +
        "disabled-state assertion below would prove nothing",
    );
  });

  for (const value of DISABLED_VALUES) {
    const shown = value === undefined ? "absent" : JSON.stringify(value);
    test(`${file} suppresses the commitment seed when the flag is ${shown}`, async () => {
      setFlag(value);
      await runOnboarding(file, body);
      assert.deepEqual(
        seedWrites().map((w) => w.path),
        [],
        "wrote financial_commitments while legacy payments were disabled",
      );
    });
  }

  test(`${file} still completes onboarding while legacy payments are disabled`, async () => {
    setFlag(undefined);
    await runOnboarding(file, body);
    // Onboarding must not be refused: it carries no money. The seed being
    // absent (asserted above) is the only intended difference.
    const refused = globalThis.__VK_CALLS.length === 0;
    assert.ok(!refused, "onboarding was refused outright, which is a regression");
  });
}

/**
 * THE STRIPE EDGE FUNCTION, TESTED INDEPENDENTLY.
 *
 * It runs on Deno, which is not installed here, so it is transpiled and executed
 * against a minimal `Deno` global that captures the handler passed to
 * `Deno.serve`. This is a real invocation of the shipped source — not a source
 * inspection — so removing its guard makes this test red.
 */
async function loadEdgeHandler(flag: string | undefined) {
  const ts = await import("typescript");
  const js = ts.default.transpileModule(
    R("supabase/functions/stripe-webhook/index.ts"),
    { compilerOptions: { target: 99, module: 99 } },
  ).outputText;

  const calls: string[] = [];
  const stub = (name: string): unknown => {
    const p: unknown = new Proxy(function () {}, {
      get: (_t, k) => (k === "then" || typeof k === "symbol" ? undefined : p),
      apply: (_t, _s, a) => {
        calls.push(`${name}(${typeof a[0] === "string" ? a[0] : ""})`);
        return p;
      },
      construct: () => {
        calls.push(`new ${name}`);
        return p;
      },
    });
    return p;
  };

  let handler: ((req: Request) => Promise<Response>) | undefined;
  // The Deno globals the shipped source relies on. `env.get` returns the flag
  // under test and a placeholder for the secrets, so module-scope construction
  // of the Stripe/Supabase clients still succeeds.
  (globalThis as Record<string, unknown>).Deno = {
    env: {
      get: (k: string) => (k === "LEGACY_PAYMENTS_ENABLED" ? flag : "shim-value"),
    },
    serve: (h: (req: Request) => Promise<Response>) => {
      handler = h;
    },
  };
  (globalThis as Record<string, unknown>).__VK_EDGE_STUB = stub;

  // Replace only the two remote imports; everything else is the shipped source.
  const rewritten =
    'const Stripe = globalThis.__VK_EDGE_STUB("stripe");\n' +
    'const createClient = globalThis.__VK_EDGE_STUB("supabase");\n' +
    js
      .replace(/^import[^\n]*@supabase\/supabase-js[^\n]*$/m, "")
      .replace(/^import[^\n]*esm\.sh\/stripe[^\n]*$/m, "");

  // A fresh data: URL each time defeats the module cache, so each flag value
  // genuinely re-executes the source rather than reusing a cached evaluation.
  await import(
    "data:text/javascript;base64," +
      Buffer.from(`${rewritten}\n//${calls.length}-${String(flag)}-${Math.random()}`).toString("base64")
  );

  // Constructing the Stripe and Supabase clients happens at MODULE scope in the
  // shipped source. That is object construction only — no network request and no
  // database access — and it occurs whether or not a request ever arrives, so it
  // is not a side effect of handling one. Clearing here scopes `calls` to what
  // the handler itself does, which is the property under test.
  calls.length = 0;
  return { handler, calls };
}

for (const value of [undefined, "", "false", "TRUE", "1"]) {
  test(`the Stripe Edge Function refuses with 503 and writes nothing (flag=${value ?? "absent"})`, async () => {
    const { handler, calls } = await loadEdgeHandler(value);
    assert.ok(handler, "no handler was registered with Deno.serve");

    const res = await handler(
      new Request("http://edge/stripe-webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=deadbeef" },
        body: JSON.stringify({ type: "checkout.session.completed" }),
      }),
    );

    assert.equal(res.status, 503, "Edge Function must refuse with 503");
    const body = (await res.json()) as { error?: string };
    assert.equal(body.error, "legacy_payments_disabled");
    assert.deepEqual(calls, [], "Edge Function performed side effects while disabled");
  });
}

test("the Edge Function refuses BEFORE verifying the Stripe signature", async () => {
  // No signature header at all. A 400 "no signature" would mean the guard sits
  // after signature handling; 503 proves it is genuinely first.
  const { handler } = await loadEdgeHandler(undefined);
  const res = await handler!(
    new Request("http://edge/stripe-webhook", { method: "POST", body: "{}" }),
  );
  assert.equal(res.status, 503, "signature handling must not precede the guard");
});

test("the Edge Function's flag rule matches the Node implementation exactly", async () => {
  // The Deno copy is duplicated source; this proves the duplication has not drifted.
  const edge = R("supabase/functions/stripe-webhook/index.ts");
  assert.match(
    edge,
    /Deno\.env\.get\("LEGACY_PAYMENTS_ENABLED"\) === "true"/,
    "Edge Function must use the identical strict equality rule",
  );
  const { handler } = await loadEdgeHandler("true");
  const res = await handler!(
    new Request("http://edge/stripe-webhook", { method: "POST", body: "{}" }),
  );
  assert.notEqual(
    res.status,
    503,
    "positive control: 'true' must NOT be refused, or the 503s above are vacuous",
  );
});

/**
 * The writer inventory is AST-derived, so a new legacy writer added later cannot
 * be hidden by a comment. This runs it as a gate.
 */
test("no unguarded writer to a legacy financial table exists", () => {
  const out = execFileSync("node", ["scripts/legacy-writer-inventory.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.match(out, /\n0 unguarded writer\(s\)/, out);
});

test("the writer manifest matches current AST discovery", () => {
  const fresh = execFileSync(
    "node",
    ["scripts/legacy-writer-inventory.mjs", "--json"],
    { cwd: ROOT, encoding: "utf8" },
  );
  const committed = R("supabase/tests/legacy-writers.manifest.json");
  assert.deepEqual(
    JSON.parse(fresh),
    JSON.parse(committed),
    "the committed manifest is stale — a legacy writer was added, removed or " +
      "changed guard status without the manifest being regenerated",
  );
});

test("the client display flag is presentation-only and also fails closed", () => {
  const src = R("lib/payments/legacy-enabled-client.ts");
  assert.match(src, /NEXT_PUBLIC_LEGACY_PAYMENTS_ENABLED === "true"/);
  const flat = src.replace(/\s*\*\s*/g, " ").replace(/\s+/g, " ");
  assert.match(flat, /NOT the enforcement point/i);
});

/**
 * The unredacted wipe archive contains member identifiers and payment tokens.
 * It lives outside the repository on purpose; this proves Git cannot take it.
 */
test("the unredacted wipe archive cannot enter Git", () => {
  const ignore = existsSync(path.join(ROOT, ".gitignore")) ? R(".gitignore") : "";
  assert.match(ignore, /wipe-archive/);

  const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" });
  const offenders = tracked.split("\n").filter((f) => /wipe-archive|census_salt/.test(f));
  assert.deepEqual(offenders, [], `archive-like files are tracked: ${offenders}`);

  const probe = "vital-kauai-financial-wipe-archive-PROBE.md";
  const out = execFileSync("git", ["check-ignore", "-v", "--no-index", probe], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.match(out, /wipe-archive/);
});

test("the committed recovery record carries no member identifiers or tokens", () => {
  const rec = R("docs/financials-v2/PR2_WIPE_RECOVERY_REDACTED.md");
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  assert.ok(!UUID.test(rec), "no UUID may appear in the redacted record");
  assert.ok(!/cs_test_|cs_live_/.test(rec), "no Stripe Checkout Session ids");
  assert.ok(!/\b(pi|ch|re|seti|cus)_[A-Za-z0-9]{8,}/.test(rec), "no Stripe object ids");
  assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(rec), "no email addresses");
  const withoutKnownFilenames = rec.replace(/[\w-]*wipe-archive[\w.-]*/g, "");
  const opaque = withoutKnownFilenames.match(/[A-Za-z0-9_-]{40,}/g) ?? [];
  assert.deepEqual(opaque, [], `token-length opaque strings present: ${opaque}`);
});

/**
 * The Square positive control is only meaningful if the signature it forges is
 * actually being checked. If the verifier were broken or bypassed, the control
 * would "reach the write" for the wrong reason and the case would be no stronger
 * than the reachability-only one it replaced.
 */
test("the Square webhook rejects a wrongly-signed request even when ENABLED", async () => {
  setFlag("true");
  (globalThis as Record<string, unknown>).__VK_RESOLVE = RESOLVER;
  const raw = JSON.stringify({ event_id: "e1", type: "payment.updated", data: {} });

  for (const [label, sig] of [
    ["absent", undefined],
    ["wrong key", squareSignature(raw, TEST_URL) .replace(/^./, (c) => (c === "A" ? "B" : "A"))],
    ["right key, wrong url", squareSignature(raw, "http://localhost/other")],
    ["right key, tampered body", squareSignature(raw + " ", TEST_URL)],
  ] as Array<[string, string | undefined]>) {
    resetCalls();
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (sig) headers["x-square-hmacsha256-signature"] = sig;
    const mod = (await import(path.join(ROOT, "app/api/square/webhook/route.ts"))) as {
      POST: (r: Request) => Promise<Response>;
    };
    const res = await mod.POST(new Request(TEST_URL, { method: "POST", headers, body: raw }));

    assert.equal(res.status, 401, `signature "${label}" should have been rejected`);
    const wrote = globalThis.__VK_CALLS.filter((c) => /\(donations\)\.(insert|update)/.test(c.path));
    assert.deepEqual(wrote, [], `signature "${label}" reached a donations write`);
  }
  delete (globalThis as Record<string, unknown>).__VK_RESOLVE;
});

/**
 * DURABLE ATTRIBUTION. The replacement endpoint must write through the CALLER'S
 * OWN session, not a service-role client.
 *
 * This is not a style preference. A service-role client bypasses RLS, which
 * would make this handler's own role check the only thing in front of the table
 * and would leave `auth.uid()` unset for the statement. Going through the
 * session keeps Postgres authoritative via the `founders write commitments`
 * policy (ALL, `is_founder()`), and it is the same authorisation path the
 * removed browser code used — so the move cannot have widened access.
 */
test("adjust-commitment performs its write through the caller's session, never service-role", async () => {
  setFlag("true");
  resetCalls();
  (globalThis as Record<string, unknown>).__VK_RESOLVE = RESOLVER;
  await callPost("app/api/payments/adjust-commitment/route.ts", {
    commitment_id: "c1",
    action: "set_amount",
    amount_cents: 5000,
  });
  delete (globalThis as Record<string, unknown>).__VK_RESOLVE;

  const writes = globalThis.__VK_CALLS.filter((c) =>
    /\(financial_commitments\)\.update/.test(c.path),
  );
  assert.ok(writes.length > 0, "expected a financial_commitments update");
  for (const w of writes) {
    assert.equal(
      w.module,
      "@/lib/supabase/server",
      "the update must run on the session-bound client so RLS and auth.uid() apply",
    );
  }
  // Belt and braces: the module must not even be able to build a service client.
  assert.ok(
    !/@supabase\/supabase-js/.test(R("app/api/payments/adjust-commitment/route.ts")),
    "adjust-commitment must not import the service-role client at all",
  );
});

/** Authorisation and validation must survive the move off the browser. */
test("adjust-commitment preserves founder authorisation and input validation", async () => {
  setFlag("true");

  const call = async (body: unknown, resolver: unknown) => {
    resetCalls();
    (globalThis as Record<string, unknown>).__VK_RESOLVE = resolver;
    const res = await callPost("app/api/payments/adjust-commitment/route.ts", body);
    delete (globalThis as Record<string, unknown>).__VK_RESOLVE;
    return res;
  };

  // Unauthenticated -> 401, nothing written.
  const anon = (c: string) =>
    c.endsWith("auth.getUser") ? { data: { user: null } } : RESOLVER(c);
  assert.equal((await call({ commitment_id: "c1", action: "mark_fulfilled" }, anon)).status, 401);

  // Authenticated non-founder -> 403, nothing written.
  const member = (c: string) =>
    /\(user_roles\).*\.single$/.test(c) ? { data: { role: "member" } } : RESOLVER(c);
  const forbidden = await call({ commitment_id: "c1", action: "mark_fulfilled" }, member);
  assert.equal(forbidden.status, 403);
  assert.deepEqual(
    globalThis.__VK_CALLS.filter((c) => /\(financial_commitments\)\.update/.test(c.path)),
    [],
    "a non-founder reached the write",
  );

  // Validation: below the $1.00 floor the UI enforced, and an unknown action.
  assert.equal(
    (await call({ commitment_id: "c1", action: "set_amount", amount_cents: 99 }, RESOLVER)).status,
    400,
  );
  assert.equal(
    (await call({ commitment_id: "c1", action: "delete_everything" }, RESOLVER)).status,
    400,
  );
  assert.equal((await call({ action: "mark_fulfilled" }, RESOLVER)).status, 400);
});

/** The dashboard component must retain no path to the database at all. */
test("MemberFinancialSection holds no database client and no direct table write", () => {
  const src = R("app/dashboard/[id]/MemberFinancialSection.tsx");
  assert.ok(!/supabase\/client/.test(src), "must not import a browser Supabase client");
  assert.ok(!/createClient\s*\(/.test(src), "must not construct a Supabase client");
  assert.ok(!/\.from\(["'][a-z_]+["']\)/.test(src), "must not address a table directly");
  assert.match(src, /\/api\/payments\/adjust-commitment/, "must route through the guarded endpoint");
});
