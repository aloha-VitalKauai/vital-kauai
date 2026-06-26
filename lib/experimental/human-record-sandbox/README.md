# Human Record Sandbox (experiment-006)

The first capability that becomes **visible**.

Where capabilities 001–005 were inert modules, the sandbox is a real,
founder-gated, **read-only** page that observes one real member through existing
production data — presented as a calm human journey rather than a database. It
**accompanies** the existing Vital Kauaʻi member journey; it never replaces it.
The curriculum remains the source of truth; the Human Record provides context
around it.

The page lives at:

```
app/dashboard/lab/human-record/page.tsx   →   /dashboard/lab/human-record
```

This directory holds the experiment's **verification and documentation**; the
experience itself lives in `app/`, because a visible capability must.

## What it shows

A single member (the first sample is Joshua Perdue — the architecture is not
specific to him; one constant points the sandbox at a member) rendered as:

- **Identity** — safe operational/identity fields only.
- **Current Journey** — the existing Week One (`Ike`, "I create my reality.")
  curriculum, displayed unchanged.
- **Context** — observed operational progress (status, onboarding, access).
- **Observations / Relationships / Lenses** — rendered from capabilities 003,
  004, and 005.
- **Evidence** — existing artifacts (signed documents, completed milestones,
  reflection counts) made discoverable, never summarized.
- **Context for This Week** — existing artifacts that relate to this week's
  principle, surfaced (not generated).
- **Future Capabilities** — a Context Engine, explicitly *not yet implemented*.

## The guarantees

The sandbox is held to these structural promises, enforced by
[`verify.ts`](./verify.ts) (a static scan of the page source):

- **Read-only.** Only `.select(...)`. No `insert` / `update` / `delete` /
  `upsert` / `rpc`. It never writes, never duplicates a record, never becomes a
  second source of truth.
- **No migrations, no external services, no AI/LLM calls.**
- **Founder-gated.** Protected by `middleware.ts` (`/dashboard/*`), the dashboard
  layout, and an explicit `verifyFounder()` guard. It never appears in the member
  portal or in navigation (no `DashboardTabs` entry).
- **Safe fields only.** It surfaces operational/identity data and never reads or
  renders medical, screening, contraindication, dosing, assessment, or other
  Level-4 / PHI fields. `verify.ts` asserts the page references none of those
  tables, columns, or helpers.
- **Removable.** Deleting `app/dashboard/lab/human-record/` (and this registry
  entry) leaves the rest of production behaving exactly as before; nothing else
  imports the sandbox.

The production application remains authoritative. The sandbox is simply another
way of observing it.

## The Charter

This capability is held to the lab's single Charter — the Implementation
Questions documented once in [`../registry/README.md`](../registry/README.md).

## Verifying

```sh
# Type-check (the repo's real gate):
npx tsc --noEmit

# Static safety scan of the sandbox page (run from the repo root):
npx tsc lib/experimental/human-record-sandbox/verify.ts \
  --outDir node_modules/.cache/sandbox-verify \
  --module commonjs --moduleResolution node --target es2019 \
  --esModuleInterop --skipLibCheck \
  && node node_modules/.cache/sandbox-verify/verify.js
```

The live render also requires a founder session (the route redirects to
`/login` otherwise), so the visual experience is confirmed by an authenticated
founder — by design.
