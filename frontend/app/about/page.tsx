"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import API, { backendAssetUrl } from "@/lib/api";
import SectionContent from "@/components/SectionContent";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade, EffectCube, EffectFlip } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-fade";
import "swiper/css/effect-cube";
import "swiper/css/effect-flip";

interface Section {
  id: string;
  label: string;
  content: string;
  type?: "section" | "description";
}

interface TeamMember {
  id: number;
  name: string;
  role: string;
  bio: string;
  email: string;
  social_links: Record<string, string>;
  photo_url: string;
  is_leader: boolean;
  sort_order: number;
}

export default function AboutPage() {
  const [rawSections, setRawSections] = useState<Section[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [layout, setLayout] = useState<"carousel" | "grid">("carousel");
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [gridCarouselIndex, setGridCarouselIndex] = useState(0);
  const [siteName, setSiteName] = useState("Nagpur Realty Hub");
  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [galleryTransition, setGalleryTransition] = useState("fade");
  const carouselRef = useRef<HTMLDivElement>(null);
  const gridCarouselRef = useRef<HTMLDivElement>(null);

  const replaceName = (secs: Section[]) =>
    secs.map((s) => ({ ...s, content: s.content.replace(/__SITE_NAME__/g, siteName) }));

  const sections = useMemo(() => replaceName(rawSections), [rawSections, siteName]);

  useEffect(() => {
    API.get("/settings")
      .then((res) => {
        if (res.data.site_name) setSiteName(res.data.site_name);
        if (res.data.about_gallery_transition) setGalleryTransition(res.data.about_gallery_transition);
      })
      .catch(() => {});

    API.get("/pages/about/sections")
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) setRawSections(res.data);
      })
      .catch(() => {});

    API.get("/team")
      .then((res) => setMembers(res.data))
      .catch(() => {});

    API.get("/pages/about/team-layout")
      .then((res) => setLayout(res.data.layout))
      .catch(() => {});

    API.get("/about-gallery")
      .then((res) => setGalleryImages(res.data))
      .catch(() => {});
  }, []);

  const leaders = members.filter((m) => m.is_leader);
  const carouselMembers = leaders.length > 0 ? members.filter((m) => !m.is_leader) : members;

  const scrollCarousel = (dir: -1 | 1, ref?: React.RefObject<HTMLDivElement | null>) => {
    const el = ref?.current || carouselRef.current;
    if (!el) return;
    const cardWidth = el.children[0]
      ? (el.children[0] as HTMLElement).offsetWidth + 24
      : 300;
    el.scrollBy({ left: dir * cardWidth, behavior: "smooth" });
  };

  const scrollToIndex = (index: number, ref: React.RefObject<HTMLDivElement | null>, setIndex: (v: number) => void) => {
    if (!ref.current) return;
    const cardWidth = ref.current.children[0]
      ? (ref.current.children[0] as HTMLElement).offsetWidth + 24
      : 300;
    ref.current.scrollTo({ left: index * cardWidth, behavior: "smooth" });
    setIndex(index);
  };

  const handleScroll = () => {
    if (!carouselRef.current) return;
    const scrollLeft = carouselRef.current.scrollLeft;
    const cardWidth = carouselRef.current.children[0]
      ? (carouselRef.current.children[0] as HTMLElement).offsetWidth + 24
      : 300;
    setCarouselIndex(Math.round(scrollLeft / cardWidth));
  };

  const handleGridScroll = () => {
    if (!gridCarouselRef.current) return;
    const scrollLeft = gridCarouselRef.current.scrollLeft;
    const cardWidth = gridCarouselRef.current.children[0]
      ? (gridCarouselRef.current.children[0] as HTMLElement).offsetWidth + 24
      : 300;
    setGridCarouselIndex(Math.round(scrollLeft / cardWidth));
  };

  useEffect(() => {
    if (carouselMembers.length <= 1) return;
    const interval = setInterval(() => {
      if (!carouselRef.current) return;
      const el = carouselRef.current;
      const cardWidth = el.children[0]
        ? (el.children[0] as HTMLElement).offsetWidth + 24
        : 300;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScroll - 10) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: cardWidth, behavior: "smooth" });
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [carouselMembers.length]);

  useEffect(() => {
    if (layout !== "grid" || members.length <= 4) return;
    const interval = setInterval(() => {
      if (!gridCarouselRef.current) return;
      const el = gridCarouselRef.current;
      const cardWidth = el.children[0]
        ? (el.children[0] as HTMLElement).offsetWidth + 24
        : 300;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScroll - 10) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: cardWidth, behavior: "smooth" });
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [layout, members.length]);

  const socialIcon = (platform: string) => {
    const icons: Record<string, React.ReactNode> = {
      linkedin: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
      twitter: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      instagram: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      ),
    };
    return icons[platform] || null;
  };

  const findSection = (label: string) =>
    sections.find((s) => s.label.toLowerCase() === label.toLowerCase());

  const heroWelcome = findSection("Welcome");
  const heroAbout = findSection("About Us");
  const mission = findSection("Our Mission");
  const vision = findSection("Our Vision");
  const whyChoose = findSection("Why Choose Us");
  const services = findSection("Our Services");

  const whyItems = whyChoose
    ? whyChoose.content.split("\n").filter((l) => l.trim())
    : [];
  const serviceItems = services
    ? services.content.split("\n").filter((l) => l.trim())
    : [];

  const WHY_ICONS = [
    <svg key="0" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
    <svg key="1" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>,
    <svg key="2" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H5.228A2 2 0 015 17.119V5a2 2 0 012-2h6m2.25 3.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>,
    <svg key="3" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>,
    <svg key="4" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  ];

  return (
    <div className="text-gray-800">

      {/* ═══════════ PAGE HEADER ═══════════ */}
      <header style={{ background: "linear-gradient(135deg, #f0f4fa 0%, #ffffff 100%)", padding: "48px 0", borderBottom: "1px solid #e2e8f0", textAlign: "center" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px" }}>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--text-dark)", marginBottom: 8 }}>About Us</h1>
          <p style={{ fontSize: "0.95rem", color: "var(--text-muted)", fontWeight: 500 }}>Trusted real estate platform for Nagpur</p>
        </div>
      </header>

      {/* ═══════════ HERO SECTION ═══════════ */}
      {(heroWelcome || heroAbout) && (
        <section className="px-4 md:px-8 lg:px-16 pt-10 md:pt-16 pb-12 md:pb-16 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* LEFT — Text */}
            <div>
              <span
                className="inline-block text-xs font-semibold tracking-widest uppercase mb-4 px-3 py-1 rounded-full"
                style={{ backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}
              >
                Welcome to {siteName}
              </span>
              {heroWelcome && (
                <SectionContent content={heroWelcome.content} className="text-gray-600 text-base md:text-lg leading-relaxed mb-5" />
              )}
              {heroAbout && (
                <SectionContent content={heroAbout.content} className="text-gray-500 text-base md:text-lg leading-relaxed mb-8" />
              )}
              <a
                href="/properties"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-white font-semibold text-sm shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all duration-300"
                style={{ backgroundColor: "var(--primary)" }}
              >
                Explore Properties
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
            </div>

            {/* RIGHT — Gallery Swiper */}
            <div className="hidden lg:block">
              {galleryImages.length > 0 ? (
                <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                  <Swiper
                    modules={[Autoplay, EffectFade, EffectCube, EffectFlip]}
                    effect={galleryTransition === "cube" || galleryTransition === "flip" ? galleryTransition : galleryTransition === "slide" ? "slide" : "fade"}
                    autoplay={{ delay: 3500, disableOnInteraction: false }}
                    loop={galleryImages.length > 1}
                    speed={800}
                    className="w-full aspect-[4/3] rounded-2xl"
                  >
                    {galleryImages.map((img: any) => (
                      <SwiperSlide key={img.id}>
                        <img
                          src={backendAssetUrl(img.image_url)}
                          alt={img.caption || "Gallery"}
                          className="w-full h-full object-cover"
                        />
                        {img.caption && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-10">
                            <p className="text-white text-sm font-medium">{img.caption}</p>
                          </div>
                        )}
                      </SwiperSlide>
                    ))}
                  </Swiper>
                  <div
                    className="absolute -bottom-4 -left-4 w-24 h-24 rounded-2xl shadow-lg -z-10"
                    style={{ backgroundColor: "color-mix(in srgb, var(--primary) 15%, transparent)" }}
                  />
                  <div
                    className="absolute -top-4 -right-4 w-16 h-16 rounded-xl shadow-md -z-10"
                    style={{ backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)" }}
                  />
                </div>
              ) : (
                <div
                  className="w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl"
                  style={{ backgroundColor: "color-mix(in srgb, var(--primary) 6%, #f1f5f9)" }}
                >
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8">
                    <div className="grid grid-cols-3 gap-3 w-full max-w-[220px]">
                      {[...Array(6)].map((_, i) => (
                        <div
                          key={i}
                          className="aspect-square rounded-xl shadow-sm"
                          style={{
                            backgroundColor: i % 2 === 0
                              ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                              : "color-mix(in srgb, var(--primary) 6%, transparent)",
                          }}
                        />
                      ))}
                    </div>
                    <div className="text-center mt-2">
                      <p className="text-sm font-semibold" style={{ color: "var(--primary)" }}>Nagpur&apos;s Trusted Platform</p>
                      <p className="text-xs text-gray-400 mt-1">Buy · Sell · Rent</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ MISSION + VISION ═══════════ */}
      {(mission || vision) && (
        <section className="px-4 md:px-8 lg:px-16 py-10 md:py-14">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {mission && (
              <div className="group bg-white border border-gray-100 rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm2.78 7.97l-4.15 1.66a.75.75 0 00-.39.39l-1.66 4.15a.375.375 0 00.48.48l4.15-1.66a.75.75 0 00.39-.39l1.66-4.15a.375.375 0 00-.48-.48z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-3" style={{ color: "var(--text-dark)" }}>{mission.label}</h3>
                <SectionContent content={mission.content} className="text-gray-500 text-sm leading-relaxed" />
              </div>
            )}
            {vision && (
              <div className="group bg-white border border-gray-100 rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-3" style={{ color: "var(--text-dark)" }}>{vision.label}</h3>
                <SectionContent content={vision.content} className="text-gray-500 text-sm leading-relaxed" />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══════════ WHY CHOOSE US ═══════════ */}
      {whyChoose && whyItems.length > 0 && (
        <section className="px-4 md:px-8 lg:px-16 py-10 md:py-14 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--text-dark)" }}>{whyChoose.label}</h2>
              <div className="w-12 h-1 rounded-full mx-auto mt-3" style={{ backgroundColor: "var(--primary)" }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {whyItems.map((item, i) => (
                <div
                  key={i}
                  className="group bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex items-start gap-4"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300"
                    style={{ backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}
                  >
                    {WHY_ICONS[i % WHY_ICONS.length]}
                  </div>
                  <p className="text-sm font-medium pt-2.5" style={{ color: "var(--text-body)" }}>{item.trim()}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ OUR SERVICES ═══════════ */}
      {services && serviceItems.length > 0 && (
        <section className="px-4 md:px-8 lg:px-16 py-10 md:py-14">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--text-dark)" }}>{services.label}</h2>
              <div className="w-12 h-1 rounded-full mx-auto mt-3" style={{ backgroundColor: "var(--primary)" }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 max-w-4xl mx-auto">
              {serviceItems.map((item, i) => (
                <div
                  key={i}
                  className="group flex items-center gap-4 bg-white border border-gray-100 rounded-2xl px-6 py-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: "var(--primary)" }} />
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "var(--text-dark)" }}>{item.trim()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ UNMATCHED CMS SECTIONS ═══════════ */}
      {sections
        .filter((s) => !["welcome", "about us", "our mission", "our vision", "why choose us", "our services"].includes(s.label.toLowerCase()))
        .map((section, idx) => (
          <div key={section.id} className="px-4 md:px-8 lg:px-16 py-10">
            <div className="max-w-6xl mx-auto">
              {section.type === "description" ? (
                <SectionContent content={section.content} className="text-gray-600 text-sm leading-relaxed" />
              ) : (
                <>
                  <h2 className="text-xl font-bold mb-3" style={{ color: "var(--text-dark)" }}>{section.label}</h2>
                  <SectionContent content={section.content} className="text-gray-600 text-sm leading-relaxed" />
                </>
              )}
            </div>
          </div>
        ))}

      {/* TEAM SECTION */}
      {members.length > 0 && (
        <div className="mt-10 pt-8 border-t border-gray-200">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Our Team</h2>
          <p className="text-center text-sm text-gray-500 mb-10">Meet the people behind {siteName}</p>

          {layout === "carousel" ? (
            <>
              {/* LEADER CARDS — centered flex grid */}
              {leaders.length > 0 && (
                <div className="flex flex-wrap justify-center gap-6 mb-10">
                  {leaders.map((member) => (
                    <div
                      key={member.id}
                      className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition text-center cursor-pointer border border-gray-50 w-[240px]"
                      onClick={() => setSelectedMember(member)}
                    >
                      <div className="w-24 h-24 rounded-full overflow-hidden mx-auto mb-4 bg-gray-100 ring-4 ring-[var(--primary)]/10">
                        {member.photo_url ? (
                          <img src={backendAssetUrl(member.photo_url)} alt={member.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-400">
                            {member.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <h3 className="font-bold text-sm text-[var(--text-dark)]">{member.name}</h3>
                      <p className="text-xs text-[var(--primary)] font-medium">{member.role}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* TEAM MEMBERS — centered flex grid, carousel when > 4 */}
              {carouselMembers.length > 0 && (
                carouselMembers.length > 4 ? (
                  <div className="relative">
                    <div className="flex justify-center mb-3">
                      <span className="bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
                        {carouselIndex + 1} / {carouselMembers.length}
                      </span>
                    </div>
                    <button
                      onClick={() => scrollCarousel(-1)}
                      className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-9 h-9 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:bg-white transition border border-gray-100"
                    >
                      <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                    <div
                      ref={carouselRef}
                      onScroll={handleScroll}
                      className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide"
                      style={{ scrollbarWidth: "none" }}
                    >
                      {carouselMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex-shrink-0 w-[280px] snap-start bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition text-center border border-gray-50 cursor-pointer"
                          onClick={() => setSelectedMember(member)}
                        >
                          <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-3 bg-gray-100">
                            {member.photo_url ? (
                              <img src={backendAssetUrl(member.photo_url)} alt={member.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-400">
                                {member.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <h3 className="font-bold text-sm text-[var(--text-dark)]">{member.name}</h3>
                          <p className="text-xs text-[var(--primary)]">{member.role}</p>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => scrollCarousel(1)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-9 h-9 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:bg-white transition border border-gray-100"
                    >
                      <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                    {/* Pagination dots */}
                    <div className="flex justify-center gap-1.5 mt-3">
                      {carouselMembers.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => scrollToIndex(i, carouselRef, setCarouselIndex)}
                          className={`w-2 h-2 rounded-full transition ${
                            carouselIndex === i
                              ? "bg-[var(--primary)] w-4"
                              : "bg-gray-300 hover:bg-gray-400"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-center gap-6">
                    {carouselMembers.map((member) => (
                      <div
                        key={member.id}
                        className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition text-center border border-gray-50 w-[240px] cursor-pointer"
                        onClick={() => setSelectedMember(member)}
                      >
                        <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-3 bg-gray-100">
                          {member.photo_url ? (
                            <img src={backendAssetUrl(member.photo_url)} alt={member.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-400">
                              {member.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <h3 className="font-bold text-sm text-[var(--text-dark)]">{member.name}</h3>
                        <p className="text-xs text-[var(--primary)]">{member.role}</p>
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          ) : (
            /* GRID LAYOUT */
            members.length > 4 ? (
              <div className="relative">
                <div className="flex justify-center mb-3">
                  <span className="bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
                    {gridCarouselIndex + 1} / {members.length}
                  </span>
                </div>
                <button
                  onClick={() => scrollCarousel(-1, gridCarouselRef)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-9 h-9 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:bg-white transition border border-gray-100"
                >
                  <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <div
                  ref={gridCarouselRef}
                  onScroll={handleGridScroll}
                  className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide"
                  style={{ scrollbarWidth: "none" }}
                >
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex-shrink-0 w-[200px] snap-start bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer border border-gray-50 group text-center"
                      onClick={() => setSelectedMember(member)}
                    >
                      <div className="aspect-square bg-gray-100 overflow-hidden">
                        {member.photo_url ? (
                          <img
                            src={backendAssetUrl(member.photo_url)}
                            alt={member.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-300">
                            {member.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="p-3 text-center">
                        <h3 className="font-bold text-sm text-[var(--text-dark)] truncate">{member.name}</h3>
                        <p className="text-xs text-[var(--primary)] truncate">{member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => scrollCarousel(1, gridCarouselRef)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-9 h-9 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:bg-white transition border border-gray-100"
                >
                  <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
                {/* Pagination dots */}
                <div className="flex justify-center gap-1.5 mt-3">
                  {members.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => scrollToIndex(i, gridCarouselRef, setGridCarouselIndex)}
                      className={`w-2 h-2 rounded-full transition ${
                        gridCarouselIndex === i
                          ? "bg-[var(--primary)] w-4"
                          : "bg-gray-300 hover:bg-gray-400"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-5">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer border border-gray-50 group w-[200px]"
                    onClick={() => setSelectedMember(member)}
                  >
                    <div className="aspect-square bg-gray-100 overflow-hidden">
                      {member.photo_url ? (
                        <img
                          src={backendAssetUrl(member.photo_url)}
                          alt={member.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-300">
                          {member.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="p-3 text-center">
                      <h3 className="font-bold text-sm text-[var(--text-dark)] truncate">{member.name}</h3>
                      <p className="text-xs text-[var(--primary)] truncate">{member.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* MEMBER MODAL */}
      {selectedMember && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-8 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedMember(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 transition"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-28 h-28 rounded-full overflow-hidden mb-4 bg-gray-100 ring-4 ring-[var(--primary)]/10">
                {selectedMember.photo_url ? (
                  <img src={backendAssetUrl(selectedMember.photo_url)} alt={selectedMember.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-400">
                    {selectedMember.name.charAt(0)}
                  </div>
                )}
              </div>
              <h3 className="text-xl font-bold text-[var(--text-dark)]">{selectedMember.name}</h3>
              <p className="text-sm text-[var(--primary)] font-medium mb-3">{selectedMember.role}</p>
              {selectedMember.bio && (
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{selectedMember.bio}</p>
              )}
              {selectedMember.email && (
                <a href={`mailto:${selectedMember.email}`} className="text-sm text-gray-500 hover:text-[var(--primary)] transition mb-4">
                  {selectedMember.email}
                </a>
              )}
              {Object.keys(selectedMember.social_links).length > 0 && (
                <div className="flex items-center gap-3">
                  {Object.entries(selectedMember.social_links).map(([platform, url]) =>
                    url ? (
                      <a
                        key={platform}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-[var(--primary)] hover:text-white transition"
                      >
                        {socialIcon(platform)}
                      </a>
                    ) : null
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
