"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type LabDoc = {
  id: string;
  file_name: string;
  status: string;
  uploaded_at: string;
};

export default function PortalLabsPage() {
  const supabase = createClient();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [labDoc, setLabDoc] = useState<LabDoc | null>(null);
  const [labUploading, setLabUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      const mid = member?.id ?? user.id;
      setMemberId(mid);

      const { data: labs } = await supabase
        .from("lab_documents")
        .select("id, file_name, status, uploaded_at")
        .eq("member_id", mid)
        .order("uploaded_at", { ascending: false })
        .limit(1);
      if (labs && labs.length > 0) setLabDoc(labs[0] as LabDoc);
    })();
  }, [supabase]);

  async function handleLabUpload(file: File) {
    if (!memberId) return;
    setLabUploading(true);
    setError(null);
    const path = `${memberId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("lab-documents").upload(path, file);
    if (upErr) {
      setError(upErr.message);
      setLabUploading(false);
      return;
    }
    if (labDoc) {
      await supabase.from("lab_documents").delete().eq("id", labDoc.id);
    }
    const { data: row, error: insErr } = await supabase
      .from("lab_documents")
      .insert({
        member_id: memberId,
        file_name: file.name,
        storage_path: path,
        status: "pending_review",
      })
      .select("id, file_name, status, uploaded_at")
      .single();
    if (insErr) {
      setError(insErr.message);
    } else if (row) {
      setLabDoc(row as LabDoc);
    }
    setLabUploading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0E1A10", color: "#F5F0E8" }}>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "80px 32px 100px" }}>
        <Link
          href="/portal/integration/pre-ceremony"
          style={{
            display: "inline-block",
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(245,240,232,0.55)",
            textDecoration: "none",
            marginBottom: 32,
          }}
        >
          ← Back to Pre-Ceremony
        </Link>

        <p style={{ fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase", color: "#C8A96E", fontWeight: 600, margin: "0 0 16px" }}>
          Lab Documents
        </p>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(36px, 5vw, 52px)", fontWeight: 300, color: "#F5F0E8", margin: "0 0 24px", lineHeight: 1.1 }}>
          Upload <em style={{ fontStyle: "italic", color: "#A8C5AC" }}>Your Labs</em>
        </h1>
        <p style={{ fontSize: 15, color: "rgba(245,240,232,0.72)", lineHeight: 1.85, marginBottom: 36, maxWidth: 600 }}>
          Walk through the lab requirements with your doctor. Once you have results, upload them
          here as a single PDF or image. Our medical team reviews them before ceremony and
          extracts the required values internally (EKG, thyroid, liver, magnesium, cardiac, CYP450,
          CMP).
        </p>

        {labDoc && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(245,240,232,0.04)", borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
            <span
              style={{
                width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                background: labDoc.status === "approved" ? "#1D9E75" : labDoc.status === "flagged" ? "#A32D2D" : labDoc.status === "processing" ? "#EF9F27" : "#378ADD",
              }}
            />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, color: "#F5F0E8", fontWeight: 500, margin: 0 }}>{labDoc.file_name}</p>
              <p style={{ fontSize: 11, color: "rgba(245,240,232,0.45)", margin: "2px 0 0" }}>
                Uploaded {new Date(labDoc.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <span
              style={{
                fontSize: 12, padding: "3px 10px", borderRadius: 99,
                background: labDoc.status === "approved" ? "rgba(29,158,117,0.15)" : labDoc.status === "flagged" ? "rgba(163,45,45,0.15)" : "rgba(55,138,221,0.15)",
                color: labDoc.status === "approved" ? "#1D9E75" : labDoc.status === "flagged" ? "#FF9E8C" : "#378ADD",
              }}
            >
              {labDoc.status === "approved" ? "Approved" : labDoc.status === "flagged" ? "Needs attention" : labDoc.status === "processing" ? "Processing…" : "Under review"}
            </span>
          </div>
        )}

        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: labUploading ? "rgba(255,255,255,0.02)" : "rgba(168,197,172,0.08)",
            border: "1px dashed rgba(168,197,172,0.30)",
            borderRadius: 8,
            padding: "28px",
            cursor: labUploading ? "not-allowed" : "pointer",
            opacity: labUploading ? 0.5 : 1,
            transition: "all 0.15s",
          }}
        >
          <span style={{ fontSize: 14, color: "#A8C5AC", fontWeight: 500 }}>
            {labUploading ? "Uploading…" : labDoc ? "Replace with new document" : "Choose file to upload"}
          </span>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            style={{ display: "none" }}
            disabled={labUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLabUpload(file);
              e.target.value = "";
            }}
          />
        </label>

        {error && (
          <p style={{ marginTop: 16, fontSize: 13, color: "#FF9E8C" }}>
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
