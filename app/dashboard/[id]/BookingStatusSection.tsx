"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BOOKING_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
  BOOKING_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  type Booking,
  type BookingStatus,
  type PaymentStatus,
} from "@/lib/api/bookings";

type Props = {
  booking: Booking | null;
  memberId: string;
  memberName: string | null;
};

export default function BookingStatusSection({ booking, memberId, memberName }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [bookingStatus, setBookingStatus] = useState<BookingStatus>(
    booking?.booking_status ?? "invited",
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    booking?.payment_status ?? "unpaid",
  );
  const [packageName, setPackageName] = useState(booking?.package_name ?? "");
  const [amountDueDollars, setAmountDueDollars] = useState(
    booking?.amount_due_cents != null ? (booking.amount_due_cents / 100).toString() : "",
  );
  const [amountPaidDollars, setAmountPaidDollars] = useState(
    booking?.amount_paid_cents != null ? (booking.amount_paid_cents / 100).toString() : "0",
  );
  const [notes, setNotes] = useState(booking?.notes ?? "");
  const [reason, setReason] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);

  const initialAmountDue =
    booking?.amount_due_cents != null ? (booking.amount_due_cents / 100).toString() : "";
  const initialAmountPaid =
    booking?.amount_paid_cents != null ? (booking.amount_paid_cents / 100).toString() : "0";

  const dirty =
    bookingStatus !== (booking?.booking_status ?? "invited") ||
    paymentStatus !== (booking?.payment_status ?? "unpaid") ||
    packageName !== (booking?.package_name ?? "") ||
    amountDueDollars !== initialAmountDue ||
    amountPaidDollars !== initialAmountPaid ||
    notes !== (booking?.notes ?? "");

  function flash(text: string, err?: boolean) {
    setMsg({ text, err });
    setTimeout(() => setMsg(null), 5000);
  }

  async function handleSave() {
    setSaving(true);
    const amount_due_cents = dollarsToCents(amountDueDollars);
    const amount_paid_cents = dollarsToCents(amountPaidDollars);
    if (amount_due_cents === "invalid" || amount_paid_cents === "invalid") {
      setSaving(false);
      flash("Amounts must be positive numbers", true);
      return;
    }

    const res = await fetch("/api/bookings/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_id: memberId,
        booking_id: booking?.id,
        booking_status: bookingStatus,
        payment_status: paymentStatus,
        package_name: packageName.trim() === "" ? null : packageName.trim(),
        amount_due_cents,
        amount_paid_cents: amount_paid_cents ?? 0,
        notes: notes.trim() === "" ? null : notes.trim(),
        reason: reason.trim() === "" ? null : reason.trim(),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      flash(json.error ?? "Save failed", true);
      return;
    }
    setReason("");
    flash(memberName ? `Booking updated for ${memberName}` : "Booking updated");
    startTransition(() => router.refresh());
  }

  return (
    <div style={CARD}>
      {msg && (
        <div
          style={{
            background: msg.err ? "rgba(163,45,45,0.2)" : "rgba(104,168,112,0.15)",
            color: msg.err ? "#E88A8A" : "#68A870",
            padding: "8px 14px",
            borderRadius: 8,
            fontSize: 13,
            marginBottom: "1.25rem",
          }}
        >
          {msg.text}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <p style={SECTION_LABEL}>Booking</p>
          <h2 style={HEADING}>Booking & payment status</h2>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Badge tone={badgeTone(bookingStatus)}>{BOOKING_STATUS_LABEL[bookingStatus]}</Badge>
          <Badge tone={paymentBadgeTone(paymentStatus)}>{PAYMENT_STATUS_LABEL[paymentStatus]}</Badge>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 16,
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <label style={FIELD_LABEL}>Booking status</label>
          <select
            value={bookingStatus}
            onChange={(e) => setBookingStatus(e.target.value as BookingStatus)}
            style={DARK_INPUT}
          >
            {BOOKING_STATUS_VALUES.map((v) => (
              <option key={v} value={v}>
                {BOOKING_STATUS_LABEL[v]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={FIELD_LABEL}>Payment status</label>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
            style={DARK_INPUT}
          >
            {PAYMENT_STATUS_VALUES.map((v) => (
              <option key={v} value={v}>
                {PAYMENT_STATUS_LABEL[v]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={FIELD_LABEL}>Package (optional)</label>
          <input
            type="text"
            placeholder="e.g. Private Journey — March 2026"
            value={packageName}
            onChange={(e) => setPackageName(e.target.value)}
            style={DARK_INPUT}
          />
        </div>
        <div>
          <label style={FIELD_LABEL}>Amount due ($)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={amountDueDollars}
            onChange={(e) => setAmountDueDollars(e.target.value)}
            style={DARK_INPUT}
          />
        </div>
        <div>
          <label style={FIELD_LABEL}>Amount paid ($)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={amountPaidDollars}
            onChange={(e) => setAmountPaidDollars(e.target.value)}
            style={DARK_INPUT}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={FIELD_LABEL}>Notes (optional)</label>
          <input
            type="text"
            placeholder="Anything to remember about this booking"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={DARK_INPUT}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={FIELD_LABEL}>Reason for this change (saved to audit log)</label>
          <input
            type="text"
            placeholder="e.g. Received wire transfer, member requested refund"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={DARK_INPUT}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          style={{
            ...SAVE_BTN,
            opacity: saving || !dirty ? 0.45 : 1,
            cursor: saving || !dirty ? "default" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save booking"}
        </button>
        {booking?.paid_at && (
          <span style={{ fontSize: 12, color: "rgba(232,221,200,0.55)" }}>
            Last paid {new Date(booking.paid_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        )}
        {booking?.updated_at && (
          <span style={{ fontSize: 12, color: "rgba(232,221,200,0.45)", marginLeft: "auto" }}>
            Updated {new Date(booking.updated_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "neutral" | "warn" | "ok" | "danger" }) {
  const palette = {
    neutral: { bg: "rgba(165,200,176,0.1)", fg: "#A5C8B0" },
    warn:    { bg: "rgba(184,104,61,0.15)", fg: "#B8683D" },
    ok:      { bg: "rgba(104,168,112,0.15)", fg: "#68A870" },
    danger:  { bg: "rgba(163,45,45,0.2)",   fg: "#E88A8A" },
  }[tone];
  return (
    <span
      style={{
        fontSize: 10,
        letterSpacing: "0.08em",
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: 99,
        background: palette.bg,
        color: palette.fg,
        border: `0.5px solid ${palette.fg}`,
        whiteSpace: "nowrap",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function badgeTone(s: BookingStatus): "neutral" | "warn" | "ok" | "danger" {
  if (s === "confirmed" || s === "completed") return "ok";
  if (s === "booked") return "warn";
  if (s === "cancelled") return "danger";
  return "neutral";
}

function paymentBadgeTone(s: PaymentStatus): "neutral" | "warn" | "ok" | "danger" {
  if (s === "paid") return "ok";
  if (s === "deposit_paid" || s === "payment_plan_active") return "warn";
  if (s === "failed" || s === "refunded") return "danger";
  return "neutral";
}

// Parse a dollar string to integer cents. Returns null for empty, "invalid"
// for a non-numeric or negative value, integer cents otherwise.
function dollarsToCents(s: string): number | null | "invalid" {
  const trim = s.trim();
  if (trim === "") return null;
  const cents = Math.round(parseFloat(trim) * 100);
  if (!Number.isFinite(cents) || cents < 0) return "invalid";
  return cents;
}

const CARD: React.CSSProperties = {
  marginTop: "1.5rem",
  background: "#0F1A14",
  borderRadius: 16,
  padding: "1.75rem",
  fontFamily: "var(--font-body, sans-serif)",
  color: "#E8DDC8",
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(232,221,200,0.45)",
  fontWeight: 500,
  margin: "0 0 0.4rem",
};

const HEADING: React.CSSProperties = {
  fontFamily: "var(--font-display, serif)",
  fontSize: 22,
  fontWeight: 400,
  color: "#E8DDC8",
  margin: 0,
  lineHeight: 1.25,
};

const FIELD_LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(232,221,200,0.45)",
  marginBottom: 6,
};

const DARK_INPUT: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "0.5px solid rgba(232,221,200,0.2)",
  borderRadius: 7,
  padding: "9px 12px",
  fontSize: 13,
  color: "#E8DDC8",
  fontFamily: "inherit",
  outline: "none",
  width: "100%",
};

const SAVE_BTN: React.CSSProperties = {
  background: "#B8683D",
  color: "#fff",
  border: "none",
  borderRadius: 7,
  padding: "9px 18px",
  fontSize: 13,
  fontWeight: 500,
  fontFamily: "inherit",
};
