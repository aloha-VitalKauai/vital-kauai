// lib/experimental/lenses/types.ts
//
// The Experimental Lens Framework (experiment-005) — model.
//
// A Lens is an OPTIONAL interpretive framework through which someone may choose
// to understand observed reality. This module catalogues interpretive frameworks
// as metadata only — it never determines truth, runs calculations, or interprets
// anything. Observed reality (the observation layer) stays primary; lenses remain
// optional ways of understanding it. Evidence is not interpretation.
//
// This file is types only. The runtime vocabulary (categories, statuses, and the
// allowed-key list) and the seed lenses live in ./data.ts; the read-only public
// API lives in ./index.ts.
//
// The safety boundary here is structural — see the note on the `Lens` type and
// ./README.md.

/**
 * Organizes lenses. Does NOT rank them — storage order and category carry no
 * precedence. A closed union.
 */
export type LensCategory =
  | "symbolic"
  | "psychological"
  | "behavioral"
  | "physiological"
  | "spiritual"
  | "assessment"
  | "other";

/** Lifecycle of the lens *entry* (its metadata), not a judgment of the framework. */
export type LensStatus = "draft" | "active" | "deprecated";

/**
 * An optional interpretive framework, catalogued as metadata only.
 *
 * Note what is intentionally ABSENT: there is no field that can assert truth,
 * rank, precedence, weight, confidence, accuracy, correctness, efficacy, or
 * diagnosis. That omission is the safety boundary — a Lens entry can describe
 * that a framework exists and what it broadly concerns, and nothing more. None
 * of those fields may be added without consciously reopening this boundary, and
 * ./verify.ts asserts each lens carries exactly the allowed keys so one cannot
 * be smuggled in later.
 *
 * `description` is efficacy-neutral metadata only: it states what a framework is
 * ("maps birth time to symbolic positions"), never that it works or yields true
 * results.
 */
export type Lens = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: number;
  readonly category: LensCategory;
  readonly status: LensStatus;
};
