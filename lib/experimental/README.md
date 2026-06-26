# Experimental — the Human Record Pilot laboratory

This directory is a laboratory.

It exists to explore one question:

> If we were designing this platform ten years from now, what would we wish we
> had built from the beginning?

Everything under `lib/experimental/` is internal research and development for
the **Human Record** initiative. The production Vital Kauaʻi application — every
member workflow, CRM surface, schedule, medical workflow, document, dashboard,
and journey — is the real system and continues to operate exactly as it does
today. The pilot lives entirely alongside that foundation.

## The one rule

**Production comes first. The pilot serves production. Production never serves
the pilot.**

Concretely, code in this directory is held to these promises:

- **Additive.** It introduces new files; it changes no existing ones.
- **Isolated.** Nothing in `app/`, `components/`, or the rest of `lib/` imports
  from here. If you delete `lib/experimental/` tomorrow, the platform builds and
  behaves identically.
- **Reversible.** Every experiment is designed to be removed without a trace.
- **Observable.** We optimize for learning, so experiments favor clarity and
  inspectability over feature count.

Anything that would change a production workflow, route, UI, member experience,
permission, API, or database table does **not** belong here — it belongs in a
real, reviewed PR against the production system.

## What lives here today

- [`provenance/`](./provenance) — lightweight metadata describing where a record
  came from, who created it, and what kind of information it is. This is the
  first building block: every later Human Record idea depends on knowing the
  origin of information.
- [`registry/`](./registry) — the Experimental Pilot Registry: an in-memory,
  read-only record of every experiment in this namespace and the discipline that
  governs it.

## Pilot Registry

Every experiment in this namespace is tracked in `registry/`. See
`registry/README.md` for how experiments are added, evaluated, promoted,
and removed.

## What does not live here yet

The Human Record's larger structure — timelines, a knowledge layer, governance,
an evidence engine, permission models, and any AI — is intentionally absent.
Those graduate into their own future PRs only after the pilot earns them. The
discipline of this laboratory is to choose the smaller experiment every time.
