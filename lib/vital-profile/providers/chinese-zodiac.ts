// Chinese Zodiac provider — STUB (intended to become an in-process
// calculator, NOT an external API).
//
// Chinese Zodiac maps a calendar year to (animal, element, yin/yang).
// The interesting edge is the new-year boundary: there are two
// conventions (lunar new year ≈ late Jan – mid Feb, vs. solar-term
// boundary at lichun ≈ Feb 4). A real implementation has to commit to
// one — we leave that decision for a follow-up PR rather than smuggling
// it into this architecture PR with rough date math.
//
// No env vars are needed for this provider. It will execute purely in
// the Node.js runtime of the API route.
//
// Future implementation outline:
//   1. Extract year from birth_date.
//   2. If month/day fall before configured new-year boundary, decrement.
//   3. animal = year % 12 lookup against ANIMALS array
//      (Rat at 1924 % 12 = 4, etc.)
//   4. element = floor((year - 4) / 2) % 5 lookup against ELEMENTS.
//   5. yin_yang = year even → yang, odd → yin.
//   6. year_label = `${element} ${animal}`.

import type {
  BirthInput,
  ChineseZodiacProfile,
  ProviderResult,
  VitalProfileProvider,
} from "../types";

export const chineseZodiacProvider: VitalProfileProvider<ChineseZodiacProfile> = {
  name: "chinese-zodiac-stub",

  async compute(input: BirthInput): Promise<ProviderResult<ChineseZodiacProfile>> {
    if (!input.birth_date) {
      return {
        kind: "error",
        code: "missing_input",
        message: "birth_date is required for Chinese Zodiac calculation",
      };
    }
    return {
      kind: "placeholder",
      reason:
        "Chinese Zodiac calculator not implemented yet — will be an in-process function in a follow-up PR (no external API needed).",
    };
  },
};
