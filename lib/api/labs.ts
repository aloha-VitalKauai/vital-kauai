import type { SupabaseClient } from "@supabase/supabase-js";

// Labs-page data layer. The portal /portal/labs page lets members upload
// lab results into the lab-documents storage bucket and tracks the
// metadata in lab_documents. Bodies are byte-equivalent copies of the
// Supabase calls that previously lived inline in
// app/portal/labs/page.tsx — relocated here so the mobile client can
// consume the same typed contract.
//
// Note: the portal-home page (components/portal-home-page.tsx) has its
// own lab upload widget that uses a different storage path scheme
// (single-file overwrite vs append-with-timestamp). It stays inline for
// now and is out of scope for this PR.

export type LabDoc = {
  id: string;
  file_name: string;
  status: string;
  uploaded_at: string;
};

export function getLatestLabDocument(supabase: SupabaseClient, memberId: string) {
  return supabase
    .from("lab_documents")
    .select("id, file_name, status, uploaded_at")
    .eq("member_id", memberId)
    .order("uploaded_at", { ascending: false })
    .limit(1);
}

export function uploadLabDocumentFile(
  supabase: SupabaseClient,
  path: string,
  file: File,
) {
  return supabase.storage.from("lab-documents").upload(path, file);
}

export function deleteLabDocument(supabase: SupabaseClient, id: string) {
  return supabase.from("lab_documents").delete().eq("id", id);
}

export function insertLabDocument(
  supabase: SupabaseClient,
  doc: {
    member_id: string;
    file_name: string;
    storage_path: string;
    status: string;
  },
) {
  return supabase
    .from("lab_documents")
    .insert(doc)
    .select("id, file_name, status, uploaded_at")
    .single();
}
