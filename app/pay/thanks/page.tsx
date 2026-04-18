export default function PayThanks() {
  return (
    <main
      style={{
        padding: "4rem 2rem",
        textAlign: "center",
        maxWidth: 480,
        margin: "0 auto",
        fontFamily: "var(--font-body, sans-serif)",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display, serif)",
          fontWeight: 400,
          letterSpacing: "-0.02em",
        }}
      >
        Payment Received
      </h1>
      <p style={{ color: "#6B6B67" }}>
        Thank you — you can close this tab.
      </p>
    </main>
  );
}
