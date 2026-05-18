import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { RecoveryRedirect } from "@/components/recovery-redirect";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

const jost = Jost({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500"],
  variable: "--font-body",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Vital Kauaʻi",
    template: "%s | Vital Kauaʻi",
  },
  description: "A living sanctuary of transformation and awakening on Kauaʻi's sacred North Shore.",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Vital Kauaʻi",
    description: "A living sanctuary of transformation and awakening on Kauaʻi's sacred North Shore.",
    url: siteUrl,
    siteName: "Vital Kauaʻi",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vital Kauaʻi",
    description: "A living sanctuary of transformation and awakening on Kauaʻi's sacred North Shore.",
  },
  // PWA installability identity. When a member adds the site to their
  // iOS home screen and launches it, iOS uses these to render the app
  // shell: standalone window (no browser chrome), translucent status bar
  // (so the dark portal nav extends behind it), and the calm "Vital
  // Kauaʻi" title under the icon.
  appleWebApp: {
    capable: true,
    title: "Vital Kauaʻi",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${cormorant.variable} ${jost.variable}`}>
        <RecoveryRedirect />
        {children}
      </body>
      <GoogleAnalytics gaId="G-VFF127QR7J" />
    </html>
  );
}
