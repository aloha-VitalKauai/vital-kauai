// Calm Suspense fallback for /portal and any nested portal route that
// doesn't define its own loading.tsx. Background matches the portal-home
// .page warm-white so there's no color shift when the page resolves.
// Copy mirrors the portal-home component's existing internal loading
// state ("Loading your sanctuary…") so the server-hop fallback and the
// client data-fetch fallback read as one continuous moment.

export default function Loading() {
  return (
    <div
      className="vk-portal-shell"
      style={{
        background: "#FDFAF6",
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
        Loading your sanctuary&hellip;
      </p>
    </div>
  );
}
