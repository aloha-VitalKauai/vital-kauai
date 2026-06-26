# Experimental Observation Layer

Before redesigning reality, understand it.

Observation describes existing production objects through a consistent, typed
lens — **without touching them**. Production already holds years of thoughtful
work and remains the source of truth. This layer lets future experiments reason
from observation instead of assumption.

## What observation is

- A **typed, immutable description** of a production object: what kind of thing
  it is, which capabilities it currently has, its observed condition, and where
  it sits in production.
- **Read-only and static.** Each observation is hand-authored in `data.ts`. The
  layer reads nothing from production at runtime.
- **Mechanical about absence.** `absent_capabilities` is *derived* as the exact
  complement of what was observed present — never authored.

## What observation is not

- It does **not** modify, wrap, or read the real object at runtime.
- It is **not** a judgment, a recommendation, or a plan. "Absent" is a fact
  about what was observed, not advice about what to add.
- It is **not** a Human Record, an object model, business logic, or an
  integration. It only observes.

## Vocabulary reconciliation

Earlier documents drifted between "PR", "Experiment", and "Capability". They are
one thing from two angles:

- The **registry** (`../registry`) is the source of truth and gives each
  experiment an id `experiment-NNN`. Code uses these ids everywhere.
- The lab narrative numbers capabilities "Capability NNN" for readability.
- **Capability 003 and `experiment-003` are one record** — this observation
  layer.

The "Charter" referenced in earlier documents is simply the Implementation
Questions below; it lives here and in the registry README, not as a separate
artifact.

A note on numbering: the registry holds `experiment-001` (provenance) and
`experiment-003` (observation). There is intentionally **no `experiment-002`** —
the registry itself is the second capability in the human narrative, but PR 2
resolved that the registry is infrastructure, not a registered experiment. The
id gap is deliberate; ids are unique identifiers, not sequence positions.

## The model

See [`types.ts`](./types.ts).

- **`Capability`** is a **closed union** (`identity`, `timestamp`, `content`,
  `provenance`, `versioning`, `relationships`, `timeline_participation`). Closed,
  so reports are checkable and "absent" is mechanical. `ALL_CAPABILITIES`
  (`data.ts`) lists them in canonical order — the single source for the
  complement.
- **Capabilities and attributes are separate concerns.** Capabilities are
  features the object *has*; `ObservedAttributes` (`mutable`, `member_visible`,
  `operational`, `experimental`) is its current *condition*.
- **`absent_capabilities` is derived**, not authored: `ALL_CAPABILITIES` minus
  `current_capabilities`, and verified to be the exact complement.

## Public API

Import from [`index.ts`](./index.ts). Returned reports are frozen deep copies, so
a caller can neither mutate a report nor reach the observation set through one.

```ts
listObservations(): ObservationReport[]
getObservation(name: string): ObservationReport | undefined
hasCapability(name: string, capability: Capability): boolean
listCapabilities(name: string): readonly Capability[]
```

Unknown-name semantics (mirroring the registry):

| Call | Result |
| --- | --- |
| `getObservation(unknown)` | `undefined` |
| `hasCapability(unknown, _)` | `false` |
| `listCapabilities(unknown)` | `[]` |

`hasCapability`'s `capability` parameter is typed as `Capability`, so an unknown
capability string is a **compile-time error**, not a runtime miss.

## The seed

One concrete object, fully specified: a production **CRM Note** (`record`) with
`identity`, `timestamp`, and `content` observed present — so `provenance`,
`versioning`, `relationships`, and `timeline_participation` derive as absent.
Observation only; the real CRM Note is untouched.

## Module boundary (not a runtime assertion)

"No production imports" is a **module-boundary and lint guarantee**, enforced by
the project's ESLint/TypeScript config — not something asserted at runtime.
Nothing in `app/`, `components/`, or the rest of `lib/` imports this module, and
this module imports no production code, database, React, Next.js, or Supabase. It
does not even import its sibling experiments (provenance, registry), so it stays
independently deletable.

## Implementation Questions (the Charter)

Ask these before adding anything here:

1. Does this **observe** rather than modify?
2. Does production remain **untouched**?
3. Can this be **deleted tomorrow**?
4. Does this help us **understand** the existing system better?
5. Does this **reduce assumptions**?

If not, simplify.

## Verifying

[`verify.ts`](./verify.ts) exposes a pure `verifyObservations(reports?)` that
returns structured results, and prints + exits non-zero when run as the entry
point.

```sh
# Type-check (the repo's real gate):
npx tsc --noEmit

# Run the invariant + behavior + immutability checks (throwaway transpile):
npx tsc lib/experimental/observation/*.ts \
  --outDir node_modules/.cache/observation-verify \
  --module commonjs --moduleResolution node --target es2019 \
  --esModuleInterop --skipLibCheck \
  && node node_modules/.cache/observation-verify/verify.js
```

It confirms the data-shape invariants (unique names, non-empty fields, valid
unions, subset capabilities with no duplicates, and `absent` as the exact
complement), the public-API behavior (full read, known/unknown lookups,
capability queries), and immutability (returned reports are deeply frozen and
the observation set cannot be mutated through the API).
