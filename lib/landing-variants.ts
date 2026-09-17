/**
 * Landing-page variants for the discovery-call page.
 *
 * One experiment at a time: a visitor is assigned a variant once (kept in
 * localStorage), sees it consistently, and the variant rides along on every
 * GA4 event and into the Calendly booking as `utm_term`, so bookings can be
 * split by variant without any analytics access. Swap the copy in `VARIANTS`
 * to run the next test; keep `a` as the current control.
 */

export type VariantKey = "a" | "b";

export type LandingVariant = {
  key: VariantKey;
  /** Sentence under the hero title. */
  heroSub: string;
  /** Booking section title, two lines. */
  bookTitle: [string, string];
};

export const VARIANTS: Record<VariantKey, LandingVariant> = {
  a: {
    key: "a",
    heroSub: "In service of whole-being transformation. Every journey begins with a conversation.",
    bookTitle: ["The root shows you the door.", "We walk through it with you."],
  },
  b: {
    key: "b",
    heroSub: "Iboga ceremony on Kauaʻi. Two nights with the root, held within months of care.",
    bookTitle: ["Begin with a conversation.", "Thirty minutes. Every question answered."],
  },
};

export const VARIANT_STORAGE_KEY = "vk_dc_variant";

/** The variant a `?v=` query value names, or null. */
export function variantFromQuery(search: string): VariantKey | null {
  const v = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("v");
  return v === "a" || v === "b" ? v : null;
}

/**
 * Resolve the visitor's variant: an explicit `?v=` wins (for previewing),
 * then the stored assignment, then a coin flip that is stored. `random`
 * and `storage` are injectable for tests.
 */
export function resolveVariant(
  search: string,
  storage: { getItem(k: string): string | null; setItem(k: string, v: string): void } | null,
  random: () => number = Math.random,
): VariantKey {
  const forced = variantFromQuery(search);
  if (forced) {
    try { storage?.setItem(VARIANT_STORAGE_KEY, forced); } catch {}
    return forced;
  }
  let stored: string | null = null;
  try { stored = storage?.getItem(VARIANT_STORAGE_KEY) ?? null; } catch {}
  if (stored === "a" || stored === "b") return stored;
  const pick: VariantKey = random() < 0.5 ? "a" : "b";
  try { storage?.setItem(VARIANT_STORAGE_KEY, pick); } catch {}
  return pick;
}
