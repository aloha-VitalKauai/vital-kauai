import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MembershipAgreementForm } from "./MembershipAgreementForm";

export const dynamic = "force-dynamic";

export default async function MembershipAgreementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/portal/membership-agreement");

  const { data: profile } = await supabase
    .from("member_profiles")
    .select(
      "id, email, full_name, membership_agreement_signed, membership_agreement_signed_at, membership_agreement_signature",
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
        <MembershipAgreementForm
          userId={user.id}
          fullName={profile?.full_name ?? ""}
          alreadySigned={profile?.membership_agreement_signed ?? false}
          signedAt={profile?.membership_agreement_signed_at ?? null}
          savedSignature={profile?.membership_agreement_signature ?? null}
        />
      </div>
    </main>
  );
}
