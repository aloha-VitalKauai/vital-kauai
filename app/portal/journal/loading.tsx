// Calm Suspense fallback for /portal/journal. Background matches the
// JournalClient body cream so the transition to the rendered page is
// seamless.

export default function Loading() {
  return (
    <div
      style={{
        minHeight: "calc(100vh - 60px)",
        background: "#FDFBF7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 32px",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-display), 'Cormorant Garamond', serif",
          fontStyle: "italic",
          fontSize: "clamp(20px, 2.5vw, 26px)",
          fontWeight: 300,
          color: "#6B6B67",
          textAlign: "center",
          margin: 0,
        }}
      >
        A moment, please.
      </p>
    </div>
  );
}
