import { ImageResponse } from "next/og";

// Social card for the public discovery-call page. Text-only on the brand
// palette so it renders identically everywhere the link is shared.
export const alt = "Vital Kauaʻi · Book a Discovery Call";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(160deg, #0e1a10 0%, #1c2b1e 100%)",
          color: "#f5f0e8",
          fontFamily: "Georgia, serif",
          textAlign: "center",
          padding: "60px",
        }}
      >
        <div
          style={{
            fontSize: 22,
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            color: "#a8c5ac",
            marginBottom: 36,
          }}
        >
          Vital Kauaʻi Church · Hanalei, Kauaʻi
        </div>
        <div style={{ fontSize: 84, lineHeight: 1.05, fontWeight: 300 }}>
          Begin with a conversation.
        </div>
        <div
          style={{
            fontSize: 34,
            marginTop: 28,
            color: "#c8a96e",
            fontStyle: "italic",
          }}
        >
          Book a 30-minute discovery call
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 44,
            fontSize: 22,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "rgba(245,240,232,0.5)",
          }}
        >
          vitalkauai.com/discovery-call
        </div>
      </div>
    ),
    size,
  );
}
