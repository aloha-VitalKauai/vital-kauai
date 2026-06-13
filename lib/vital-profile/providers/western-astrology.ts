// Western Astrology provider — STUB.
//
// Future PR will swap this for a real implementation. Likely path:
//   1. Read VITAL_PROFILE_ASTROLOGY_API_URL + VITAL_PROFILE_ASTROLOGY_API_KEY
//      from server-side env (never NEXT_PUBLIC_*).
//   2. POST birth data, await JSON response.
//   3. Map fields (sun/moon/rising sign) onto WesternAstrologyProfile.
//   4. Return { kind: "ok", data, source: { name, version } } on success,
//      { kind: "error", code, message } on failure.
//
// Until then, this stub returns `kind: "placeholder"` so callers know
// not to persist or display the result as authoritative.

import type {
  BirthInput,
  ProviderResult,
  VitalProfileProvider,
  WesternAstrologyProfile,
} from "../types";

export const westernAstrologyProvider: VitalProfileProvider<WesternAstrologyProfile> = {
  name: "western-astrology-stub",

  async compute(input: BirthInput): Promise<ProviderResult<WesternAstrologyProfile>> {
    if (!input.birth_date) {
      return {
        kind: "error",
        code: "missing_input",
        message: "birth_date is required for astrology calculation",
      };
    }
    // Sun-sign-only resolution requires only birth_date; moon and rising
    // additionally require birth_time + birth_timezone. The real
    // implementation will return what it can and null the rest.
    return {
      kind: "placeholder",
      reason:
        "Western astrology provider not configured yet — real API integration arrives in a follow-up PR.",
    };
  },
};
