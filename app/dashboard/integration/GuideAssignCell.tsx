"use client";

import { useState, useTransition } from "react";
import { assignSpecialist } from "./actions";

type Specialist = { id: string; name: string };

export default function GuideAssignCell({
  memberId,
  current,
  specialists,
}: {
  memberId: string;
  current: string | null;
  specialists: Specialist[];
}) {
  const [value, setValue] = useState<string>(current ?? "");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");

  // If the current assignment isn't in the specialists list (legacy free-text
  // name), surface it as a selectable option so we don't silently wipe it.
  const names = specialists.map((s) => s.name);
  const showLegacy = current && !names.some((n) => n.toLowerCase() === current.toLowerCase());

  function onChange(next: string) {
    setValue(next);
    setStatus("idle");
    startTransition(async () => {
      const res = await assignSpecialist(memberId, next || null);
      setStatus(res.ok ? "ok" : "err");
      if (res.ok) setTimeout(() => setStatus("idle"), 1500);
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontSize: 12,
          padding: "4px 6px",
          border: "0.5px solid rgba(0,0,0,0.15)",
          borderRadius: 6,
          background: "#fff",
          color: value ? "#1A1A18" : "#9E9E9A",
          minWidth: 140,
          cursor: pending ? "wait" : "pointer",
        }}
      >
        <option value="">— Unassigned</option>
        {showLegacy && <option value={current!}>{current} (legacy)</option>}
        {specialists.map((s) => (
          <option key={s.id} value={s.name}>
            {s.name}
          </option>
        ))}
      </select>
      <span
        style={{
          fontSize: 10,
          color: status === "err" ? "#B42318" : status === "ok" ? "#085041" : "#C8C8C4",
          minWidth: 10,
        }}
        aria-live="polite"
      >
        {pending ? "…" : status === "ok" ? "✓" : status === "err" ? "!" : ""}
      </span>
    </div>
  );
}
