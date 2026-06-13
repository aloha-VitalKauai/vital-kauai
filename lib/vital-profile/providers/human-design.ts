// Human Design provider — STUB.
//
// Future PR will integrate either:
//   - A licensed Human Design API (read VITAL_PROFILE_HUMAN_DESIGN_API_URL
//     + VITAL_PROFILE_HUMAN_DESIGN_API_KEY), or
//   - An in-house calculator if Rachel sources an ephemeris-based
//     implementation we have rights to ship.
//
// Until then this stub returns a placeholder. Real implementation will
// resolve type (Generator / Manifestor / Projector / Reflector / MG),
// strategy, authority, profile (e.g. "1/3"), and defined_centers.

import type {
  BirthInput,
  HumanDesignProfile,
  ProviderResult,
  VitalProfileProvider,
} from "../types";

export const humanDesignProvider: VitalProfileProvider<HumanDesignProfile> = {
  name: "human-design-stub",

  async compute(input: BirthInput): Promise<ProviderResult<HumanDesignProfile>> {
    if (!input.birth_date || !input.birth_time || !input.birth_timezone) {
      return {
        kind: "error",
        code: "missing_input",
        message:
          "Human Design requires birth_date, birth_time, and birth_timezone for an unambiguous moment.",
      };
    }
    return {
      kind: "placeholder",
      reason:
        "Human Design provider not configured yet — real integration arrives in a follow-up PR.",
    };
  },
};
