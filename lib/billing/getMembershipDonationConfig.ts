import type { SupabaseClient } from "@supabase/supabase-js";

export interface MembershipDonationConfig {
  /** Amount in the smallest currency unit (cents for USD). */
  amount_cents: number;
  /** ISO 4217 lowercase, e.g. 'usd'. */
  currency: string;
  /** Human-readable label for UI. */
  label: string;
}

/**
 * Canonical read of the membership donation config from `billing_config`.
 * Every UI, API route, and Edge Function that needs the amount MUST use this.
 * Never hardcode the amount elsewhere.
 */
export async function getMembershipDonationConfig(
  supabase: SupabaseClient,
): Promise<MembershipDonationConfig> {
  const { data, error } = await supabase
    .from("billing_config")
    .select("value_json")
    .eq("key", "membership_donation")
    .single();

  if (error || !data) {
    throw new Error(
      `billing_config.membership_donation missing: ${error?.message ?? "no row"}`,
    );
  }

  const v = data.value_json as Partial<MembershipDonationConfig>;
  if (typeof v.amount_cents !== "number" || !v.currency) {
    throw new Error("billing_config.membership_donation malformed");
  }

  return {
    amount_cents: v.amount_cents,
    currency: v.currency,
    label: v.label ?? "Membership Donation",
  };
}

/** Display helper — returns a localized currency string. */
export function formatDonationAmount(cfg: MembershipDonationConfig): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: cfg.currency.toUpperCase(),
    minimumFractionDigits: cfg.amount_cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cfg.amount_cents / 100);
}
