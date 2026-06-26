// lib/experimental/lenses/index.ts
//
// The public, read-only API of the Experimental Lens Framework.
//
// Four pure functions over static, in-memory metadata. Returned lenses are
// frozen deep copies; there are no mutation functions. Unknown id/name resolve
// to undefined, never throw. Lenses are a standalone leaf — this module imports
// no other experiment, no production code, and nothing observational.

import { deepFreeze, LENS_CATEGORIES, LENSES } from "./data";
import type { Lens, LensCategory } from "./types";

export type { Lens, LensCategory, LensStatus } from "./types";
export { LENS_CATEGORIES } from "./data";

/** A disconnected, deep-frozen copy of a seed lens. */
function frozenCopy(lens: Lens): Lens {
  return deepFreeze(structuredClone(lens));
}

/** Every catalogued lens, as frozen copies. */
export function listLenses(): readonly Lens[] {
  return LENSES.map(frozenCopy);
}

/** The lens with the given id, or `undefined` if none matches. */
export function getLens(id: string): Lens | undefined {
  const found = LENSES.find((lens) => lens.id === id);
  return found ? frozenCopy(found) : undefined;
}

/** The lens with the given name, matched case-insensitively, or `undefined`. */
export function getLensByName(name: string): Lens | undefined {
  const target = name.toLowerCase();
  const found = LENSES.find((lens) => lens.name.toLowerCase() === target);
  return found ? frozenCopy(found) : undefined;
}

/** The full category vocabulary — organizational, never a ranking. */
export function listLensCategories(): readonly LensCategory[] {
  return Object.freeze(LENS_CATEGORIES.slice());
}
