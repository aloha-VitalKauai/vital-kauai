/**
 * PR 10C: server-side helpers for the public /support experience.
 *
 * The page runs with ANON authority on purpose: everything it may know is
 * whatever finance_api.public_campaign_status returns — the one function anon
 * can execute. No service credentials come anywhere near the public page.
 */

import { createClient } from "@supabase/supabase-js";

export type PublicCampaign = {
  slug: string;
  status: string;
  entity_display_name: string;
  fund_display_name: string;
  min_amount_cents: number;
  max_amount_cents: number;
  copy_version: string;
  fee_bps: number;
  fee_fixed_cents: number;
  fee_policy_version: string;
};

/** Anonymous read of the campaign's public surface. Null = show the quiet page. */
export async function fetchPublicCampaign(): Promise<PublicCampaign | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client
    .schema("finance_api")
    .rpc("public_campaign_status", { p_slug: "general-support" });
  if (error) return null;
  const row = (data as unknown as PublicCampaign[] | null)?.[0];
  return row ?? null;
}

/** Preset choices, clamped inside the founder-approved bounds. */
export function presetAmounts(minCents: number, maxCents: number): number[] {
  const candidates = [2500, 5000, 10000, 25000, 50000];
  const presets = candidates.filter((c) => c >= minCents && c <= maxCents);
  return presets.length >= 2 ? presets.slice(0, 4) : [minCents];
}

export function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
