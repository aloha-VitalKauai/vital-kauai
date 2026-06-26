# Experimental Relationship Layer

Objects rarely exist alone; their meaning comes from how they relate.

This layer states, descriptively, that two observed objects are connected —
through a small, typed, immutable vocabulary. Relationships precede
understanding; understanding precedes intelligence. This is an experiment in
context, not intelligence.

## What a relationship is

- A **descriptive, immutable** statement that two observed objects have a
  connection of a known kind.
- **Endpoints are observation names**, each resolving to a real
  `ObservationReport` (checked at verification time).
- **Small and closed.** The vocabulary is a fixed union, so a relationship is
  checkable and duplicate detection is mechanical.

## What a relationship is not

- It **never changes** either object and **never reads** production at runtime.
- It **never infers meaning**, ranks importance, or analyzes anything. It states
  a connection; it does not interpret one. (No AI lives here, by design.)
- It is **not** a knowledge graph, a search index, a timeline, or business
  logic. It only describes how observed things connect.

## The model

See [`types.ts`](./types.ts) and [`data.ts`](./data.ts).

- **`RelationshipType`** is a closed union: `references`, `belongs_to`,
  `associated_with`, `created_by`, `precedes`. `follows` is intentionally
  omitted — it is the inverse of `precedes`, and a `precedes` edge with swapped
  endpoints states the same fact.
- **`RELATIONSHIP_TYPES`** (in `data.ts`) maps each type to `{ symmetric }`.
  Symmetric (`associated_with`) means the pair is unordered — `A` and `B` is the
  same fact as `B` and `A` — which drives duplicate detection. The
  `Record<RelationshipType, …>` typing keeps the map and the union from drifting.
- **`Relationship`** is fully `readonly`: `id` (`rel-NNN`), `source_object`,
  `target_object`, `relationship_type`, `created_at` (ISO-8601), optional
  `notes`.

## Public API

Import from [`index.ts`](./index.ts). Returned relationships are frozen deep
copies; there are no mutation functions.

```ts
listRelationships(): readonly Relationship[]
getRelationshipsFor(objectName: string): readonly Relationship[]
findRelationship(source: string, target: string): readonly Relationship[]
hasRelationship(source: string, target: string): boolean
listRelationshipTypes(): readonly RelationshipType[]
```

- `getRelationshipsFor(name)` — every relationship where `name` is source or
  target. Unknown name → `[]`.
- `findRelationship(source, target)` — every relationship connecting the
  **unordered pair** `{source, target}`, in either direction. Plural, because two
  objects may share several relationships. `[]` if none, or if either name is
  unknown.
- `hasRelationship(source, target)` — `true` iff `findRelationship` is non-empty.
- `listRelationshipTypes()` — the closed vocabulary (keys of
  `RELATIONSHIP_TYPES`).

## The seed

A small cast connecting the observed objects — enough to validate the model, not
to cover the domain:

| id | source | type | target |
| --- | --- | --- | --- |
| rel-001 | CRM Note | belongs_to | Member |
| rel-002 | Operational Task | associated_with | Member |
| rel-003 | Journey Milestone | precedes | Integration Session |
| rel-004 | CRM Note | references | Operational Task |
| rel-005 | Integration Session | created_by | Member |
| rel-006 | Journey Milestone | associated_with | Member |

Every endpoint resolves to an `ObservationReport` (the observation seed was
expanded additively to include Member, Operational Task, Journey Milestone, and
Integration Session). Observational descriptions only; production is untouched.

## Dependency direction (important)

Relationships depend on observation, one way only:

```
experiment-004 (relationships) ──▶ experiment-003 (observation) ──▶ (nothing)
```

`relationships` imports observation's read-only API (`getObservation`) to resolve
endpoints **at verification time**. Observation must **never** import
relationships; `verify.ts` asserts there is no back-edge, so the graph stays
acyclic.

Deleting the whole `lib/experimental/` namespace stays clean. The one
disallowed order is deleting `observation` alone while `relationships` still
exists — so **delete relationships before, or together with, observation.**

"No production imports" is a **module-boundary and lint guarantee**, enforced by
the project's ESLint/TypeScript config, not asserted at runtime. Nothing in
`app/`, `components/`, or the rest of `lib/` imports this module, and it pulls in
no production code, database, React, Next.js, or Supabase.

## The Charter

This layer is held to the lab's single Charter — the Implementation Questions
documented once in [`../registry/README.md`](../registry/README.md). Individual
experiments do not keep their own divergent copies.

## Verifying

[`verify.ts`](./verify.ts) exposes a pure `verifyRelationships(relationships?)`
that returns structured results, and prints + exits non-zero when run as the
entry point (including the module-cycle boundary check). Because it imports
observation, both modules are transpiled together:

```sh
# Type-check (the repo's real gate):
npx tsc --noEmit

# Run the invariant + behavior + immutability + boundary checks:
npx tsc lib/experimental/relationships/*.ts lib/experimental/observation/*.ts \
  --outDir node_modules/.cache/relationships-verify \
  --module commonjs --moduleResolution node --target es2019 \
  --esModuleInterop --skipLibCheck \
  && node node_modules/.cache/relationships-verify/relationships/verify.js
```

It confirms the invariants (unique `rel-NNN` ids, valid types, ISO timestamps,
non-empty optional notes, every endpoint resolves to an observation, no
self-references, no symmetry-aware duplicates), the public-API behavior (touch
lookup, unordered-pair `findRelationship`, `hasRelationship` agreement, the type
vocabulary), immutability (frozen returns, an unmutable seed), and the acyclic
module boundary.
