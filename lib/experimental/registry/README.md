# Experimental Pilot Registry

The registry keeps the lab honest.

Every experiment under `lib/experimental/` is tracked here with an explicit
**hypothesis**, **safety boundary**, **removability** statement, declared
**production impact**, and a current **decision**. Before we attempt any larger
Human Record work — timeline, canonical records, evidence engine, AI — we hold
ourselves to naming what we are testing and what it is allowed to touch.

This is discipline, not architecture. The registry is a small, pure, in-memory
TypeScript model with a read-only API. It has no database, no persistence, no UI,
and no production import. The registry itself is **infrastructure for tracking
experiments, not an experiment** — so it is not registered as a pilot. (The lab
narrative counts it as the second capability, which is why experiment ids skip
from `experiment-001` to `experiment-003`; the gap is deliberate.)

## Implementation Questions (the Charter)

The lab's "Charter" is simply the questions we ask before adding any experiment.
There is no separate charter artifact — it lives here:

1. What is true now?
2. What hypothesis are we testing?
3. Does this affect production?
4. Can this be deleted tomorrow?
5. Does this make the lab more disciplined — does it reduce assumptions?

If an experiment cannot answer these cleanly, simplify it until it can. Each
experiment also records its own answers in its `hypothesis`, `safety_boundary`,
and `removability` fields.

## The model

Each experiment is an `ExperimentalPilot` (see [`types.ts`](./types.ts)) with two
orthogonal axes that must never be conflated:

- **`status`** — the operational lifecycle position: *where the experiment is
  right now*. One of `draft`, `active`, `paused`, `completed`, `rejected`,
  `promoted`. The last three are **terminal**.
- **`decision`** — the team's current verdict: *what we intend to do about it*.
  One of `keep`, `revise`, `delete`, `promote`, `undecided`.

### Legal status / decision pairings

Enforced by [`verify.ts`](./verify.ts):

| Rule | |
| --- | --- |
| A terminal status (`completed`, `promoted`, `rejected`) | must **not** be `undecided`. |
| `status === 'promoted'` | requires `decision === 'promote'`. |
| `status === 'rejected'` | requires `decision === 'delete'` or `'revise'`. |
| Non-terminal (`draft`, `active`, `paused`) | may carry any decision, including `undecided`. |

### Production impact

`production_impact` declares the experiment's blast radius:

| Impact | Production-safe? | Meaning |
| --- | --- | --- |
| `none` | ✅ | Pure thought / scaffolding; no reachable code. |
| `read_only` | ✅ | May read production data; never writes or alters it. |
| `internal_only` | ✅ | Real code exists, reachable only from the experimental namespace; cannot alter production. |
| `production_candidate` | ⚠️ | Proposed for production; requires extra review. |
| `production` | ⚠️ | Live in production. |

`isProductionSafeExperiment(experiment)` returns `true` only for the first three.

## Public API

Import from [`index.ts`](./index.ts) — the registry is read-only and cannot be
mutated through this surface (the seed is deeply frozen and every getter returns
a deep copy):

```ts
getExperiments(): ExperimentalPilot[]
getExperimentById(id: string): ExperimentalPilot | undefined
listActiveExperiments(): ExperimentalPilot[]
listCompletedExperiments(): ExperimentalPilot[]
isProductionSafeExperiment(experiment: ExperimentalPilot): boolean
```

## Lifecycle

### Adding an experiment

The registry is **registry-as-code**. To add one:

1. Append a record to the `REGISTRY` array in [`data.ts`](./data.ts).
2. Give it the next zero-padded id (`experiment-002`, …) and a human `name`.
3. Fill in every field — especially `hypothesis`, `safety_boundary`, and
   `removability`. Declare its `production_impact` honestly.
4. Open a PR. Review is the gate; there is no other write path.

### Evaluating an experiment

An experiment is judged against its own `success_criteria`. As evidence comes
in, advance its `status` and record the team's `decision`. The two move
independently: an `active` experiment can already be `keep`, an experiment can be
`paused` while `undecided`.

### Deleting an experiment

Because every experiment is removable by construction, deletion is safe: set
`status: 'rejected'` with `decision: 'delete'` (or `'revise'`), then, in a
follow-up PR, remove its code from `lib/experimental/`. Production is unaffected
either way.

### Promotion

Promotion means a capability has earned a place in production. It is a two-step
move, never a silent one:

1. Mark the experiment `status: 'promoted'`, `decision: 'promote'` here.
2. In a **separate, reviewed PR**, actually move the capability out of
   `lib/experimental/` into the production codebase — with the database, UI,
   permissions, and tests that production work requires.

Recording the promotion is not the promotion. Step 2 is.

## Verifying

[`verify.ts`](./verify.ts) exposes a pure `verifyRegistry(records?)` that returns
structured results, and prints + exits non-zero when run as the entry point.

```sh
# Type-check (the repo's real gate):
npx tsc --noEmit

# Run the invariant + behavior checks (throwaway transpile, zero deps):
npx tsc lib/experimental/registry/*.ts \
  --outDir node_modules/.cache/registry-verify \
  --module commonjs --moduleResolution node --target es2019 \
  --esModuleInterop --skipLibCheck \
  && node node_modules/.cache/registry-verify/verify.js
```

It confirms the data-shape invariants (unique ids, id convention, non-empty
narrative fields, declared enums, valid timestamps, legal status/decision
pairings) and the public-API behavior (full read, immutability, lookup by id,
correct filtering, and impact classification across all five impacts).
