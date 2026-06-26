// lib/experimental/provenance/verify.ts
//
// A tiny, dependency-free verification harness for the provenance module.
//
// The repository has no test runner, and the Human Record Pilot charter asks us
// to stay minimal and add no premature infrastructure. So instead of pulling in
// a framework, this file exercises the public surface with Node's built-in
// assertions. The module uses the repo's idiomatic extensionless imports, so it
// is run via a throwaway transpile rather than directly:
//
//   npx tsc lib/experimental/provenance/*.ts \
//     --outDir node_modules/.cache/provenance-verify \
//     --module commonjs --moduleResolution node --target es2019 \
//     --esModuleInterop --skipLibCheck \
//     && node node_modules/.cache/provenance-verify/verify.js
//
// It confirms the checklist from PR 1: provenance can be created, can be
// updated, and is strictly additive — without touching anything in production.

import assert from "node:assert/strict";

import {
  createProvenance,
  describeProvenance,
  getProvenance,
  isProvenance,
  PROVENANCE_KEY,
  touchProvenance,
  withProvenance,
} from "./index";

const checks: string[] = [];
function check(name: string, fn: () => void): void {
  fn();
  checks.push(name);
}

// --- created ---------------------------------------------------------------
check("provenance can be created", () => {
  const p = createProvenance(
    {
      created_by_user_id: "655b4536",
      created_by_role: "founder",
      source_type: "staff_entered",
      source_label: "Rachel",
      record_kind: "operational",
    },
    { now: "2026-06-25T00:00:00.000Z" },
  );

  assert.ok(isProvenance(p), "result is a well-formed Provenance");
  assert.equal(p.created_at, "2026-06-25T00:00:00.000Z");
  assert.equal(p.created_at, p.updated_at, "created_at and updated_at start equal");
  assert.equal(p.source_type, "staff_entered");
  assert.equal(p.record_kind, "operational");
});

check("optional fields default to null", () => {
  const p = createProvenance({
    source_type: "unknown",
    record_kind: "system_event",
  });
  assert.equal(p.created_by_user_id, null);
  assert.equal(p.created_by_role, null);
  assert.equal(p.source_label, null);
});

// --- updated ---------------------------------------------------------------
check("provenance can be updated without losing creation facts", () => {
  const created = createProvenance(
    { source_type: "member_submitted", record_kind: "evidence" },
    { now: "2026-06-25T00:00:00.000Z" },
  );
  const touched = touchProvenance(created, { now: "2026-06-26T12:00:00.000Z" });

  assert.equal(touched.created_at, created.created_at, "created_at is preserved");
  assert.equal(touched.updated_at, "2026-06-26T12:00:00.000Z", "updated_at advances");
  assert.notEqual(touched.updated_at, touched.created_at);
  // The original bundle is untouched (pure update).
  assert.equal(created.updated_at, "2026-06-25T00:00:00.000Z");
});

// --- additive --------------------------------------------------------------
check("attaching provenance is strictly additive", () => {
  const record = { id: "note_1", body: "Member arrived grounded.", pinned: true };
  const original = { ...record };

  const provenance = createProvenance({
    source_type: "staff_entered",
    record_kind: "operational",
  });
  const enriched = withProvenance(record, provenance);

  // Every original field survives unchanged...
  assert.deepEqual(
    { id: enriched.id, body: enriched.body, pinned: enriched.pinned },
    original,
  );
  // ...provenance is added under its namespaced key...
  assert.ok(PROVENANCE_KEY in enriched);
  assert.deepEqual(getProvenance(enriched), provenance);
  // ...and the source record is never mutated.
  assert.deepEqual(record, original);
  assert.equal((record as Record<string, unknown>)[PROVENANCE_KEY], undefined);
});

// --- inspection ------------------------------------------------------------
check("developer inspection renders a readable summary", () => {
  const p = createProvenance({
    created_by_user_id: "655b4536",
    source_type: "staff_entered",
    source_label: "Rachel",
    record_kind: "operational",
  });
  assert.equal(
    describeProvenance(p),
    ["Created by: Rachel", "Source: Staff Entered", "Kind: Operational"].join("\n"),
  );
});

// --- report ----------------------------------------------------------------
for (const name of checks) {
  console.log(`  ✓ ${name}`);
}
console.log(`\n${checks.length} provenance checks passed.`);
