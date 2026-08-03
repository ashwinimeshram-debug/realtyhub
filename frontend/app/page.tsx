"use client";

import { Suspense, useEffect, useState } from "react";
import API, { backendAssetUrl, encodePropertyId } from "@/lib/api";
import { formatPriceDisplay } from "@/lib/priceFormat";
import DOMPurify from "dompurify";
import SearchBar from "@/components/SearchBar";
import SectionContent from "@/components/SectionContent";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-fade";
import "swiper/css/pagination";

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className || ""}`} />
  );
}

/* ───────── HERO ───────── */
function HeroSection({ heroSlides, loading, animation }: any) {
  const isKenBurns = animation === "kenburns";

  const hAlign = (v?: string) =>
    v === "left" ? "items-start text-left" : v === "right" ? "items-end text-right" : "items-center text-center";

  const vAlign = (v?: string) =>
    v === "top" ? "justify-start pt-16 md:pt-24" : v === "bottom" ? "justify-end pb-16 md:pb-24" : "justify-center";

  const buildFontStyle = (cssStyle?: string): React.CSSProperties => {
    if (!cssStyle || cssStyle === "normal") return {};
    const s: React.CSSProperties = {};
    if (cssStyle.includes("bold")) s.fontWeight = 700;
    if (cssStyle.includes("italic")) s.fontStyle = "italic";
    return s;
  };

  const renderMultiline = (text: string) =>
    text.split("\n").map((line, i, arr) => (
      <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
    ));

  return (
    <section className="hero-full-width">
      {loading ? (
        <div className="w-full h-full bg-gray-200 animate-pulse" />
      ) : heroSlides.length > 0 ? (
        <Swiper
          key={heroSlides.length}
          modules={[Autoplay, EffectFade]}
          effect={isKenBurns ? "fade" : undefined}
          fadeEffect={isKenBurns ? { crossFade: true } : undefined}
          loop={heroSlides.length > 1}
          autoplay={{ delay: isKenBurns ? 6000 : 3000, disableOnInteraction: false }}
          speed={isKenBurns ? 1500 : undefined}
          className="w-full h-full"
        >
          {heroSlides.map((slide: any) => (
            <SwiperSlide key={slide.id}>
              <div className="hero-slide relative flex justify-center overflow-hidden">
                <div
                  className={`absolute inset-0 bg-cover bg-center ${isKenBurns ? "ken-burns" : ""}`}
                  style={{
                    backgroundImage: slide.image
                      ? `url(${backendAssetUrl(slide.image)})`
                      : "none",
                    backgroundColor: !slide.image ? (slide.background_color || "#1e3a5f") : undefined,
                  }}
                />
                <div className="absolute inset-0 bg-black/40" />
                {(slide.title || slide.subtitle || slide.button_text) && (
                  <div className={`relative z-10 p-3 md:p-6 rounded text-white max-w-[90%] md:max-w-none w-full flex flex-col gap-0 h-full overflow-hidden ${vAlign(slide.content_vertical)}`}>
                    {slide.title && (
                      <h2
                        className={`text-lg md:text-4xl font-bold leading-tight flex flex-col ${hAlign(slide.title_align)}`}
                        style={{
                          color: slide.title_color || undefined,
                          fontFamily: slide.title_font_family || undefined,
                          fontSize: slide.title_font_size ? `${slide.title_font_size}px` : undefined,
                          lineHeight: slide.title_line_height ? `${slide.title_line_height}px` : undefined,
                          ...buildFontStyle(slide.title_font_style),
                        }}
                      >
                        {renderMultiline(slide.title)}
                      </h2>
                    )}
                    {slide.subtitle && (
                      <p
                        className={`mt-0.5 md:mt-2 text-xs md:text-base flex flex-col ${hAlign(slide.subtitle_align)}`}
                        style={{
                          color: slide.subtitle_color || undefined,
                          fontFamily: slide.subtitle_font_family || undefined,
                          fontSize: slide.subtitle_font_size ? `${slide.subtitle_font_size}px` : undefined,
                          lineHeight: slide.subtitle_line_height ? `${slide.subtitle_line_height}px` : undefined,
                          ...buildFontStyle(slide.subtitle_font_style),
                        }}
                      >
                        {renderMultiline(slide.subtitle)}
                      </p>
                    )}
                    {slide.button_text && (
                      <div className={`flex flex-col mt-2 md:mt-4 ${hAlign(slide.button_align)}`}>
                        <a
                          href={slide.button_link || "/"}
                          className="inline-block"
                          onClick={() => {
                            API.post("/analytics/banner-click", {
                              slide_id: slide.id,
                              slide_title: slide.title,
                              button_link: slide.button_link,
                              page_url: window.location.pathname,
                            }).catch(() => {});
                          }}
                        >
                          <button
                            className="btn btn-primary btn-sm"
                            style={{
                              color: slide.button_color || undefined,
                              fontFamily: slide.button_font_family || undefined,
                              fontSize: slide.button_font_size ? `${slide.button_font_size}px` : undefined,
                              ...buildFontStyle(slide.button_font_style),
                            }}
                          >
                            {slide.button_text}
                          </button>
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      ) : (
        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
          No Hero Content
        </div>
      )}
    </section>
  );
}

/* ───────── SHARED SECTION HEADER ───────── */
function SectionHeader({ title, subtitle, align }: { title: string; subtitle?: string; align?: string }) {
  const sanitized = typeof DOMPurify?.sanitize === "function"
    ? DOMPurify.sanitize(title, { ALLOWED_TAGS: ["b", "i", "br", "span"], ALLOWED_ATTR: [] })
    : title;
  return (
    <div className="text-center mb-8">
      <h2
        className="text-2xl md:text-3xl font-bold"
        style={{ color: "var(--primary)" }}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
      {subtitle && (
        <p className="mt-2 text-sm md:text-base max-w-2xl mx-auto" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ───────── FEATURED PROPERTIES ───────── */
function FeaturedSection({ featured, loading, title, subtitle, align }: any) {
  return (
    <section className="py-10 md:py-14 px-4 md:px-10">
      <SectionHeader
        title={title || "Featured Properties"}
        subtitle={subtitle || "Handpicked premium properties in prime locations across Nagpur"}
      />
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <Skeleton className="aspect-[16/10] w-full rounded-none" />
              <div className="p-6 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : featured.length > 0 ? (
        <Swiper
          modules={[Autoplay, Pagination]}
          spaceBetween={24}
          slidesPerView={1}
          breakpoints={{
            640: { slidesPerView: 2 },
            768: { slidesPerView: 3 },
            1024: { slidesPerView: 4 },
          }}
          autoplay={{ delay: 4000, disableOnInteraction: false }}
          pagination={{ clickable: true }}
          loop={featured.length > 4}
          className="featured-swiper pb-12"
        >
          {featured.map((p: any) => (
            <SwiperSlide key={p.id}>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden card-hover">
                <div className="relative">
                  {p.images && p.images.length > 0 ? (
                    <img src={backendAssetUrl(p.images[0])} className="w-full aspect-[16/10] object-cover object-top" alt={p.title} />
                  ) : (
                    <div className="w-full aspect-[16/10] bg-gray-200 flex items-center justify-center text-gray-400 text-sm">No Image</div>
                  )}
                  {p.is_featured && (
                    <span className="absolute top-2 left-2 bg-yellow-400 text-xs px-2 py-1 rounded font-medium">Featured</span>
                  )}
                </div>
                <div className="p-6">
                  <h3 className="font-semibold text-lg text-gray-800">{p.title || "No Title"}</h3>
                  <p className="font-bold mt-1 text-base" style={{ color: "var(--primary)" }}>
                    {formatPriceDisplay(p.price, p.price_text)}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">{p.location || ""}</p>
                  <a href={`/property/${encodePropertyId(p.id)}`} className="mt-3 inline-block text-sm font-medium" style={{ color: "var(--primary)" }}>
                    View Details →
                  </a>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      ) : (
        <p className="text-gray-400 text-center">No featured properties yet</p>
      )}
      {!loading && featured.length > 0 && (
        <div className="mt-10 text-center">
          <a href="/properties" className="btn btn-secondary btn-lg">
            View All Listings
          </a>
        </div>
      )}
    </section>
  );
}

/* ───────── SERVICES ───────── */
function ServicesSection({ services, loading, title, subtitle, align }: any) {
  return (
    <section className="py-10 md:py-14 px-4 md:px-10">
      <SectionHeader
        title={title || "Our Comprehensive Services"}
        subtitle={subtitle || "End-to-end real estate solutions tailored to your needs"}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <Skeleton className="aspect-[16/10] w-full rounded-none" />
              <div className="p-6 space-y-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))
        ) :           services.length > 0 ? (
          services.map((s: any) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden card-hover flex flex-col">
              {s.image ? (
                <img src={backendAssetUrl(s.image)} className="w-full aspect-[16/10] object-cover" alt={s.title} />
              ) : (
                <div className="w-full aspect-[16/10] bg-gray-200 flex items-center justify-center text-gray-400 text-sm">No Image</div>
              )}
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="font-bold text-lg" style={{ color: "var(--primary)" }}>{s.title || "No Title"}</h3>
                <p className="text-gray-600 mt-2 text-sm leading-relaxed flex-1" style={{ lineHeight: "1.6" }}>{s.description || ""}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-400 text-center col-span-full">No services added</p>
        )}
      </div>
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
function AdvantagesSection({ advantages, loading, title, subtitle, align }: any) {
  return (
    <section className="py-10 md:py-14 px-4 md:px-10">
      <SectionHeader
        title={title || "Key Advantages"}
        subtitle={subtitle || "Why homebuyers and investors trust us with their most important decisions"}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
              <Skeleton className="w-12 h-12 rounded-full mx-auto" />
              <Skeleton className="h-5 w-3/4 mx-auto mt-4" />
              <Skeleton className="h-4 w-full mt-3" />
            </div>
          ))
        ) :           advantages.length > 0 ? (
          advantages.map((a: any, i: number) => {
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
          })
        ) : (
          <p className="text-gray-400 text-center col-span-full">No advantages added</p>
        )}
      </div>
    </section>
  );
}

/* ───────── TESTIMONIALS ───────── */
function TestimonialsSection({ testimonials, loading, title, subtitle, align }: any) {
  return (
    <section className="py-10 md:py-14 px-4 md:px-10">
      <SectionHeader
        title={title || "What Our Customers Say"}
        subtitle={subtitle || "Real experiences from clients who found their dream homes with us"}
      />
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 animate-pulse">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-4 w-24 mt-4" />
              <Skeleton className="h-4 w-full mt-3" />
              <Skeleton className="h-4 w-3/4 mt-2" />
              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100">
                <Skeleton className="w-11 h-11 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : testimonials.length > 0 ? (
        <Swiper
          modules={[Autoplay, Pagination]}
          spaceBetween={24}
          slidesPerView={1}
          breakpoints={{
            640: { slidesPerView: 2 },
            768: { slidesPerView: 3 },
          }}
          autoplay={{ delay: 4000, disableOnInteraction: false }}
          pagination={{ clickable: true }}
          loop={testimonials.length > 3}
          className="testimonials-swiper pb-12"
        >
          {testimonials.map((t: any) => (
            <SwiperSlide key={t.id}>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 card-hover flex flex-col h-full">
                <svg className="w-8 h-8 text-blue-200 mb-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
                {t.rating > 0 && (
                  <p className="text-yellow-400 text-sm mb-2">
                    {"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}
                  </p>
                )}
                <p className="text-gray-600 text-sm flex-1 mb-4" style={{ lineHeight: "1.6" }}>{t.description}</p>
                <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
                  {t.image ? (
                    <img src={backendAssetUrl(t.image)} alt={t.name} className="w-11 h-11 rounded-full object-cover border-2 border-blue-100" />
                  ) : (
                    <div className="w-11 h-11 rounded-full text-white flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: "var(--primary)" }}>
                      {t.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{t.name}</p>
                    {t.role && <p className="text-xs" style={{ color: "var(--primary)" }}>{t.role}</p>}
                    {t.location && <p className="text-xs text-gray-400">{t.location}</p>}
                  </div>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      ) : (
        <p className="text-gray-400 text-center">No testimonials yet</p>
      )}
    </section>
  );
}

/* ───────── FAQ ───────── */
function FaqSection({ faqs, loading, title, subtitle, align }: any) {
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <section className="py-10 md:py-14 px-4 md:px-10">
      <SectionHeader
        title={title || "Frequently Asked Questions"}
        subtitle={subtitle || "Find answers to common questions about our services and processes"}
      />
      {loading ? (
        <div className="space-y-3 max-w-3xl mx-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-5 w-3/4 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : faqs.length > 0 ? (
        <div className="space-y-3 max-w-3xl mx-auto">
          {faqs.map((f: any) => (
            <div key={f.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setOpenId(openId === f.id ? null : f.id)}
                className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-gray-50 transition-colors duration-200"
              >
                <span className="font-semibold text-gray-800 text-sm md:text-base">{f.question}</span>
                <svg
                  className={`w-5 h-5 shrink-0 text-gray-400 transition-transform duration-300 ${openId === f.id ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div
                className="overflow-hidden transition-all duration-300"
                style={{ maxHeight: openId === f.id ? "500px" : "0px", opacity: openId === f.id ? 1 : 0 }}
              >
                <div className="px-5 pb-5 text-sm text-gray-600 border-t border-gray-100 pt-3" style={{ lineHeight: "1.6" }}>
                  <SectionContent content={f.answer} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-center">No FAQs yet</p>
      )}
    </section>
  );
}

