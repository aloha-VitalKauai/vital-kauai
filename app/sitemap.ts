import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const routes = [
  "/",
  "/about",
  "/healing-circle",
  "/stay",
  "/portal",
  "/intake-form",
  "/membership-application",
  "/medical-disclaimer",
  "/privacy-policy",
  "/iboga-journey",
  "/sacred-intimacy",
  "/vitality",
  "/church-information",
  "/terms-of-use",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
