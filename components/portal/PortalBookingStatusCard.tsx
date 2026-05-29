"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getCurrentBookingForAuthUser,
  BOOKING_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  type Booking,
  type BookingStatus,
  type PaymentStatus,
} from "@/lib/api/bookings";

type Props = {
  userEmail: string;
};

export default function PortalBookingStatusCard({ userEmail }: Props) {
  const supabase = createClient();
  const [booking, setBooking] = useState<Booking | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userEmail) {
        if (!cancelled) setBooking(null);
        return;
      }
      const b = await getCurrentBookingForAuthUser(supabase, userEmail);
      if (!cancelled) setBooking(b);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, userEmail]);

  if (booking === undefined) {
    return (
      <div style={CARD}>
        <p style={EYEBROW}>YOUR BOOKING</p>
        <div style={{ height: 28, width: "55%", background: "rgba(255,255,255,0.06)", borderRadius: 4, marginBottom: 10 }} />
        <div style={{ height: 13, width: "70%", background: "rgba(255,255,255,0.04)", borderRadius: 4 }} />
      </div>
    );
  }

  if (!booking) return null;

  return (
    <div style={CARD}>
      <p style={EYEBROW}>YOUR BOOKING</p>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <h3 style={HEADING}>
          {booking.package_name ?? "Your journey with Vital Kauaʻi"}
        </h3>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <Badge tone={bookingTone(booking.booking_status)}>
          {BOOKING_STATUS_LABEL[booking.booking_status]}
        </Badge>
        <Badge tone={paymentTone(booking.payment_status)}>
          {PAYMENT_STATUS_LABEL[booking.payment_status]}
        </Badge>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {booking.amount_cents != null && (
          <Stat label="Amount" value={fmtMoney(booking.amount_cents)} />
        )}
        {booking.paid_at && (
          <Stat label="Last payment" value={fmtDate(booking.paid_at)} />
        )}
      </div>

      <p style={FOOT}>{guidance(booking.booking_status, booking.payment_status)}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={STAT_LABEL}>{label}</p>
      <p style={STAT_VALUE}>{value}</p>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "neutral" | "warn" | "ok" | "danger" }) {
  const palette = {
    neutral: { bg: "rgba(165,200,176,0.1)",  fg: "#A5C8B0" },
    warn:    { bg: "rgba(184,104,61,0.15)",  fg: "#B8683D" },
    ok:      { bg: "rgba(104,168,112,0.15)", fg: "#68A870" },
    danger:  { bg: "rgba(163,45,45,0.18)",   fg: "#E88A8A" },
  }[tone];
  return (
    <span
      style={{
        fontSize: 10,
        letterSpacing: "0.1em",
        fontWeight: 600,
        padding: "5px 12px",
        borderRadius: 99,
        background: palette.bg,
        color: palette.fg,
        border: `0.5px solid ${palette.fg}`,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function bookingTone(s: BookingStatus): "neutral" | "warn" | "ok" | "danger" {
  if (s === "confirmed" || s === "completed") return "ok";
  if (s === "booked") return "warn";
  if (s === "cancelled") return "danger";
  return "neutral";
}

function paymentTone(s: PaymentStatus): "neutral" | "warn" | "ok" | "danger" {
  if (s === "paid") return "ok";
  if (s === "deposit_paid" || s === "payment_plan_active") return "warn";
  if (s === "failed" || s === "refunded") return "danger";
  return "neutral";
}

// Affirmative one-liner that orients the member to what's next. Voice rule:
// no "not X" — describe what is.
function guidance(b: BookingStatus, p: PaymentStatus): string {
  if (b === "completed") return "Your journey is complete. Stay close as you integrate.";
  if (b === "cancelled") return "Your booking is cancelled. Reach out when you're ready to return.";
  if (b === "confirmed" && p === "paid") return "You are confirmed and paid in full. Aloha.";
  if (b === "confirmed") return "Your place is confirmed. Payment details follow below.";
  if (b === "booked")    return "Your seat is held. Final confirmation arrives once payment clears.";
  if (b === "invited")   return "Welcome — your invitation is open. Begin with onboarding below.";
  return "Your inquiry is received. We'll be in touch soon.";
}

function fmtMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const CARD: React.CSSProperties = {
  background: "rgba(15, 26, 20, 0.85)",
  border: "0.5px solid rgba(232, 221, 200, 0.12)",
  borderRadius: 16,
  padding: "1.75rem",
  color: "#E8DDC8",
  fontFamily: "var(--font-body, sans-serif)",
};

const EYEBROW: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "rgba(232, 221, 200, 0.55)",
  margin: "0 0 0.5rem",
};

const HEADING: React.CSSProperties = {
  fontFamily: "var(--font-display, serif)",
  fontSize: 26,
  fontWeight: 400,
  margin: 0,
  lineHeight: 1.2,
  color: "#E8DDC8",
};

const STAT_LABEL: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(232,221,200,0.45)",
  margin: "0 0 4px",
};

const STAT_VALUE: React.CSSProperties = {
  fontFamily: "var(--font-display, serif)",
  fontSize: 18,
  color: "#E8DDC8",
  margin: 0,
};

const FOOT: React.CSSProperties = {
  marginTop: 18,
  fontSize: 13,
  lineHeight: 1.55,
  color: "rgba(232,221,200,0.7)",
};
