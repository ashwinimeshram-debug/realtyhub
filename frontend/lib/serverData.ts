import { cache } from "react";
import { API_BASE_URL } from "./assets";
import type { SeoProperty } from "./seo/types";

export const REVALIDATE = 60;

const SERVER_API_BASE_URL = (() => {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  if (backend) {
    return `${backend.replace(/\/+$/, "")}/api`;
  }
  return API_BASE_URL;
})();

export async function fetchJson(path: string, revalidate: number = REVALIDATE) {
  // Shared hosts can briefly refuse DB connections (503) during SSR. Retry a
  // couple of times so a transient saturation does not render an empty page.
  const MAX_ATTEMPTS = 3;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(`${SERVER_API_BASE_URL}${path}`, {
        signal: controller.signal,
        next: { revalidate },
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        return await res.json();
      }
      // Only 5xx (temporary upstream failure) is worth retrying.
      if (res.status < 500 || attempt === MAX_ATTEMPTS - 1) {
        return null;
      }
    } catch {
      if (attempt === MAX_ATTEMPTS - 1) {
        return null;
      }
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }
  return null;
}

export const getSettings = cache(async (): Promise<Record<string, string>> => {
  const data = await fetchJson("/settings");
  return data && typeof data === "object" ? (data as Record<string, string>) : {};
});

export const getProperty = cache(async (id: number): Promise<SeoProperty | null> => {
  const data = await fetchJson(`/property/${id}`);
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return data as SeoProperty;
});

export interface HomeData {
  settings: Record<string, string>;
  heroSlides: any[];
  services: any[];
  advantages: any[];
  testimonials: any[];
  featured: any[];
  faqs: any[];
  latest: any[];
  locationCounts: { name: string; count: number }[];
}

export async function getHomeData(): Promise<HomeData> {
  const settingsRes = await getSettings();
  const settings =
    settingsRes && typeof settingsRes === "object"
      ? (settingsRes as Record<string, string>)
      : {};
  const parsedFeatCount = parseInt(settings["section_featured_count"] || "20", 10);
  const featCount = Math.min(Math.max(Number.isFinite(parsedFeatCount) ? parsedFeatCount : 20, 1), 50);

  const parsedNewCount = parseInt(settings["section_new_count"] || "10", 10);
  const newCount = Math.min(Math.max(Number.isFinite(parsedNewCount) ? parsedNewCount : 10, 1), 20);

  const [heroRes, servicesRes, advantagesRes, testimonialsRes, featuredRes, faqsRes, latestRes, locationsRes] =
    await Promise.all([
      fetchJson("/hero"),
      fetchJson("/services"),
      fetchJson("/advantages"),
      fetchJson("/testimonials"),
      fetchJson(`/properties?featured=true&per_page=${featCount}`),
      fetchJson("/faq"),
      fetchJson(`/properties?per_page=${newCount}`),
      fetchJson("/location-counts"),
    ]);

  const list = (v: any) => (Array.isArray(v) ? v : v?.items || []);

  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const latest = list(latestRes).slice(0, newCount).map((p: any) => ({
    ...p,
    _isNew: p.created_at ? now - new Date(p.created_at).getTime() < weekMs : false,
  }));

  const featured = list(featuredRes).slice(0, featCount);
  const locationCounts = Array.isArray(locationsRes) ? locationsRes : [];
  return {
    settings,
    heroSlides: list(heroRes),
    services: list(servicesRes),
    advantages: list(advantagesRes),
    testimonials: list(testimonialsRes),
    featured,
    faqs: list(faqsRes),
    latest,
    locationCounts,
  };
}

export interface PagedProperties {
  items: SeoProperty[];
  total: number;
  page: number;
  perPage: number;
}

export async function getProperties(query: string): Promise<PagedProperties> {
  const data = await fetchJson(`/properties${query ? `?${query}` : ""}`);
  if (!data) return { items: [], total: 0, page: 1, perPage: 50 };
  const items: SeoProperty[] = Array.isArray(data) ? data : data.items || [];
  return {
    items,
    total: Array.isArray(data) ? data.length : data.total ?? items.length,
    page: Array.isArray(data) ? 1 : data.page ?? 1,
    perPage: Array.isArray(data) ? items.length : data.per_page ?? 50,
  };
}

export async function getLocationCounts(): Promise<{ name: string; count: number }[]> {
  const data = await fetchJson("/location-counts");
  return Array.isArray(data) ? data : [];
}

export interface PageSection {
  id: string;
  label: string;
  content: string;
  type?: string;
}

export const getPageSections = cache(async (slug: string): Promise<PageSection[]> => {
  const data = await fetchJson(`/pages/${slug}/sections`);
  return Array.isArray(data) ? (data as PageSection[]) : [];
});

