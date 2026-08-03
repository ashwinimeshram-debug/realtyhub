"use client";

import Image from "next/image";
import API, { backendAssetUrl } from "@/lib/api";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-fade";

export default function HeroSlider({
  heroSlides,
  animation,
}: {
  heroSlides: any[];
  animation?: string;
}) {
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

  if (heroSlides.length === 0) {
    return (
      <section className="hero-full-width">
        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
          No Hero Content
        </div>
      </section>
    );
  }

  return (
    <section className="hero-full-width">
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
        {heroSlides.map((slide: any, idx: number) => (
          <SwiperSlide key={slide.id}>
            <div className="hero-slide relative flex justify-center overflow-hidden">
              {slide.image ? (
                <Image
                  src={backendAssetUrl(slide.image)}
                  alt={slide.title || "Hero slide"}
                  fill
                  priority={idx === 0}
                  sizes="100vw"
                  className={isKenBurns ? "ken-burns object-cover" : "object-cover"}
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: slide.background_color || "#1e3a5f" }}
                />
              )}
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
    </section>
  );
}
