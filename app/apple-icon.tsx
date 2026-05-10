import { ImageResponse } from "next/og";

// Apple touch icon. iOS requires PNG for proper home-screen rendering;
// Next generates this at build/request time via ImageResponse so we
// don't have to commit a binary. Glyph + palette match the SVG manifest
// icons (italic Cormorant V on forest).

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1C2B1E",
          color: "#F5F0E8",
          fontFamily: "Georgia, serif",
          fontStyle: "italic",
          fontSize: 130,
          fontWeight: 300,
          lineHeight: 1,
          paddingBottom: 12,
        }}
      >
        V
      </div>
    ),
    { ...size },
  );
}
