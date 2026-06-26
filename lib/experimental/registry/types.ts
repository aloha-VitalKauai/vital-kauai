// lib/experimental/registry/types.ts
//
// The Experimental Pilot Registry — model.
//
// This file is types only. It contains no runtime values, so it compiles away
// to nothing. The canonical runtime value sets (and the seed data) live in
// ./data.ts; the read-only public API lives in ./index.ts.
//
// The registry exists to keep the lab honest: every experiment under
// lib/experimental/ carries an explicit hypothesis, safety boundary,
// removability statement, declared production impact, and a current decision.
// See ./README.md for the lifecycle.

/**
 * Where an experiment sits in its operational lifecycle — *where it is right
 * now*. This axis is orthogonal to {@link ExperimentDecision}; see ./README.md.
 *
 * `completed`, `promoted`, and `rejected` are terminal.
 */
export type ExperimentStatus =
  | "draft"
  | "active"
  | "completed"
  | "paused"
  | "rejected"
  | "promoted";

/**
 * The declared blast radius of an experiment — how much it *could* touch
 * production.
 *
 * - `none`                 — pure thought / scaffolding; no code reachable at all.
 * - `read_only`            — may read production data, never writes or alters it.
 * - `internal_only`        — real code exists in the repo, reachable only from
 *                            the experimental namespace; cannot alter production.
 * - `production_candidate` — proposed for production; requires extra review.
 * - `production`           — live in production.
 *
 * The first three are production-safe (see `isProductionSafeExperiment`).
 */
export type ProductionImpact =
  | "none"
  | "read_only"
  | "internal_only"
  | "production_candidate"
  | "production";

/**
 * The team's current verdict on an experiment — *what we intend to do about
 * it*. Orthogonal to {@link ExperimentStatus}; see ./README.md for the legal
 * pairings.
 */
export type ExperimentDecision =
  | "keep"
  | "revise"
  | "delete"
  | "promote"
  | "undecided";

/**
 * One tracked experiment.
 *
 * Field conventions:
 * - `id` is kebab-cased and zero-padded: `experiment-001`, `experiment-002`, …
 *   The long human title lives in `name`. IDs must be unique.
 * - timestamps are ISO-8601 strings, and `updated_at >= created_at`.
 */
export type ExperimentalPilot = {
  id: string;
  name: string;
  status: ExperimentStatus;
  production_impact: ProductionImpact;
  hypothesis: string;
  safety_boundary: string;
  removability: string;
  success_criteria: string[];
  future_unlocks: string[];
  decision: ExperimentDecision;
  created_at: string;
  updated_at: string;
};
