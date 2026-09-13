import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vitalkauai.com";

// The site is private by design. Crawlers may index only the public
// discovery-call front door and the legal pages it links to; the member
// site, portal and dashboards stay disallowed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/discovery-call",
        "/privacy-policy",
        "/terms-of-use",
        "/medical-disclaimer",
      ],
      disallow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
