import type { SupabaseClient } from "@supabase/supabase-js";

// Typed query helpers for the `bookings` table (migration
// 20260528000000_bookings_table.sql). Member portal reads the current
// booking via getCurrentBookingForAuthUser; founder dashboard reads via
// getCurrentBookingForMember and writes via /api/bookings/update.

export const BOOKING_STATUS_VALUES = [
  "inquiry",
  "invited",
  "booked",
  "confirmed",
  "completed",
  "cancelled",
] as const;

export const PAYMENT_STATUS_VALUES = [
  "unpaid",
  "deposit_sent",
  "deposit_paid",
  "paid",
  "payment_plan_active",
  "failed",
  "refunded",
] as const;

export type BookingStatus = (typeof BOOKING_STATUS_VALUES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUS_VALUES)[number];

export type Booking = {
  id: string;
  member_id: string;
  journey_id: string | null;
  booking_status: BookingStatus;
  payment_status: PaymentStatus;
  package_name: string | null;
  amount_cents: number | null;
  square_payment_id: string | null;
  square_order_id: string | null;
  square_customer_id: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const BOOKING_COLUMNS =
  "id, member_id, journey_id, booking_status, payment_status, package_name, amount_cents, square_payment_id, square_order_id, square_customer_id, paid_at, notes, created_at, updated_at";

export async function getCurrentBookingForMember(
  supabase: SupabaseClient,
  memberId: string,
): Promise<Booking | null> {
  const { data } = await supabase
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Booking | null) ?? null;
}

export async function getCurrentBookingForAuthUser(
  supabase: SupabaseClient,
  userEmail: string,
): Promise<Booking | null> {
  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("email", userEmail)
    .maybeSingle();
  if (!member?.id) return null;
  return getCurrentBookingForMember(supabase, member.id);
}

export function isValidBookingStatus(value: unknown): value is BookingStatus {
  return (
    typeof value === "string" &&
    (BOOKING_STATUS_VALUES as readonly string[]).includes(value)
  );
}

export function isValidPaymentStatus(value: unknown): value is PaymentStatus {
  return (
    typeof value === "string" &&
    (PAYMENT_STATUS_VALUES as readonly string[]).includes(value)
  );
}

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  inquiry: "Inquiry",
  invited: "Invited",
  booked: "Booked",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  deposit_sent: "Deposit sent",
  deposit_paid: "Deposit paid",
  paid: "Paid",
  payment_plan_active: "Payment plan active",
  failed: "Failed",
  refunded: "Refunded",
};
