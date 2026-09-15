import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { VARIANTS, VARIANT_STORAGE_KEY, resolveVariant, variantFromQuery } from "./landing-variants.ts";

function memStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    map: m,
  };
}

describe("variantFromQuery", () => {
  it("reads only a or b", () => {
    assert.equal(variantFromQuery("?v=b"), "b");
    assert.equal(variantFromQuery("v=a&utm_source=x"), "a");
    assert.equal(variantFromQuery("?v=zzz"), null);
    assert.equal(variantFromQuery(""), null);
  });
});

describe("resolveVariant", () => {
  it("honours a forced query value and stores it", () => {
    const s = memStorage({ [VARIANT_STORAGE_KEY]: "a" });
    assert.equal(resolveVariant("?v=b", s), "b");
    assert.equal(s.map.get(VARIANT_STORAGE_KEY), "b");
  });
  it("keeps a stored assignment", () => {
    const s = memStorage({ [VARIANT_STORAGE_KEY]: "b" });
    assert.equal(resolveVariant("", s, () => 0.1), "b");
  });
  it("flips a coin once and remembers it", () => {
    const s = memStorage();
    assert.equal(resolveVariant("", s, () => 0.9), "b");
    assert.equal(resolveVariant("", s, () => 0.1), "b");
    const t = memStorage();
    assert.equal(resolveVariant("", t, () => 0.1), "a");
  });
  it("works with no storage at all", () => {
    assert.equal(resolveVariant("", null, () => 0.7), "b");
  });
  it("every variant carries the two copy slots", () => {
    for (const v of Object.values(VARIANTS)) {
      assert.ok(v.heroSub.length > 20);
      assert.equal(v.bookTitle.length, 2);
    }
  });
});
