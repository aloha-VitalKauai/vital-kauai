import type { ReactNode, CSSProperties } from "react";

// Server component. Centers content with a max-width that matches the
// recurring portal layout values (640 / 920 / 1200). Padding is left
// to the caller — this primitive only handles centering and width
// constraint so it can be composed inside any existing page layout.

export function Container({
  children,
  width = "default",
  style,
}: {
  children: ReactNode;
  width?: "narrow" | "default" | "wide";
  style?: CSSProperties;
}) {
  const maxWidth = width === "narrow" ? 640 : width === "wide" ? 1200 : 920;
  return (
    <div style={{ width: "100%", maxWidth, margin: "0 auto", ...style }}>
      {children}
    </div>
  );
}
