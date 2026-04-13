import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import MemberProfileEditor from "./MemberProfileEditor";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("full_name")
    .eq("id", id)
    .maybeSingle();
  return { title: member ? `${member.full_name} — Vital Kauaʻi` : "Client — Vital Kauaʻi" };
}

export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: member },
    { data: profile },
    { data: intake },
    { data: documents },
    { data: ceremonies },
    { data: checklist },
  ] = await Promise.all([
    supabase.from("members").select("*").eq("id", id).maybeSingle(),
    supabase.from("member_profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("intake_forms").select("*").eq("member_id", id).maybeSingle(),
    supabase.from("signed_documents").select("*").eq("member_id", id).order("signed_at", { ascending: false }),
    supabase.from("ceremony_records").select("*").eq("member_id", id).order("ceremony_date", { ascending: false }),
    supabase.from("member_checklist").select("*").eq("member_id", id).order("created_at", { ascending: true }),
  ]);

  if (!member) notFound();

  // Look up auth user ID via member_profiles (for pre/post ceremony progress)
  const { data: profileByEmail } = await supabase
    .from("member_profiles")
    .select("id")
    .eq("email", member.email)
    .maybeSingle();

  let preProgress = null;
  let postProgress = null;
  if (profileByEmail) {
    const [{ data: pre }, { data: post }] = await Promise.all([
      supabase.from("pre_ceremony_progress").select("weeks_completed, checklist_items, journal_responses, last_updated").eq("member_id", profileByEmail.id).maybeSingle(),
      supabase.from("post_ceremony_progress").select("weeks_completed, checklist_items, weekly_tracking, journal_responses, last_updated").eq("member_id", profileByEmail.id).maybeSingle(),
    ]);
    preProgress = pre;
    postProgress = post;
  }

  return (
    <MemberProfileEditor
      member={member}
      profile={profile}
      intake={intake}
      documents={documents ?? []}
      ceremonies={ceremonies ?? []}
      checklist={checklist ?? []}
      preProgress={preProgress}
      postProgress={postProgress}
    />
  );
}
