import type { SupabaseClient } from "@supabase/supabase-js";

// Vital Profile — the archetypal personalization layer.
//
// Backend foundation only. No UI consumes these fields yet. Columns live
// on public.member_profiles (added in migration
// 20260613000000_member_profiles_vital_profile_fields.sql), so the
// existing row-level security policies — "Members can view/update own
// profile" and "Founders can read all" — automatically protect every
// field below.
//
// Helpers are written so that:
//   - Reads return null for a missing row (vs throwing) so callers can
//     branch on "profile not initialized yet" without try/catch.
//   - Updates accept a partial — only provided keys are sent to Postgres,
//     and `undefined` values are skipped (vs `null`, which explicitly
//     clears a stored value).

export type ZodiacFields = {
  zodiac_sun: string | null;
  zodiac_moon: string | null;
  zodiac_rising: string | null;
};

export type HumanDesignFields = {
  human_design_type: string | null;
  human_design_strategy: string | null;
  human_design_authority: string | null;
  human_design_profile: string | null;
  human_design_defined_centers: string[] | null;
};

export type GeneKeysFields = {
  gene_keys_life_work: string | null;
  gene_keys_evolution: string | null;
  gene_keys_radiance: string | null;
  gene_keys_purpose: string | null;
};

export type EnneagramFields = {
  enneagram_type: string | null;
  enneagram_wing: string | null;
  enneagram_instinct: string | null;
};

export type BirthFields = {
  birth_date: string | null;
  birth_time: string | null;
  birth_location_city: string | null;
  birth_location_country: string | null;
  birth_timezone: string | null;
};

export type VitalProfile = BirthFields &
  ZodiacFields &
  HumanDesignFields &
  GeneKeysFields &
  EnneagramFields;

export const VITAL_PROFILE_COLUMNS = [
  "birth_date",
  "birth_time",
  "birth_location_city",
  "birth_location_country",
  "birth_timezone",
  "zodiac_sun",
  "zodiac_moon",
  "zodiac_rising",
  "human_design_type",
  "human_design_strategy",
  "human_design_authority",
  "human_design_profile",
  "human_design_defined_centers",
  "gene_keys_life_work",
  "gene_keys_evolution",
  "gene_keys_radiance",
  "gene_keys_purpose",
  "enneagram_type",
  "enneagram_wing",
  "enneagram_instinct",
] as const satisfies readonly (keyof VitalProfile)[];

export type VitalProfileUpdate = Partial<VitalProfile>;

const SELECT_LIST = VITAL_PROFILE_COLUMNS.join(", ");

export async function getMyVitalProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<VitalProfile | null> {
  const { data } = await supabase
    .from("member_profiles")
    .select(SELECT_LIST)
    .eq("id", userId)
    .maybeSingle();
  return (data as VitalProfile | null) ?? null;
}

// Drops keys whose values are `undefined` so callers can safely spread a
// partial object without overwriting stored values with null. Use null
// explicitly when the intent is to clear a field.
function pruneUndefined(patch: VitalProfileUpdate): VitalProfileUpdate {
  const out: Record<string, unknown> = {};
  for (const key of VITAL_PROFILE_COLUMNS) {
    const value = patch[key];
    if (value === undefined) continue;
    out[key] = value;
  }
  return out as VitalProfileUpdate;
}

export async function updateMyVitalProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: VitalProfileUpdate,
) {
  const pruned = pruneUndefined(patch);
  if (Object.keys(pruned).length === 0) {
    return { data: null, error: null as null };
  }
  return supabase.from("member_profiles").update(pruned).eq("id", userId);
}

// Validation helpers — intentionally lightweight. The point of this PR is
// to land safe storage; full validators (city/country/timezone lookups,
// zodiac normalization, HD type vocabulary, etc.) belong with the
// onboarding UI that produces these values.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^\d{2}:\d{2}(:\d{2})?$/;

export function isValidBirthDate(value: string | null | undefined): boolean {
  if (value == null || value === "") return true;
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

export function isValidBirthTime(value: string | null | undefined): boolean {
  if (value == null || value === "") return true;
  return ISO_TIME.test(value);
}

// Surfaces the obvious shape errors (date/time format) so callers can
// reject before round-tripping to Postgres. Returns a list of field-keyed
// messages; empty array means the patch is shape-valid.
export function validateVitalProfilePatch(
  patch: VitalProfileUpdate,
): { field: keyof VitalProfile; message: string }[] {
  const errors: { field: keyof VitalProfile; message: string }[] = [];
  if (patch.birth_date !== undefined && !isValidBirthDate(patch.birth_date)) {
    errors.push({ field: "birth_date", message: "Expected YYYY-MM-DD" });
  }
  if (patch.birth_time !== undefined && !isValidBirthTime(patch.birth_time)) {
    errors.push({ field: "birth_time", message: "Expected HH:MM or HH:MM:SS" });
  }
  if (
    patch.human_design_defined_centers !== undefined &&
    patch.human_design_defined_centers !== null &&
    !Array.isArray(patch.human_design_defined_centers)
  ) {
    errors.push({
      field: "human_design_defined_centers",
      message: "Expected array of center names",
    });
  }
  return errors;
}
