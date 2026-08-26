"use client";

/**
 * SessionsTrackerCard
 * Founder view of a member's session balances on the profile → Integration
 * tab — the tracker from the original Sessions spec:
 *
 *   SESSIONS
 *   Coaching   7 / 10 left
 *   PNE        4 / 6 left
 *
 * Read-only. Balances are derived by the exact same lib the member portal
 * uses, running under the founder's own session — the founder RLS policies
 * on the sessions tables grant read across every member. Bookings parked
 * needs_review (unauthorized or unmatched) surface as a count here so they
 * don't sit invisible; resolving them stays founder-tooling for later.
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getSessionBalances,
  SESSION_TYPES,
  type SessionBalance,
  type SessionType,
} from "@/lib/sessions/balance";
import { describeError } from "@/components/portal/sessionCardState";

const CARD: React.CSSProperties = {
  background: "#fff",
  border: "0.5px solid rgba(0,0,0,0.1)",
  borderRadius: 10,
  padding: "1.25rem",
};

const LABEL: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#6B6B67",
  marginBottom: 6,
};

const TYPE_LABEL: Record<SessionType, { name: string; detail: string }> = {
  coaching: { name: "Coaching", detail: "1 Hour Coaching Call" },
  pne: { name: "PNE", detail: "PsychoNeuroEnergetics" },
};

type Loaded = {
  balances: Record<SessionType, SessionBalance>;
  needsReview: number;
};

export default function SessionsTrackerCard({ memberId }: { memberId: string }) {
  const [state, setState] = useState<Loaded | "loading" | "no-account" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      // Sessions are keyed by the member's auth profile, not the CRM row id.
      const { data: row } = await supabase
        .from("members")
        .select("profile_id")
        .eq("id", memberId)
        .maybeSingle();
      if (!row?.profile_id) {
        if (!cancelled) setState("no-account");
        return;
      }
      const [balances, review] = await Promise.all([
        getSessionBalances(supabase, row.profile_id),
        supabase
          .from("session_bookings")
          .select("id", { count: "exact", head: true })
          .eq("member_id", row.profile_id)
          .eq("needs_review", true),
      ]);
      if (!cancelled) setState({ balances, needsReview: review.count ?? 0 });
    })().catch((err) => {
      console.error("[sessions] tracker load failed:", describeError(err));
      if (!cancelled) setState("error");
    });
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  return (
    <div style={CARD}>
      <p style={{ ...LABEL, marginBottom: 12 }}>Sessions</p>

      {state === "loading" ? (
        <p style={{ fontSize: 13, color: "#9E9E9A", margin: 0 }}>Loading…</p>
      ) : state === "no-account" ? (
        <p style={{ fontSize: 13, color: "#9E9E9A", margin: 0 }}>
          No portal account yet — sessions begin at activation.
        </p>
      ) : state === "error" ? (
        <p style={{ fontSize: 13, color: "#9E9E9A", margin: 0 }}>
          Session balances are unavailable right now.
        </p>
      ) : (
        <>
          {SESSION_TYPES.every((t) => state.balances[t].granted === 0) ? (
            <p style={{ fontSize: 13, color: "#9E9E9A", margin: 0 }}>
              No sessions granted yet.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
                fontSize: 13,
              }}
            >
              {SESSION_TYPES.filter((t) => state.balances[t].granted > 0).map((t) => {
                const b = state.balances[t];
                return (
                  <div key={t}>
                    <p style={{ color: "#6B6B67", margin: "0 0 2px" }}>
                      {TYPE_LABEL[t].name}
                      <span style={{ color: "#9E9E9A" }}> · {TYPE_LABEL[t].detail}</span>
                    </p>
                    <p style={{ color: "#1A1A18", margin: 0 }}>
                      <strong style={{ fontWeight: 600 }}>{b.remaining}</strong>
                      {" / "}
                      {b.granted} left
                      {b.used > 0 && (
                        <span style={{ color: "#9E9E9A" }}>
                          {" "}
                          · {b.used} used
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {state.needsReview > 0 && (
            <p style={{ fontSize: 12.5, color: "#A05A2C", margin: "12px 0 0" }}>
              {state.needsReview} booking{state.needsReview === 1 ? "" : "s"} awaiting
              review — recorded without a matching session authorization.
            </p>
          )}
        </>
      )}
    </div>
  );
}
