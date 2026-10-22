import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/assets";
import { fetchJson, getLocationCounts } from "@/lib/serverData";
import { buildPropertySlug } from "@/lib/propertySlug";
import { slugifyLocality } from "@/lib/seo/nagpur-geo";

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/properties", priority: 0.9, changeFrequency: "daily" },
  { path: "/how-it-works", priority: 0.6, changeFrequency: "monthly" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "monthly" },
  { path: "/privacy-policy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
];

interface SitemapProperty {
  id: number;
  title: string;
  updated_at?: string | null;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [data, locations] = await Promise.all([
    fetchJson("/sitemap-data", 300),
    getLocationCounts(),
  ]);

  const properties: SitemapProperty[] = Array.isArray(data) ? data : [];

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const propertyEntries: MetadataRoute.Sitemap = properties.map((property) => ({
    url: `${SITE_URL}/property/${buildPropertySlug(property.id, property.title)}`,
    lastModified: property.updated_at ? new Date(property.updated_at) : now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const locationEntries: MetadataRoute.Sitemap = (locations || [])
    .filter((l) => l.count > 0 && l.name)
    .map((l) => ({
      url: `${SITE_URL}/properties/${slugifyLocality(l.name)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  return [...staticEntries, ...locationEntries, ...propertyEntries];
}
