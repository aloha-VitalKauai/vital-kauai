# Experimental Lens Framework

The Human Record preserves reality; Lenses help interpret it. These are not the
same thing.

A **Lens** is an optional interpretive framework through which someone may choose
to understand observed reality. This framework lets many interpretive frameworks
coexist as catalogued metadata — without any one becoming the platform's source
of truth. Observed reality (the [observation layer](../observation)) stays
primary; lenses remain optional ways of understanding it.

## Evidence is not interpretation

This is the foundational separation the framework protects:

- **Observation** records what *is* — evidence, primary, authoritative about
  itself.
- **A Lens** offers a way to *interpret* — optional, descriptive, replaceable.

A lens never changes an observation, never becomes evidence, and never ranks
above another lens. Keeping the two apart lets future systems support many
perspectives without coupling the architecture to any single philosophy.

## What a Lens is

Optional · descriptive · replaceable · versionable · independent. It records that
an interpretive framework exists and what it broadly concerns — as metadata only.

## What a Lens is not

A Lens is never authoritative, diagnostic, objective truth, or required. It runs
no calculations and contains no framework-specific logic — no birth-chart
generation, no Human Design engine, no Gene Keys logic, no dosha assessment.

## The boundary, enforced by omission

The non-authoritative property is structural, because prose cannot be reliably
policed:

- The `Lens` model has **no field** that can express truth, rank, precedence,
  weight, confidence, accuracy, correctness, efficacy, or diagnosis. None may be
  added without consciously reopening this boundary.
- [`verify.ts`](./verify.ts) asserts each lens carries **exactly** the keys in
  `LENS_KEYS` — no missing, and crucially **no extra** — so a `score`,
  `authority`, or `is_correct` field cannot be smuggled in later.
- Category and storage order carry no precedence; there is no weight or ranking
  field by construction.
- `description` is **efficacy-neutral** metadata: it states what a framework is,
  never that it works or yields true results.

## The model

See [`types.ts`](./types.ts) and [`data.ts`](./data.ts).

- **`LensCategory`** is a closed union (`symbolic`, `psychological`,
  `behavioral`, `physiological`, `spiritual`, `assessment`, `other`). It
  organizes; it does not rank.
- **`LensStatus`** is `draft` | `active` | `deprecated` — the lifecycle of the
  *entry's metadata*, not a judgment of the framework.
- **`Lens`** is fully `readonly`: `id` (`lens-NNN`), `name` (unique,
  case-insensitive), `description` (efficacy-neutral), `version` (integer ≥ 1),
  `category` (a single **primary** category — organizational and revisable), and
  `status`.

A single primary category is deliberate: some frameworks span several, but
forcing one keeps the model minimal and avoids implying a framework's categories
are settled fact.

## Public API

Import from [`index.ts`](./index.ts). Returned lenses are frozen deep copies;
there are no mutation functions.

```ts
listLenses(): readonly Lens[]
getLens(id: string): Lens | undefined
getLensByName(name: string): Lens | undefined   // case-insensitive
listLensCategories(): readonly LensCategory[]
```

Unknown id/name → `undefined` (fails cleanly, never throws).
`listLensCategories()` returns the full `LENS_CATEGORIES` vocabulary.

## The seed

A few placeholder frameworks, recorded as metadata only — the lab noting that
they exist:

| id | name | category | version | status |
| --- | --- | --- | --- | --- |
| lens-001 | Western Astrology | symbolic | 1 | active |
| lens-002 | Human Design | symbolic | 1 | active |
| lens-003 | Gene Keys | spiritual | 1 | active |
| lens-004 | Ayurveda | physiological | 1 | active |

Category assignments are organizational placeholders and may be revised.

## Standalone leaf

Lenses depend on nothing. They never read, import, or reference observations,
provenance, relationships, or the registry's runtime data (the registry only
*lists* the experiment, as for every capability). Deleting
`lib/experimental/lenses/` (and its registry entry) leaves production and every
other experiment unchanged.

"No production imports" is a **module-boundary and lint guarantee**, enforced by
the project's ESLint/TypeScript config, not asserted at runtime. Nothing in
`app/`, `components/`, or the rest of `lib/` imports this module.

## The Charter

This layer is held to the lab's single Charter — the Implementation Questions
documented once in [`../registry/README.md`](../registry/README.md). Individual
experiments do not keep their own divergent copies.

## Verifying

[`verify.ts`](./verify.ts) exposes a pure `verifyLenses(lenses?)` that returns
structured results, and prints + exits non-zero when run as the entry point.

```sh
# Type-check (the repo's real gate):
npx tsc --noEmit

# Run the invariant + shape + behavior + immutability checks:
npx tsc lib/experimental/lenses/*.ts \
  --outDir node_modules/.cache/lenses-verify \
  --module commonjs --moduleResolution node --target es2019 \
  --esModuleInterop --skipLibCheck \
  && node node_modules/.cache/lenses-verify/verify.js
```

It confirms the invariants (unique `lens-NNN` ids, case-insensitive unique
names, non-empty fields, valid category/status, integer version ≥ 1), the
**exact-keys shape check** that enforces the boundary, the public-API behavior
(full read, id and case-insensitive name lookup, the category vocabulary), and
immutability (frozen returns, an unmutable seed).
