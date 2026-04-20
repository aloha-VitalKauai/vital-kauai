"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type SpecialistInput = {
  id?: string;
  name: string;
  email?: string | null;
  photo_url?: string | null;
  bio?: string | null;
  calendly_url?: string | null;
  active?: boolean;
  sort_order?: number;
};

export async function assignSpecialist(memberId: string, specialistName: string | null) {
  const supabase = await createClient();
  const value = specialistName && specialistName.trim() ? specialistName.trim() : null;
  const { error } = await supabase
    .from("members")
    .update({ assigned_partner: value })
    .eq("id", memberId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard/integration");
  revalidatePath(`/dashboard/${memberId}`);
  return { ok: true as const };
}

export async function upsertSpecialist(input: SpecialistInput) {
  const supabase = await createClient();
  const row = {
    name: input.name.trim(),
    email: input.email?.trim() || null,
    photo_url: input.photo_url?.trim() || null,
    bio: input.bio?.trim() || null,
    calendly_url: input.calendly_url?.trim() || null,
    active: input.active ?? true,
    sort_order: input.sort_order ?? 0,
  };
  if (!row.name) return { ok: false as const, error: "Name is required" };

  if (input.id) {
    const { error } = await supabase
      .from("integration_specialists")
      .update(row)
      .eq("id", input.id);
    if (error) return { ok: false as const, error: error.message };
  } else {
    const { error } = await supabase
      .from("integration_specialists")
      .insert(row);
    if (error) return { ok: false as const, error: error.message };
  }
  revalidatePath("/dashboard/integration");
  revalidatePath("/dashboard/integration/specialists");
  return { ok: true as const };
}

export async function deleteSpecialist(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("integration_specialists")
    .delete()
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard/integration");
  revalidatePath("/dashboard/integration/specialists");
  return { ok: true as const };
}
