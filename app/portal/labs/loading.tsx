// Calm Suspense fallback for /portal/labs. Background matches the labs
// page's dark forest so the transition to the rendered page is seamless.

export default function Loading() {
  return (
    <div
      className="vk-portal-shell"
      style={{
        background: "#0E1A10",
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
          color: "rgba(245,240,232,0.55)",
          textAlign: "center",
          margin: 0,
        }}
      >
        A moment, please.
      </p>
    </div>
  );
}
