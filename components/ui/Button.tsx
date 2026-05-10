"use client";

import type { ReactNode, MouseEventHandler, CSSProperties } from "react";

// Client component (carries onClick). One ghost variant by default —
// transparent surface, ink hairline border, uppercase wide-tracked
// label. variant="primary" uses the existing dark-pill pattern from
// the dashboard header. minHeight 44 honors mobile tap-target
// guidance without changing desktop appearance.
//
// Polymorphism is intentionally limited: <button> only. Anchor links
// stay as <a> for now (they don't need a shared abstraction yet).

export function Button({
  children,
  onClick,
  type = "button",
  variant = "ghost",
  disabled,
  style,
}: {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
  variant?: "ghost" | "primary";
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: "var(--font-body), 'Jost', sans-serif",
        fontSize: 11,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        padding: "12px 28px",
        background: isPrimary ? "#0E0C0A" : "transparent",
        border: isPrimary
          ? "0.5px solid rgba(0,0,0,0.35)"
          : "0.5px solid rgba(0,0,0,0.25)",
        borderRadius: 6,
        color: isPrimary ? "#F0EBE0" : "#1A1A18",
        minHeight: 44,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
