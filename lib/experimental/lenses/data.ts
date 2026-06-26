// lib/experimental/lenses/data.ts
//
// The runtime vocabulary (categories, statuses, the allowed-key list) and the
// seed lenses — the single source of truth.
//
// Lenses-as-code: adding or changing a lens means editing this file and opening
// a PR. No persistence, no production read, no mutation path through the public
// API. Every lens is deep-frozen. The lab is recording that these frameworks
// exist — nothing more. No calculations, no framework-specific logic.

import type { Lens, LensCategory, LensStatus } from "./types";

/** Every legal {@link LensCategory}, in canonical order. Organizes, never ranks. */
export const LENS_CATEGORIES: readonly LensCategory[] = Object.freeze([
  "symbolic",
  "psychological",
  "behavioral",
  "physiological",
  "spiritual",
  "assessment",
  "other",
]);

/** Every legal {@link LensStatus}, as runtime values for validation. */
export const LENS_STATUSES: readonly LensStatus[] = Object.freeze([
  "draft",
  "active",
  "deprecated",
]);

/**
 * The complete, exclusive set of keys a {@link Lens} may have. ./verify.ts
 * asserts every lens carries exactly these keys — no missing, and crucially no
 * extra — so a `score`, `authority`, or `is_correct` field cannot slip in later.
 */
export const LENS_KEYS: readonly (keyof Lens)[] = Object.freeze([
  "id",
  "name",
  "description",
  "version",
  "category",
  "status",
]);

/**
 * Recursively freeze a value and everything it transitively owns.
 */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/**
 * The seed lenses — a few placeholder interpretive frameworks, recorded as
 * metadata only. Each `description` is one efficacy-neutral sentence stating what
 * the framework broadly concerns, never that it works or yields true results.
 * Category assignments are organizational placeholders and may be revised.
 */
export const LENSES: readonly Lens[] = deepFreeze<Lens[]>([
  {
    id: "lens-001",
    name: "Western Astrology",
    description:
      "A symbolic framework that relates the positions of celestial bodies at " +
      "a given moment to a catalogue of archetypal meanings.",
    version: 1,
    category: "symbolic",
    status: "active",
  },
  {
    id: "lens-002",
    name: "Human Design",
    description:
      "A framework that arranges birth data into a body-graph of centers, " +
      "channels, gates, and types.",
    version: 1,
    category: "symbolic",
    status: "active",
  },
  {
    id: "lens-003",
    name: "Gene Keys",
    description:
      "A contemplative framework that pairs a sequence of archetypal keys with " +
      "passages for reflection.",
    version: 1,
    category: "spiritual",
    status: "active",
  },
  {
    id: "lens-004",
    name: "Ayurveda",
    description:
      "A traditional framework that describes individual constitution through " +
      "elemental qualities and doshas.",
    version: 1,
    category: "physiological",
    status: "active",
  },
]);
