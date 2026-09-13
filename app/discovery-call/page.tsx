import type { Metadata } from "next";
import { DiscoveryCallPage } from "@/components/discovery-call-page";

const title = "Book a Discovery Call · Iboga Ceremony on Kauaʻi";
const description =
  "Begin with a 30-minute conversation. Vital Kauaʻi Church offers a program of preparation, iboga ceremony, and integration on Kauaʻi's North Shore. Membership is by application; the discovery call is open to everyone.";

// The one indexable page on the site. Everything else stays behind the
// member wall, so the title, description and social card here carry the
// whole public presence.
export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/discovery-call" },
  robots: { index: true, follow: true },
  openGraph: {
    title,
    description,
    url: "/discovery-call",
    siteName: "Vital Kauaʻi",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vitalkauai.com";

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Vital Kauaʻi Church",
  alternateName: "Vital Kauaʻi",
  url: siteUrl,
  email: "aloha@vitalkauai.com",
  description:
    "A member-based spiritual community offering a program of preparation, iboga ceremony, and integration on Kauaʻi's North Shore.",
  address: {
    "@type": "PostalAddress",
    postOfficeBoxNumber: "932",
    addressLocality: "Hanalei",
    addressRegion: "HI",
    postalCode: "96714",
    addressCountry: "US",
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    email: "aloha@vitalkauai.com",
    url: `${siteUrl}/discovery-call`,
  },
};

export default function DiscoveryCallRoute() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <DiscoveryCallPage />
    </>
  );
}
