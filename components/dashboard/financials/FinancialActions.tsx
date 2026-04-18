"use client";
import { useState } from "react";
import AddExpenseModal from "./AddExpenseModal";
import AddPayoutModal from "./AddPayoutModal";
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "./styles";

export default function FinancialActions({
  cohorts,
  journeys,
}: {
  cohorts: { id: string; title: string }[];
  journeys: { id: string; label: string }[];
}) {
  const [openExpense, setOpenExpense] = useState(false);
  const [openPayout, setOpenPayout] = useState(false);

  return (
    <>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={BUTTON_SECONDARY} onClick={() => setOpenExpense(true)}>
          Add Expense
        </button>
        <button style={BUTTON_PRIMARY} onClick={() => setOpenPayout(true)}>
          Add Payout
        </button>
      </div>
      <AddExpenseModal
        open={openExpense}
        onClose={() => setOpenExpense(false)}
        cohorts={cohorts}
        journeys={journeys}
      />
      <AddPayoutModal
        open={openPayout}
        onClose={() => setOpenPayout(false)}
        cohorts={cohorts}
        journeys={journeys}
      />
    </>
  );
}
