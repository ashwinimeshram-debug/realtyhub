import { Suspense } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { backendAssetUrl } from "@/lib/assets";
import { getHomeData } from "@/lib/serverData";
import SearchBar from "@/components/SearchBar";
import SectionHeader from "@/components/home/SectionHeader";
import HeroSlider from "@/components/home/HeroSlider";
import TestimonialsCarousel from "@/components/home/TestimonialsCarousel";
import FaqAccordion from "@/components/home/FaqAccordion";

// Code-split the two Swiper-heavy sections so the shared bundle stays small;
// they still server-render for SEO and hydrate below the fold.
const FeaturedCarousel = dynamic(() => import("@/components/home/FeaturedCarousel"));
const NewPropertiesCarousel = dynamic(() => import("@/components/home/NewPropertiesCarousel"));
import JsonLd from "@/components/seo/JsonLd";
import DirectAnswer from "@/components/seo/DirectAnswer";
import { SITE_URL } from "@/lib/assets";
import { buildFaqGraph } from "@/lib/seo/schema";
import { BUYER_FAQ } from "@/lib/seo/answers";
import { slugifyLocality } from "@/lib/seo/nagpur-geo";

export const revalidate = 60;

const DEFAULT_ORDER = ["hero", "featured", "new", "services", "advantages", "testimonials", "faq"];

/* ───────── SERVICES ───────── */
function ServicesSection({ services, title, subtitle }: { services: any[]; title?: string; subtitle?: string }) {
  return (
    <section className="py-10 md:py-14 px-4 md:px-10">
      <SectionHeader
        title={title || "Our Comprehensive Services"}
        subtitle={subtitle || "End-to-end real estate solutions tailored to your needs"}
      />
      {services.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((s: any) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden card-hover flex flex-col">
              {s.image ? (
                <div className="relative aspect-[16/10] w-full overflow-hidden">
                  <Image
                    src={backendAssetUrl(s.image)}
                    alt={s.title || "Service"}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-full aspect-[16/10] bg-gray-200 flex items-center justify-center text-gray-400 text-sm">No Image</div>
              )}
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="font-bold text-lg" style={{ color: "var(--primary)" }}>{s.title || "No Title"}</h3>
                <p className="text-gray-600 mt-2 text-sm leading-relaxed flex-1" style={{ lineHeight: "1.6" }}>{s.description || ""}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-center">No services added</p>
      )}
    </section>
  );
}

/* ───────── ICON MAP FOR ADVANTAGES ───────── */
const ADVANTAGE_ICONS: Record<string, React.ReactNode> = {
  shield: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  pin: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  ),
  diamond: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
    </svg>
  ),
  hands: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  ),
};

const DEFAULT_ICONS = ["shield", "pin", "diamond", "hands"];

