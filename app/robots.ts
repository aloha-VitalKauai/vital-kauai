import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vitalkauai.com";

// The site is private by design. Search engines may index only the front
// door: the root URL and the /login page it redirects to for visitors
// without a session. The `$` anchors each allow rule to that exact path,
// so a bare "Allow: /" never reopens the rest of the site. Everything
// else (member pages, portal, dashboards, guides) stays disallowed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/$", "/login$"],
      disallow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
