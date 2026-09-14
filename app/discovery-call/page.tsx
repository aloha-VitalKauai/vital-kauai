import type { Metadata } from "next";
import { DiscoveryCallPage } from "@/components/discovery-call-page";

const title = "Begin the Journey · Book a Discovery Call";
const description =
  "Every journey with Vital Kauaʻi begins with a 30-minute conversation. A member-based spiritual community on Kauaʻi's North Shore offering preparation, iboga ceremony, and integration.";

// The ad landing page. Unlinked from the rest of the site; people arrive
// here from an ad, a post or a directory. Search indexing stays limited to
// the front door (see app/robots.ts), so this page asks not to be indexed.
export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/discovery-call" },
  robots: { index: false, follow: false },
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

export default function DiscoveryCallRoute() {
  return <DiscoveryCallPage />;
}
