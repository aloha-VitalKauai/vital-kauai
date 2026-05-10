import type { MetadataRoute } from "next";

// PWA manifest. Members can "Add to Home Screen" on iOS and Android and
// launch the portal in standalone mode (no browser chrome). Icons are
// SVG — modern Chrome/Safari/Firefox/Edge resolve them at any size.
// Apple-touch-icon for iOS is generated dynamically via app/apple-icon.tsx.
//
// No service worker yet — installability identity only.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vital Kauaʻi",
    short_name: "Vital Kauaʻi",
    description:
      "Private member portal for preparation, integration, resources, and support.",
    start_url: "/portal",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#FDFAF6",
    theme_color: "#1C2B1E",
    icons: [
      {
        src: "/icons/icon-512.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
