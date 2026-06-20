import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SafetyAgreementForm } from "./SafetyAgreementForm";

export const dynamic = "force-dynamic";

export default async function SafetyAgreementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/portal/safety-agreement");

  const { data: profile } = await supabase
    .from("member_profiles")
    .select(
      "id, email, full_name, safety_agreement_signed, safety_agreement_signed_at, safety_agreement_initials, safety_agreement_signature, safety_agreement_preferences",
    )
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main style={{ background: "#F8F5EE", minHeight: "100vh", padding: "32px 16px 80px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ marginBottom: 16 }}>
          <Link
            href="/portal"
            style={{
              fontSize: 12,
              color: "#5C5C58",
              textDecoration: "none",
              letterSpacing: "0.04em",
            }}
          >
            ← Back to your dashboard
          </Link>
        </div>
        <SafetyAgreementForm
          userId={user.id}
          fullName={profile?.full_name ?? ""}
          alreadySigned={profile?.safety_agreement_signed ?? false}
          signedAt={profile?.safety_agreement_signed_at ?? null}
          savedInitials={
            (profile?.safety_agreement_initials as Record<string, string> | null) ??
            null
          }
          savedSignature={profile?.safety_agreement_signature ?? null}
          savedPreferences={
            (profile?.safety_agreement_preferences as
              | Record<string, boolean>
              | null) ?? null
          }
        />
      </div>
    </main>
  );
}
