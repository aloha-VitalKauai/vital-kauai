import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vitalkauai.com";

// Only the front door. Every other route is members-only and stays out of
// search engines (see app/robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 }];
}
