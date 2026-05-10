import type { ReactNode, CSSProperties } from "react";

// Server component. The uppercase, wide-tracked label pattern used
// hundreds of times across the portal. Default tone is muted ink;
// tone="gold" picks the warm accent for hero/section eyebrows.
// Palette + tracking values mirror the existing inline patterns
// (font-size 11, letter-spacing 0.18em, weight 500).

export function Eyebrow({
  children,
  tone = "muted",
  style,
}: {
  children: ReactNode;
  tone?: "muted" | "gold" | "sage";
  style?: CSSProperties;
}) {
  const color =
    tone === "gold" ? "#C8A96E" : tone === "sage" ? "#5C7A5F" : "#9E9E9A";
  return (
    <p
      style={{
        fontFamily: "var(--font-body), 'Jost', sans-serif",
        fontSize: 11,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color,
        fontWeight: 500,
        margin: 0,
        ...style,
      }}
    >
      {children}
    </p>
  );
}
