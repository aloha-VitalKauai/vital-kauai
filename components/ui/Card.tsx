import type { ReactNode, CSSProperties } from "react";

// Server component. Mirrors the most-used portal card pattern: cream
// rgba surface on a dark forest backdrop, sage hairline border, calm
// 12px radius, generous interior padding. Caller picks tone="dark"
// (cream-on-forest, default — used by contact + integration pages)
// or tone="light" (subtle ink-on-cream, for cream-background pages).
// Palette literals match the existing inline styles byte-for-byte.

export function Card({
  children,
  tone = "dark",
  style,
}: {
  children: ReactNode;
  tone?: "dark" | "light";
  style?: CSSProperties;
}) {
  const palette =
    tone === "light"
      ? {
          background: "rgba(122,158,126,0.04)",
          border: "1px solid rgba(122,158,126,0.18)",
        }
      : {
          background: "rgba(245,240,232,0.04)",
          border: "1px solid rgba(168,197,172,0.18)",
        };
  return (
    <div
      style={{
        ...palette,
        borderRadius: 12,
        padding: "32px 36px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