/* ───────── SECTION MAP ───────── */
const SECTION_COMPONENTS: Record<string, React.FC<any>> = {
  hero: HeroSection,
  services: ServicesSection,
  advantages: AdvantagesSection,
  testimonials: TestimonialsSection,
  featured: FeaturedSection,
  faq: FaqSection,
};

const DEFAULT_ORDER = ["hero", "featured", "services", "advantages", "testimonials", "faq"];

export default function Home() {
  const [featured, setFeatured] = useState<any[]>([]);
  const [heroSlides, setHeroSlides] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [advantages, setAdvantages] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [allProperties, setAllProperties] = useState<any[]>([]);

  useEffect(() => {
    let completed = 0;
    const total = 8;
    const done = () => { completed += 1; if (completed >= total) setLoading(false); };
    Promise.allSettled([
      API.get("/properties?featured=true").then((res) => setFeatured(res.data.items || res.data)).finally(done),
      API.get("/hero").then((res) => setHeroSlides(res.data)).finally(done),
      API.get("/services").then((res) => setServices(res.data)).finally(done),
      API.get("/advantages").then((res) => setAdvantages(res.data)).finally(done),
      API.get("/testimonials").then((res) => setTestimonials(res.data)).finally(done),
      API.get("/faq").then((res) => setFaqs(res.data)).finally(done),
      API.get("/settings").then((res) => setSettings(res.data)).finally(done),
      API.get("/properties").then((res) => setAllProperties(res.data.items || res.data)).finally(done),
    ]);
  }, []);

  const isVisible = (key: string) => settings[key] !== "false";

  let sectionOrder: string[] = DEFAULT_ORDER;
  if (settings["section_order"]) {
    try {
      const saved = JSON.parse(settings["section_order"]);
      sectionOrder = [...saved, ...DEFAULT_ORDER.filter((k) => !saved.includes(k))];
    } catch {}
  }

  const dataMap: Record<string, any> = {
    hero: { heroSlides, loading },
    featured: { featured, loading, title: settings["section_featured_title"], subtitle: settings["section_featured_subtitle"], align: settings["section_featured_align"] },
    services: { services, loading, title: settings["section_services_title"], subtitle: settings["section_services_subtitle"], align: settings["section_services_align"] },
    advantages: { advantages, loading, title: settings["section_advantages_title"], subtitle: settings["section_advantages_subtitle"], align: settings["section_advantages_align"] },
    testimonials: { testimonials, loading, title: settings["section_testimonials_title"], subtitle: settings["section_testimonials_subtitle"], align: settings["section_testimonials_align"] },
    faq: { faqs, loading, title: settings["section_faq_title"], subtitle: settings["section_faq_subtitle"], align: settings["section_faq_align"] },
  };

  const settingKeyMap: Record<string, string> = {
    hero: "section_hero_visible",
    featured: "section_featured_visible",
    services: "section_services_visible",
    advantages: "section_advantages_visible",
    testimonials: "section_testimonials_visible",
    faq: "section_faq_visible",
  };

  const areas = (() => {
    const map: Record<string, number> = {};
    allProperties.forEach((p: any) => {
      if (p.location) {
        map[p.location] = (map[p.location] || 0) + 1;
      }
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([name, count]) => ({ name, count }));
  })();

  return (
    <div>
      {/* Hero + Search overlay */}
      <div className="relative mt-2 md:mt-4">
        <HeroSection heroSlides={heroSlides} loading={loading} animation={settings.hero_animation} />

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
                  <a
                    key={a.name}
                    href={`/properties?location=${encodeURIComponent(a.name)}`}
                    className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:text-white transition"
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = "var(--primary)"; (e.target as HTMLElement).style.color = "white"; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = ""; (e.target as HTMLElement).style.color = ""; }}
                  >
                    Properties In {a.name} ({a.count})
                  </a>
                ))}
              </div>
            </div>
          );
        }
        return null;
      })()}

      {(() => {
        const nonHeroSections = sectionOrder.filter((key) => key !== "hero");
        return nonHeroSections.map((key, idx) => {
          const Component = SECTION_COMPONENTS[key];
          if (!Component) return null;
          const settingKey = settingKeyMap[key];
          if (settingKey && !isVisible(settingKey)) return null;

          return (
            <div key={key}>
              {idx > 0 && <div className="section-divider my-0" />}
              <div className="bg-gray-50">
                <Component {...(dataMap[key] || {})} />
              </div>
            </div>
          );
        });
      })()}
    </div>
  );
}
