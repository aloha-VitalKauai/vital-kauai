// Vital Profile — provider input/output contracts.
//
// Every provider (Western astrology, Human Design, Gene Keys, Chinese
// Zodiac) takes the same `BirthInput` shape and returns a typed
// `ProviderResult<T>`. The orchestrator (lib/vital-profile/generate.ts)
// runs them in parallel and assembles a `VitalProfileCalculationResult`.
//
// Stub providers in this PR return `kind: "placeholder"` results — they
// don't call external APIs and don't claim authoritative data. A future
// PR will swap each stub for a real implementation (HTTP fetch to a
// licensed provider, or in-process calculation for Chinese Zodiac)
// without changing this contract.

export type BirthInput = {
  birth_date: string | null;          // YYYY-MM-DD
  birth_time: string | null;          // HH:MM or HH:MM:SS, local at birth_location
  birth_location_city: string | null;
  birth_location_country: string | null;
  birth_timezone: string | null;      // IANA name, e.g. "Pacific/Honolulu"
};

// Discriminated union: every provider can return one of three states
// without coupling callers to a single shape.
//
//   placeholder  — stub mode, no real data, safe to surface "coming soon"
//   ok           — provider returned authoritative data
//   error        — provider attempted real work and failed; details
//                  include a code so the orchestrator can decide whether
//                  to fall back to a stub or surface the failure.
export type ProviderResult<TData> =
  | { kind: "placeholder"; reason: string }
  | { kind: "ok"; data: TData; source: ProviderSource }
  | { kind: "error"; code: ProviderErrorCode; message: string };

export type ProviderSource = {
  // Human-readable provider name (e.g. "internal-calculator",
  // "astrology-api.com"). Stored on the result so a future audit can
  // tell which provider produced a given member's profile.
  name: string;
  // Optional version identifier — e.g. an API version, ephemeris release,
  // or internal calculator commit hash. Helps reproducibility.
  version?: string;
};

export type ProviderErrorCode =
  | "missing_input"
  | "provider_disabled"
  | "provider_unreachable"
  | "provider_rate_limited"
  | "provider_invalid_response"
  | "unknown";

// ---- Provider-specific result shapes ----------------------------------

export type WesternAstrologyProfile = {
  zodiac_sun: string | null;
  zodiac_moon: string | null;
  zodiac_rising: string | null;
};

export type HumanDesignProfile = {
  human_design_type: string | null;
  human_design_strategy: string | null;
  human_design_authority: string | null;
  human_design_profile: string | null;
  human_design_defined_centers: string[] | null;
};

export type GeneKeysProfile = {
  gene_keys_life_work: string | null;
  gene_keys_evolution: string | null;
  gene_keys_radiance: string | null;
  gene_keys_purpose: string | null;
};

export type ChineseZodiacProfile = {
  chinese_zodiac_animal: string | null;
  chinese_zodiac_element: string | null;
  chinese_zodiac_yin_yang: string | null;
  chinese_zodiac_year_label: string | null;
};

// ---- Top-level orchestration result -----------------------------------

// What the orchestrator returns to the API route. Per-provider results
// are kept as their own ProviderResult so the route can render a partial
// success (e.g. astrology resolved, Human Design provider down).
export type VitalProfileCalculationResult = {
  computed_at: string;                                       // ISO timestamp
  input: BirthInput;                                          // verbatim echo of what was passed in
  western_astrology: ProviderResult<WesternAstrologyProfile>;
  human_design:      ProviderResult<HumanDesignProfile>;
  gene_keys:         ProviderResult<GeneKeysProfile>;
  chinese_zodiac:    ProviderResult<ChineseZodiacProfile>;
};

// ---- Provider contract ------------------------------------------------

// Every provider implementation conforms to this shape. The async return
// makes room for the eventual HTTP-fetch implementation without changing
// callers — the current stubs simply resolve synchronously.
export type VitalProfileProvider<TData> = {
  name: string;
  compute(input: BirthInput): Promise<ProviderResult<TData>>;
};
