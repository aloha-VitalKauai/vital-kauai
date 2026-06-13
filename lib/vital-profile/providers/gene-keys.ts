// Gene Keys provider — STUB.
//
// Gene Keys is licensed material; we will not ship a calculator until a
// clean/licensed source is confirmed. The architecture leaves space for
// either:
//   - A licensed Gene Keys API (read VITAL_PROFILE_GENE_KEYS_API_URL +
//     VITAL_PROFILE_GENE_KEYS_API_KEY), or
//   - Continuing to return `kind: "placeholder"` indefinitely if Rachel
//     decides not to surface Gene Keys to members.
//
// Until then this stub returns a placeholder. Real implementation will
// resolve the four spheres of the Activation Sequence (Life's Work,
// Evolution, Radiance, Purpose) as "Key.Line" strings (e.g. "26.4").

import type {
  BirthInput,
  GeneKeysProfile,
  ProviderResult,
  VitalProfileProvider,
} from "../types";

export const geneKeysProvider: VitalProfileProvider<GeneKeysProfile> = {
  name: "gene-keys-stub",

  async compute(input: BirthInput): Promise<ProviderResult<GeneKeysProfile>> {
    if (!input.birth_date || !input.birth_time || !input.birth_timezone) {
      return {
        kind: "error",
        code: "missing_input",
        message:
          "Gene Keys requires birth_date, birth_time, and birth_timezone for an unambiguous moment.",
      };
    }
    return {
      kind: "placeholder",
      reason:
        "Gene Keys provider intentionally inactive — pending a licensed source.",
    };
  },
};
