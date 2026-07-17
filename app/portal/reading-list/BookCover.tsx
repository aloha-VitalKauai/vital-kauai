"use client";

import { useState } from "react";

// Renders a book cover from a remote URL, falling back to a serif monogram
// (in the section accent color) if the image is missing or fails to load.
// Kept client-side so onError can swap in the placeholder gracefully.
export function BookCover({
  src,
  alt,
  accent,
  monogram,
}: {
  src?: string;
  alt: string;
  accent: string;
  monogram: string;
}) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={62}
        height={92}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    );
  }

  return (
    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, color: accent, opacity: 0.55 }}>
      {monogram}
    </span>
  );
}
