// Vital Profile orchestrator.
//
// Runs every configured provider against a single BirthInput and
// assembles a VitalProfileCalculationResult. Providers run in parallel —
// none of them depend on each other's output.
//
// This file is the single seam between "compute" and "persist". It
// deliberately does NOT write to Postgres. The caller (API route, future
// admin tool, future scheduled job) decides whether and how to persist.
// That keeps the orchestrator safe to invoke in dry-run / preview modes
// without risking overwriting a member's stored profile.

import type { SupabaseClient } from "@supabase/supabase-js";
import { westernAstrologyProvider } from "./providers/western-astrology";
import { humanDesignProvider } from "./providers/human-design";
import { geneKeysProvider } from "./providers/gene-keys";
import { chineseZodiacProvider } from "./providers/chinese-zodiac";
import type {
  BirthInput,
  ChineseZodiacProfile,
  GeneKeysProfile,
  HumanDesignProfile,
  ProviderResult,
  VitalProfileCalculationResult,
  WesternAstrologyProfile,
} from "./types";

export const BIRTH_INPUT_COLUMNS = [
  "birth_date",
  "birth_time",
  "birth_location_city",
  "birth_location_country",
  "birth_timezone",
] as const satisfies readonly (keyof BirthInput)[];

export async function loadBirthInput(
  supabase: SupabaseClient,
  userId: string,
): Promise<BirthInput | null> {
  const { data } = await supabase
    .from("member_profiles")
    .select(BIRTH_INPUT_COLUMNS.join(", "))
    .eq("id", userId)
    .maybeSingle();
  return (data as BirthInput | null) ?? null;
}

// Computes every provider against the given BirthInput. Provider failures
// don't fail the orchestrator — each one's result lives independently on
// the returned object. Callers inspect `kind` per provider.
export async function generateVitalProfile(
  input: BirthInput,
): Promise<VitalProfileCalculationResult> {
  const [westernAstrology, humanDesign, geneKeys, chineseZodiac] = await Promise.all([
    safeCompute<WesternAstrologyProfile>(() =>
      westernAstrologyProvider.compute(input),
    ),
    safeCompute<HumanDesignProfile>(() => humanDesignProvider.compute(input)),
    safeCompute<GeneKeysProfile>(() => geneKeysProvider.compute(input)),
    safeCompute<ChineseZodiacProfile>(() => chineseZodiacProvider.compute(input)),
  ]);

  return {
    computed_at: new Date().toISOString(),
    input,
    western_astrology: westernAstrology,
    human_design: humanDesign,
    gene_keys: geneKeys,
    chinese_zodiac: chineseZodiac,
  };
}

// A provider that throws a runtime error (vs returning a typed
// `kind: "error"`) shouldn't crash the orchestrator. We catch and
// convert to the typed error shape so the API route always returns
// a well-formed result.
async function safeCompute<TData>(
  fn: () => Promise<ProviderResult<TData>>,
): Promise<ProviderResult<TData>> {
  try {
    return await fn();
  } catch (err) {
    return {
      kind: "error",
      code: "unknown",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
