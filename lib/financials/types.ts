export type ExpenseScope = "journey" | "cohort" | "overhead";
export type ExpenseCategory =
  | "food"
  | "lodging"
  | "medicine"
  | "guide_prep"
  | "transportation"
  | "facility"
  | "supplies"
  | "admin"
  | "other";

export type PayoutRole =
  | "guide"
  | "founder"
  | "partner"
  | "vendor"
  | "contractor"
  | "other";
export type PayoutStatus = "pending" | "scheduled" | "paid" | "canceled";

export interface ExpenseEntry {
  id: string;
  scope: ExpenseScope;
  journey_id: string | null;
  cohort_id: string | null;
  category: ExpenseCategory;
  amount_cents: number;
  vendor: string | null;
  notes: string | null;
  receipt_url: string | null;
  incurred_at: string;
  created_at: string;
}

export interface PayoutCommitment {
  id: string;
  scope: ExpenseScope;
  journey_id: string | null;
  cohort_id: string | null;
  payee_name: string;
  payee_email: string | null;
  role: PayoutRole;
  amount_cents: number;
  status: PayoutStatus;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface CohortMargin {
  cohort_id: string;
  cohort_title: string;
  start_at: string;
  cohort_status: string;
  enrolled_members: number;
  revenue_cents: number;
  expense_cents: number;
  payout_cents: number;
  margin_cents: number;
  margin_pct: number | null;
}

export interface PrivateCeremonyMargin {
  journey_id: string;
  member_id: string;
  member_name: string;
  journey_status: string;
  schedule_type: string;
  start_at: string | null;
  end_at: string | null;
  booked_cents: number;
  revenue_cents: number;
  expense_cents: number;
  payout_cents: number;
}

export interface FinancialsOverview {
  total_revenue_cents: number;
  onboarding_revenue_cents: number;
  journey_revenue_cents: number;
  total_expenses_cents: number;
  total_payouts_cents: number;
  payouts_pending_cents: number;
  payouts_scheduled_cents: number;
  payouts_paid_cents: number;
  // Booked = sum of active financial_commitments per member, falling back
  // to legacy members.program_price * 100 when no commitment exists.
  booked_revenue_cents: number;
  enrolled_members: number;
}