/* ───────── KEY ADVANTAGES ───────── */
function AdvantagesSection({ advantages, title, subtitle }: { advantages: any[]; title?: string; subtitle?: string }) {
  return (
    <section className="py-10 md:py-14 px-4 md:px-10">
      <SectionHeader
        title={title || "Key Advantages"}
        subtitle={subtitle || "Why homebuyers and investors trust us with their most important decisions"}
      />
      {advantages.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {advantages.map((a: any, i: number) => {
            const iconName = a.icon && ADVANTAGE_ICONS[a.icon] ? a.icon : DEFAULT_ICONS[i % DEFAULT_ICONS.length];
            return (
              <div key={a.id || i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center card-hover">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4" style={{ backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
                  {ADVANTAGE_ICONS[iconName]}
                </div>
                <h3 className="font-bold text-base text-gray-800">{a.title || "Title"}</h3>
                <p className="text-gray-500 text-sm mt-2 leading-relaxed" style={{ lineHeight: "1.6" }}>{a.description || ""}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-400 text-center">No advantages added</p>
      )}
    </section>
  );
}

export default async function Home() {
  const {
    settings,
    heroSlides,
    services,
    advantages,
    testimonials,
    featured,
    faqs,
    locationCounts,
    latest,
  } = await getHomeData();

  const isVisible = (key: string) => settings[key] !== "false";
  const siteName = (settings.site_name || "").trim() || "Realty Hub";
  const faqForSchema =
    faqs.length > 0
      ? faqs.map((f: any) => ({ id: f.id, question: f.question, answer: f.answer }))
      : [];

  let sectionOrder: string[] = DEFAULT_ORDER;
  if (settings["section_order"]) {
    try {
      const saved = JSON.parse(settings["section_order"]);
      sectionOrder = [...saved, ...DEFAULT_ORDER.filter((k) => !saved.includes(k))];
    } catch {}
  }

  const settingKeyMap: Record<string, string> = {
    hero: "section_hero_visible",
    featured: "section_featured_visible",
    new: "section_new_visible",
    services: "section_services_visible",
    advantages: "section_advantages_visible",
    testimonials: "section_testimonials_visible",
    faq: "section_faq_visible",
  };

  const areas = locationCounts.slice(0, 14).map(({ name, count }) => ({ name, count }));

  const sectionOrdered: Array<{ key: string; node: React.ReactNode }> = sectionOrder
    .filter((key) => key !== "hero")
    .map((key): { key: string; node: React.ReactNode } | null => {
      const settingKey = settingKeyMap[key];
      if (settingKey && !isVisible(settingKey)) return null;
      let node: React.ReactNode = null;
      if (key === "featured") {
        const parsedSplit = parseInt(settings["section_featured_split"] || "8", 10);
        const splitThreshold = Math.min(Math.max(Number.isFinite(parsedSplit) ? parsedSplit : 8, 2), 50);
        node = (
          <FeaturedCarousel
            featured={featured}
            splitThreshold={splitThreshold}
            title={settings["section_featured_title"]}
            subtitle={settings["section_featured_subtitle"]}
            align={settings["section_featured_align"]}
          />
        );
      } else if (key === "new") {
        node = (
          <NewPropertiesCarousel
            latest={latest}
            title={settings["section_new_title"]}
            subtitle={settings["section_new_subtitle"]}
            align={settings["section_new_align"]}
          />
        );
      } else if (key === "services") {
        node = (
          <ServicesSection
            services={services}
            title={settings["section_services_title"]}
            subtitle={settings["section_services_subtitle"]}
          />
        );
      } else if (key === "advantages") {
        node = (
          <AdvantagesSection
            advantages={advantages}
            title={settings["section_advantages_title"]}
            subtitle={settings["section_advantages_subtitle"]}
          />
        );
      } else if (key === "testimonials") {
        node = (
          <TestimonialsCarousel
            testimonials={testimonials}
            title={settings["section_testimonials_title"]}
            subtitle={settings["section_testimonials_subtitle"]}
            align={settings["section_testimonials_align"]}
          />
        );
      } else if (key === "faq") {
        node = (
          <FaqAccordion
            faqs={faqs}
            title={settings["section_faq_title"]}
            subtitle={settings["section_faq_subtitle"]}
            align={settings["section_faq_align"]}
          />
        );
      }
      return node ? { key, node } : null;
    })
    .filter((s): s is { key: string; node: React.ReactNode } => s !== null);

  return (
    <div>
      <h1 className="sr-only">
        {siteName} — Verified Properties for Sale, Resale and Rent in Nagpur
      </h1>
      {faqForSchema.length > 0 && (
        <JsonLd data={buildFaqGraph(faqForSchema, `${SITE_URL}/`)} />
      )}

      {/* Hero + Search overlay */}
      <div className="relative mt-2 md:mt-4">
        <HeroSlider heroSlides={heroSlides} animation={settings.hero_animation} />

        <div className="hidden md:block absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-full max-w-5xl z-20 px-4">
          <Suspense fallback={<div className="bg-white shadow-xl h-14 animate-pulse" style={{ borderRadius: "var(--radius-xl)" }} />}>
            <SearchBar />
          </Suspense>
        </div>
      </div>

      <div className="h-10 md:h-12" />

      {/* Location tags */}
      {(() => {
        const showHero = sectionOrder.includes("hero");
        const heroVisible = showHero && isVisible("section_hero_visible");
        if (heroVisible && areas.length > 0) {
          return (
            <div className="text-center px-4 md:px-10 py-4">
              <div className="flex flex-wrap justify-center gap-2">
                {areas.map((a) => (
                  <Link
                    key={a.name}
                    href={`/properties/${slugifyLocality(a.name)}`}
                    className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-[var(--primary)] hover:text-white transition"
                  >
                    Properties In {a.name} ({a.count})
                  </Link>
                ))}
              </div>
            </div>
          );
        }
        return null;
      })()}

      {sectionOrdered.map(({ key, node }, idx) => (
        <div key={key}>
          {idx > 0 && <div className="section-divider my-0" />}
          <div className="bg-gray-50">{node}</div>
        </div>
      ))}

      <div className="bg-gray-50">
        <DirectAnswer
          items={BUYER_FAQ}
          title="Buying Property in Nagpur — Quick Answers"
          subtitle="Short answers to the questions buyers ask us most"
        />
      </div>
    </div>
  );
}
