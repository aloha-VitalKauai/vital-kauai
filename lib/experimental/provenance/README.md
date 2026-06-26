# Provenance metadata

Provenance is the first building block of the Human Record Pilot.

Every future Human Record concept — timelines, evidence, interpretation,
governance — depends on one humble discipline: knowing **where a piece of
information came from**. This module begins establishing that discipline as a
small, pure, additive TypeScript layer. It is the seed, not the architecture.

> **This module is inert in production.** It is pure types and pure functions.
> It performs no I/O, touches no database, and is imported by nothing in `app/`,
> `components/`, or the rest of `lib/`. Deleting this folder leaves the platform
> exactly as it is.

## The shape

A provenance bundle is seven fields:

| Field                | Type                       | Meaning                                          |
| -------------------- | -------------------------- | ------------------------------------------------ |
| `created_by_user_id` | `string \| null`           | Who created the record, if known.                |
| `created_by_role`    | `string \| null`           | The role they acted in (e.g. `founder`, `staff`).|
| `created_at`         | `string` (ISO 8601)        | When the record was first created.               |
| `updated_at`         | `string` (ISO 8601)        | When the provenance was last touched.            |
| `source_type`        | `SourceType`               | The kind of origin (see below).                  |
| `source_label`       | `string \| null`           | A human-readable origin label (e.g. "Rachel").   |
| `record_kind`        | `RecordKind`               | What kind of information this is (see below).     |

### `source_type`

Where the information originated.

- `member_submitted` — a member entered it themselves.
- `staff_entered` — a staff member recorded it.
- `system_generated` — the platform produced it.
- `imported` — it arrived from a prior system or dataset.
- `external_document` — it came from a document outside the platform.
- `unknown` — origin not established. A first-class, honest value.

### `record_kind`

What kind of thing the record is, epistemically.

- `evidence` — a primary observation or artifact: something happened.
- `interpretation` — a reading or summary layered on top of evidence.
- `operational` — coordination data: tasks, notes, scheduling housekeeping.
- `system_event` — something the platform recorded automatically.

Keeping **evidence** distinct from **interpretation** is the most valuable line
this module can draw, so it earns a place from day one.

## Using it

```ts
import {
  createProvenance,
  touchProvenance,
  withProvenance,
} from "@/lib/experimental/provenance";

// Mint provenance for a freshly created operational note.
const provenance = createProvenance({
  created_by_user_id: user.id,
  created_by_role: "founder",
  source_type: "staff_entered",
  source_label: "Rachel",
  record_kind: "operational",
});

// Attach it additively — the original record is copied, never mutated, and no
// existing field is touched. Provenance lives under a single `provenance` key.
const enriched = withProvenance(note, provenance);

// Later, when the note changes, advance updated_at while preserving created_at.
const reprovenanced = touchProvenance(provenance);
```

For internal debugging there is `describeProvenance`, which renders:

```
Created by: Rachel
Source: Staff Entered
Kind: Operational
```

This is developer inspection only. It is wired into no production UI and changes
no member or staff experience.

## Scope and boundaries

Provenance is, conceptually, for **safe non-medical records**: CRM notes,
operational notes, tasks, journey completion records, and non-medical document
metadata.

It is deliberately kept away from medical records, contraindications, screening,
ceremony records, PHI workflows, and any Level-4 information. Those remain
entirely outside this pilot.

## Not in this PR

PR 1 establishes the *types and discipline* only. It intentionally adds **no
database column, no migration, and no persistence** — provenance is not yet
stored anywhere. Wiring provenance to real records, behind appropriate review,
is future work that begins only after this foundation proves itself.

## Verifying

The repository has no test runner, and the pilot charter asks us to add no
premature infrastructure. Verification therefore leans on the toolchain already
present.

The real gate is the type-checker — the experimental files are part of the
project's program, so they must compile cleanly:

```sh
npx tsc --noEmit
```

The runtime invariants live in [`verify.ts`](./verify.ts), a small
dependency-free harness. Because the module uses the repo's idiomatic
extensionless imports (which Node's ESM loader will not resolve directly), it is
run through a throwaway transpile into a gitignored cache:

```sh
npx tsc lib/experimental/provenance/*.ts \
  --outDir node_modules/.cache/provenance-verify \
  --module commonjs --moduleResolution node --target es2019 \
  --esModuleInterop --skipLibCheck \
  && node node_modules/.cache/provenance-verify/verify.js
```

It confirms provenance can be created, can be updated (advancing `updated_at`
while preserving `created_at`), and attaches strictly additively without
mutating the record it describes.
