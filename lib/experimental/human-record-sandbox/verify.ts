// lib/experimental/human-record-sandbox/verify.ts
//
// Static safety scan for experiment-006, the Human Record Sandbox.
//
// Unlike the other lab capabilities, the sandbox is a real (founder-gated) route
// that reads live production data, so its guarantees are structural rather than
// data-shape invariants. This harness reads the page source and asserts those
// guarantees by inspection — zero third-party dependencies (node:fs/node:path
// are built-ins). It is the boundary enforcer that keeps the sandbox read-only,
// AI-free, and clear of medical / PHI fields.
//
//   1. Import `verifySandbox()` — a pure function returning structured results.
//   2. Run as the entry point — prints results, exits non-zero on any failure:
//
//        npx tsc lib/experimental/human-record-sandbox/verify.ts \
//          --outDir node_modules/.cache/sandbox-verify \
//          --module commonjs --moduleResolution node --target es2019 \
//          --esModuleInterop --skipLibCheck \
//          && node node_modules/.cache/sandbox-verify/verify.js
//
// Run from the repo root (the documented location), so the page source resolves.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type VerifyCheck = { name: string; ok: boolean; detail?: string };
export type VerifyResult = {
  ok: boolean;
  passed: number;
  failed: number;
  checks: VerifyCheck[];
};

const PAGE_PATH = "app/dashboard/lab/human-record/page.tsx";
const TABS_PATH = "app/dashboard/DashboardTabs.tsx";

// Write methods that would mutate production. The sandbox must use none.
const WRITE_METHODS = [".insert(", ".update(", ".delete(", ".upsert(", ".rpc("];

// Network / external-service tokens. The sandbox must reach none.
const NETWORK_TOKENS = ["fetch(", "axios", "XMLHttpRequest", "node-fetch"];

// AI / LLM provider tokens. The sandbox must call none.
const AI_TOKENS = [
  "anthropic",
  "openai",
  "langchain",
  "@anthropic-ai",
  "generativeai",
  "cohere",
  "mistral",
  "gemini",
  "gpt-",
  "claude-",
  "llm(",
];

// Medical / screening / contraindication / dosing / assessment / PHI identifiers
// (tables, columns, components, helpers) the sandbox must NEVER reference. These
// are exact tokens, none of which is a substring of a safe field the page uses
// (e.g. `medical_disclaimer_signed` is safe and is not matched by `medical_cleared`).
const FORBIDDEN_PHI = [
  "lab_documents",
  "dosing_records",
  "medicine_batches",
  "ceremony_records",
  "member_assessment_status",
  "intake_forms",
  "MemberMedicalPanel",
  "getContraindications",
  "getFlags",
  "health_history",
  "current_medications",
  "psychiatric_history",
  "substance_history",
  "heart_conditions",
  "blood_pressure",
  "resting_heart_rate",
  "iboga_contraindications",
  "medication_interactions",
  "medical_notes",
  "medical_cleared",
  "cardiac_cleared",
  "bp_systolic",
  "bp_diastolic",
  "heart_rate",
  "phq9",
  "gad7",
  "dose_g",
  "qtc",
  "adverse_events",
  "founder_notes",
  "ai_extracted_data",
  "ai_summary",
  "track_ptsd",
  "track_addiction",
  "track_chronic_illness",
  "track_autism",
];

function readOrNull(relativePath: string): string | null {
  try {
    return readFileSync(join(process.cwd(), relativePath), "utf8");
  } catch {
    return null;
  }
}

function firstHit(haystack: string, tokens: readonly string[]): string | null {
  for (const t of tokens) if (haystack.includes(t)) return t;
  return null;
}

/**
 * Verify the sandbox's structural guarantees by reading its source. Pure with
 * respect to mutation; reads files only. Returns structured results.
 */
export function verifySandbox(): VerifyResult {
  const checks: VerifyCheck[] = [];
  const add = (name: string, ok: boolean, detail?: string) =>
    checks.push({ name, ok, detail });

  const page = readOrNull(PAGE_PATH);
  const tabs = readOrNull(TABS_PATH);

  if (page === null) {
    add(`page source found at ${PAGE_PATH}`, false, "run from the repo root");
    const failed = checks.filter((c) => !c.ok).length;
    return { ok: false, passed: checks.length - failed, failed, checks };
  }
  add(`page source found at ${PAGE_PATH}`, true);

  const writeHit = firstHit(page, WRITE_METHODS);
  add("read-only: no write methods (insert/update/delete/upsert/rpc)", writeHit === null, writeHit ?? undefined);

  const netHit = firstHit(page, NETWORK_TOKENS);
  add("no external network calls", netHit === null, netHit ?? undefined);

  const aiHit = firstHit(page.toLowerCase(), AI_TOKENS);
  add("no AI / LLM calls", aiHit === null, aiHit ?? undefined);

  const phiHit = firstHit(page, FORBIDDEN_PHI);
  add(
    "no medical / screening / dosing / assessment / PHI identifiers",
    phiHit === null,
    phiHit ? `references "${phiHit}"` : undefined,
  );

  add(
    "founder-gated: imports verifyFounder and redirects",
    page.includes("verifyFounder") && page.includes("redirect("),
  );

  add(
    "reads via the founder-session Supabase server client",
    page.includes("@/lib/supabase/server"),
  );

  add(
    "consumes the lab capabilities (observation, relationships, lenses)",
    page.includes("@/lib/experimental/observation") &&
      page.includes("@/lib/experimental/relationships") &&
      page.includes("@/lib/experimental/lenses"),
  );

  if (tabs === null) {
    add("DashboardTabs source found", false);
  } else {
    add(
      "not wired into navigation (absent from DashboardTabs)",
      !tabs.includes("human-record") && !tabs.includes("lab/human-record"),
    );
  }

  const failed = checks.filter((c) => !c.ok).length;
  return { ok: failed === 0, passed: checks.length - failed, failed, checks };
}

// --- entry point -------------------------------------------------------------
if (
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module
) {
  const result = verifySandbox();
  for (const c of result.checks) {
    const mark = c.ok ? "  ✓" : "  ✗";
    const detail = !c.ok && c.detail ? ` — ${c.detail}` : "";
    console.log(`${mark} ${c.name}${detail}`);
  }
  console.log(`\n${result.passed} passed, ${result.failed} failed.`);
  if (!result.ok) process.exit(1);
}
