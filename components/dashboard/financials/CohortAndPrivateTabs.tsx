"use client";
import { useState } from "react";
import CohortMarginsTable from "./CohortMarginsTable";
import PrivateCeremoniesTable from "./PrivateCeremoniesTable";
import type {
  CohortMargin,
  PrivateCeremonyMargin,
} from "@/lib/financials/types";
import { PANEL } from "./styles";

type Tab = "cohorts" | "private";

export default function CohortAndPrivateTabs({
  cohortRows,
  privateRows,
}: {
  cohortRows: CohortMargin[];
  privateRows: PrivateCeremonyMargin[];
}) {
  const [tab, setTab] = useState<Tab>("cohorts");

  return (
    <div style={PANEL}>
      <div
        style={{
          display: "flex",
          borderBottom: "0.5px solid rgba(0,0,0,0.07)",
        }}
      >
        <TabButton
          active={tab === "cohorts"}
          onClick={() => setTab("cohorts")}
          label="Cohort Margins"
        />
        <TabButton
          active={tab === "private"}
          onClick={() => setTab("private")}
          label={`Private Ceremony${
            privateRows.length ? ` (${privateRows.length})` : ""
          }`}
        />
      </div>

      {tab === "cohorts" ? (
        <CohortMarginsTable rows={cohortRows} />
      ) : (
        <PrivateCeremoniesTable rows={privateRows} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        padding: "0.875rem 1.25rem",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: active ? "#1A1A18" : "#9E9E9A",
        fontWeight: 500,
        cursor: "pointer",
        fontFamily: "var(--font-body, sans-serif)",
        borderBottom: active
          ? "2px solid #1A1A18"
          : "2px solid transparent",
        marginBottom: -1,
      }}
    >
      {label}
    </button>
  );
}
