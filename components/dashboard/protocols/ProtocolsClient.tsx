"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ProtocolTemplate,
  ProtocolTemplateWithItems,
} from "@/lib/protocols/types";
import ProtocolCard from "./ProtocolCard";
import ProtocolForm from "./ProtocolForm";
import ApplyProtocolForm from "./ApplyProtocolForm";

// Protocols workspace: lists templates, opens the header form (create/edit) and
// the apply modal. Block editing lives on each expandable card. Data loads from
// /api/admin/protocols.
export default function ProtocolsClient() {
  const [templates, setTemplates] = useState<ProtocolTemplateWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{ existing?: ProtocolTemplate } | null>(null);
  const [applyFor, setApplyFor] = useState<ProtocolTemplate | null>(null);

  // Pure fetcher (no setState) — safe to call from the mount effect.
  const load = useCallback((): Promise<ProtocolTemplateWithItems[]> => {
    return fetch("/api/admin/protocols").then((res) => {
      if (!res.ok) throw new Error("load failed");
      return res.json().then((d) => d.templates ?? []);
    });
  }, []);

  useEffect(() => {
    let ignore = false;
    load()
      .then((t) => {
        if (ignore) return;
        setTemplates(t);
        setError("");
        setLoading(false);
      })
      .catch(() => {
        if (ignore) return;
        setError("Could not load protocols.");
        setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [load]);

  const refetch = useCallback(() => {
    load()
      .then((t) => {
        setTemplates(t);
        setError("");
      })
      .catch(() => setError("Could not load protocols."));
  }, [load]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              color: "#1A1A18",
              fontFamily: "var(--font-display, serif)",
            }}
          >
            Protocols
          </h1>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 13,
              color: "#6B6B67",
              fontFamily: "var(--font-body, sans-serif)",
            }}
          >
            Reusable day-by-day templates. Apply one to a journey to schedule its
            blocks onto the calendar — where they stay fully editable.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm({})}
          style={{
            fontSize: 13,
            fontWeight: 500,
            padding: "8px 16px",
            background: "#0E0C0A",
            color: "#F0EBE0",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontFamily: "var(--font-body, sans-serif)",
          }}
        >
          + New protocol
        </button>
      </div>

      {loading && <p style={mutedStyle}>Loading…</p>}
      {error && <p style={{ ...mutedStyle, color: "#A32D2D" }}>{error}</p>}
      {!loading && !error && templates.length === 0 && (
        <p style={mutedStyle}>
          No protocols yet. Create one to get started.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {templates.map((t) => (
          <ProtocolCard
            key={t.id}
            template={t}
            onChanged={refetch}
            onEdit={() => setForm({ existing: t })}
            onApply={() => setApplyFor(t)}
          />
        ))}
      </div>

      {form && (
        <ProtocolForm
          existing={form.existing}
          onSaved={() => {
            setForm(null);
            refetch();
          }}
          onCancel={() => setForm(null)}
        />
      )}

      {applyFor && (
        <ApplyProtocolForm
          template={applyFor}
          onApplied={refetch}
          onCancel={() => setApplyFor(null)}
        />
      )}
    </div>
  );
}

const mutedStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#9E9E9A",
  fontFamily: "var(--font-body, sans-serif)",
  padding: "0.5rem 0",
};
