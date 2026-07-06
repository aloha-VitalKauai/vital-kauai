"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type PractitionerInput = {
  id?: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  engagement_type: string;
  active?: boolean;
  notes?: string | null;
};

export async function upsertPractitioner(input: PractitionerInput) {
  const supabase = await createClient();
  const row = {
    full_name: input.full_name.trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    role: input.role,
    engagement_type: input.engagement_type,
    active: input.active ?? true,
    notes: input.notes?.trim() || null,
  };
  if (!row.full_name) return { ok: false as const, error: "Name is required" };

  if (input.id) {
    const { error } = await supabase
      .from("practitioners")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", input.id);
    if (error) return { ok: false as const, error: error.message };
  } else {
    const { error } = await supabase.from("practitioners").insert(row);
    if (error) return { ok: false as const, error: error.message };
  }
  revalidatePath("/dashboard/team");
  return { ok: true as const };
}

export async function deletePractitioner(id: string) {
  const supabase = await createClient();

  // Clear the storage folder first — DB rows cascade, storage objects don't.
  const { data: docs } = await supabase
    .from("practitioner_documents")
    .select("file_path")
    .eq("practitioner_id", id);
  const paths = (docs ?? []).map((d) => d.file_path).filter(Boolean);
  if (paths.length) {
    await supabase.storage.from("practitioner-documents").remove(paths);
  }

  const { error } = await supabase.from("practitioners").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard/team");
  return { ok: true as const };
}

export type PractitionerDocumentInput = {
  practitioner_id: string;
  doc_type: string;
  title?: string | null;
  file_name: string;
  file_path: string;
  file_size_bytes?: number | null;
  version?: string | null;
  signed_at?: string | null;
  expires_at?: string | null;
  notes?: string | null;
};

export async function recordPractitionerDocument(input: PractitionerDocumentInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("practitioner_documents").insert({
    practitioner_id: input.practitioner_id,
    doc_type: input.doc_type,
    title: input.title?.trim() || null,
    file_name: input.file_name,
    file_path: input.file_path,
    file_size_bytes: input.file_size_bytes ?? null,
    version: input.version?.trim() || null,
    signed_at: input.signed_at || null,
    expires_at: input.expires_at || null,
    notes: input.notes?.trim() || null,
    uploaded_by: user?.id ?? null,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard/team");
  revalidatePath(`/dashboard/team/${input.practitioner_id}`);
  return { ok: true as const };
}

export async function deletePractitionerDocument(docId: string) {
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("practitioner_documents")
    .select("practitioner_id, file_path")
    .eq("id", docId)
    .maybeSingle();
  if (!doc) return { ok: false as const, error: "Document not found" };

  if (doc.file_path) {
    await supabase.storage.from("practitioner-documents").remove([doc.file_path]);
  }
  const { error } = await supabase.from("practitioner_documents").delete().eq("id", docId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/dashboard/team/${doc.practitioner_id}`);
  return { ok: true as const };
}
