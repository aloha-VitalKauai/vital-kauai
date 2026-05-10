"use client";

// Calm error boundary for /portal/labs. Dark forest palette to match
// the labs page.

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div
      style={{
        minHeight: "calc(100vh - 60px)",
        background: "#0E1A10",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 32px",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-body), sans-serif",
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(245,240,232,0.45)",
          margin: "0 0 18px",
        }}
      >
        Something interrupted us
      </p>
      <h2
        style={{
          fontFamily: "var(--font-display), 'Cormorant Garamond', serif",
          fontStyle: "italic",
          fontSize: "clamp(24px, 3vw, 30px)",
          fontWeight: 300,
          color: "#F5F0E8",
          margin: "0 0 28px",
          maxWidth: 480,
          lineHeight: 1.3,
        }}
      >
        We couldn&rsquo;t load your labs just now.
      </h2>
      <button
        type="button"
        onClick={reset}
        style={{
          fontFamily: "var(--font-body), sans-serif",
          fontSize: 11,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          padding: "12px 28px",
          background: "transparent",
          border: "0.5px solid rgba(245,240,232,0.25)",
          borderRadius: 6,
          color: "#F5F0E8",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}
