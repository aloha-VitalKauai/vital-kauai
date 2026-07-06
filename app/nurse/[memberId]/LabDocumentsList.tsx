"use client";

import { createClient } from "@/lib/supabase/client";

type LabDoc = {
  id: string;
  lab_type: string;
  file_name: string;
  file_path: string;
  status: string | null;
  uploaded_at: string;
};

export default function LabDocumentsList({ labs }: { labs: LabDoc[] }) {
  const supabase = createClient();

  async function viewFile(filePath: string) {
    const { data } = await supabase.storage.from("lab-documents").createSignedUrl(filePath, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "0.5px solid rgba(0,0,0,0.1)",
        borderRadius: 10,
        padding: "1.25rem",
        fontFamily: "var(--font-body, sans-serif)",
      }}
    >
      <p
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#6B6B67",
          margin: "0 0 12px",
        }}
      >
        Lab documents ({labs.length})
      </p>
      {labs.length === 0 ? (
        <p style={{ fontSize: 13, color: "#9E9E9A", margin: 0 }}>No lab documents uploaded yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {labs.map((l) => (
            <div
              key={l.id}
              style={{
                border: "0.5px solid rgba(0,0,0,0.08)",
                borderRadius: 8,
                padding: "9px 12px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 160 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#1A1A18", margin: 0 }}>
                  {l.lab_type}
                </p>
                <p style={{ fontSize: 12, color: "#6B6B67", margin: "2px 0 0" }}>
                  {l.file_name} ·{" "}
                  {new Date(l.uploaded_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {l.status ? ` · ${l.status}` : ""}
                </p>
              </div>
              <button
                onClick={() => viewFile(l.file_path)}
                style={{
                  background: "transparent",
                  color: "#085041",
                  border: "0.5px solid rgba(8,80,65,0.35)",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "var(--font-body, sans-serif)",
                }}
              >
                View
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
