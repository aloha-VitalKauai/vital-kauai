import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${cormorant.variable} ${jost.variable}`}>{children}</body>
    </html>
  );
}
