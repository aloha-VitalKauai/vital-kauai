#!/usr/bin/env node
/**
 * Dev/testing fixture: assign ONE weekly check-in to an EXISTING member.
 *
 * This is the Build 2 stand-in for the Build 3 scheduler — it creates the same
 * row the scheduler will, using the active template for the requested week,
 * so the member page and profile card can be exercised end to end. It touches
 * only member_checkins (never members/profiles/journeys), works only against
 * an existing member with an existing journey, and refuses to duplicate or
 * disturb a week that already has a row (the journey+week unique key backs
 * this up in the database).
 *
 *   SUPABASE_SERVICE_ROLE_KEY=… NEXT_PUBLIC_SUPABASE_URL=… \
 *     node scripts/create-test-checkin.mjs member@example.com 1
 */
import { createClient } from "@supabase/supabase-js";

const [email, weekArg] = process.argv.slice(2);
const week = Number(weekArg);
if (!email || !Number.isInteger(week) || week < 1 || week > 13) {
  console.error("Usage: node scripts/create-test-checkin.mjs <member-email> <week 1-13>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}
const supabase = createClient(url, key);

const { data: profile, error: profileError } = await supabase
  .from("member_profiles")
  .select("id, email")
  .eq("email", email)
  .maybeSingle();
if (profileError) throw profileError;
if (!profile) {
  console.error(`No member profile found for ${email}. This script only assigns to existing members.`);
  process.exit(1);
}

const { data: journey, error: journeyError } = await supabase
  .from("journeys")
  .select("id, status, created_at")
  .eq("member_id", profile.id)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (journeyError) throw journeyError;
if (!journey) {
  console.error(`${email} has no journey. This script only assigns to existing journeys.`);
  process.exit(1);
}

const { data: template, error: templateError } = await supabase
  .from("checkin_templates")
  .select("id, week_number, questions")
  .eq("week_number", week)
  .eq("active", true)
  .maybeSingle();
if (templateError) throw templateError;
if (!template) {
  console.error(`No active template for week ${week}.`);
  process.exit(1);
}

const { data: existing, error: existingError } = await supabase
  .from("member_checkins")
  .select("id, status")
  .eq("journey_id", journey.id)
  .eq("week_number", week)
  .maybeSingle();
if (existingError) throw existingError;
if (existing) {
  console.error(`Week ${week} of journey ${journey.id} already has a check-in (${existing.status}). Leaving it untouched.`);
  process.exit(1);
}

const { data: created, error: insertError } = await supabase
  .from("member_checkins")
  .insert({
    member_id: profile.id,
    journey_id: journey.id,
    week_number: week,
    template_id: template.id,
    questions_snapshot: template.questions,
    scheduled_at: new Date().toISOString(),
    status: "sent",
    sent_at: new Date().toISOString(),
  })
  .select("id")
  .single();
if (insertError) throw insertError;

console.log(`Check-in ${created.id} assigned: ${email}, week ${week}, journey ${journey.id}.`);
console.log("The member sees it at /portal/checkin.");
