import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vitalkauai.com";

// Only the public front door and the legal pages it links to. Everything
// else on the site is members-only and stays out of search engines.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/discovery-call`, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/privacy-policy`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${siteUrl}/terms-of-use`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${siteUrl}/medical-disclaimer`, changeFrequency: "yearly", priority: 0.1 },
  ];
}
