import { createClient } from "@/lib/supabase/server";
import {
  getMembershipDonationConfig,
  formatDonationAmount,
} from "@/lib/billing/getMembershipDonationConfig";
import DonationCard from "./DonationCard";

export const metadata = { title: "Membership Donation — Vital Kauaʻi" };

export default async function DonationPage() {
  const supabase = await createClient();
  const cfg = await getMembershipDonationConfig(supabase);
  return (
    <DonationCard amountLabel={formatDonationAmount(cfg)} label={cfg.label} />
  );
}
