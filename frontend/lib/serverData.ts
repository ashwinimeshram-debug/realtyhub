import { API_BASE_URL } from "./assets";

export const REVALIDATE = 60;

const SERVER_API_BASE_URL = (() => {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  if (backend) {
    return `${backend.replace(/\/+$/, "")}/api`;
  }
  return API_BASE_URL;
})();

export async function fetchJson(path: string, revalidate: number = REVALIDATE) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${SERVER_API_BASE_URL}${path}`, {
      signal: controller.signal,
      next: { revalidate },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getSettings(): Promise<Record<string, string>> {
  const data = await fetchJson("/settings");
  return data && typeof data === "object" ? (data as Record<string, string>) : {};
}

export interface HomeData {
  settings: Record<string, string>;
  heroSlides: any[];
  services: any[];
  advantages: any[];
  testimonials: any[];
  featured: any[];
  faqs: any[];
  allProperties: any[];
  latest: any[];
}

export async function getHomeData(): Promise<HomeData> {
  const [settingsRes, heroRes, servicesRes, advantagesRes, testimonialsRes, featuredRes, faqsRes, allRes] =
    await Promise.all([
      fetchJson("/settings"),
      fetchJson("/hero"),
      fetchJson("/services"),
      fetchJson("/advantages"),
      fetchJson("/testimonials"),
      fetchJson("/properties?featured=true"),
      fetchJson("/faq"),
      fetchJson("/properties"),
    ]);

  const list = (v: any) => (Array.isArray(v) ? v : v?.items || []);
  const items = (v: any) => (Array.isArray(v) ? v : v?.items || []);

  const settings =
    settingsRes && typeof settingsRes === "object"
      ? (settingsRes as Record<string, string>)
      : {};
  const allProperties = list(allRes);

  const parsedCount = parseInt(settings["section_new_count"] || "10", 10);
  const newCount = Math.min(Math.max(Number.isFinite(parsedCount) ? parsedCount : 10, 1), 20);
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const latest = allProperties.slice(0, newCount).map((p: any) => ({
    ...p,
    _isNew: p.created_at ? now - new Date(p.created_at).getTime() < weekMs : false,
  }));

  return {
    settings,
    heroSlides: items(heroRes),
    services: items(servicesRes),
    advantages: items(advantagesRes),
    testimonials: items(testimonialsRes),
    featured: list(featuredRes),
    faqs: items(faqsRes),
    allProperties,
    latest,
  };
}

export interface PagedProperties {
  items: any[];
  total: number;
}

export async function getProperties(query: string): Promise<PagedProperties> {
  const data = await fetchJson(`/properties${query ? `?${query}` : ""}`);
  if (!data) return { items: [], total: 0 };
  return {
    items: Array.isArray(data) ? data : data.items || [],
    total: Array.isArray(data) ? data.length : data.total ?? 0,
  };
}

export async function getLocationCounts(): Promise<{ name: string; count: number }[]> {
  const data = await fetchJson("/location-counts");
  return Array.isArray(data) ? data : [];
}

