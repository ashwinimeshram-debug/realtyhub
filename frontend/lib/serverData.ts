import { API_BASE_URL } from "./assets";

export const REVALIDATE = 60;

export async function fetchJson(path: string, revalidate: number = REVALIDATE) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
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

  return {
    settings:
      settingsRes && typeof settingsRes === "object"
        ? (settingsRes as Record<string, string>)
        : {},
    heroSlides: items(heroRes),
    services: items(servicesRes),
    advantages: items(advantagesRes),
    testimonials: items(testimonialsRes),
    featured: list(featuredRes),
    faqs: items(faqsRes),
    allProperties: list(allRes),
  };
}
