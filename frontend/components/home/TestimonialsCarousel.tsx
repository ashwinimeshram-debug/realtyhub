"use client";

import Image from "next/image";
import { backendAssetUrl } from "@/lib/api";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import SectionHeader from "./SectionHeader";

export default function TestimonialsCarousel({
  testimonials,
  title,
  subtitle,
  align,
}: {
  testimonials: any[];
  title?: string;
  subtitle?: string;
  align?: string;
}) {
  return (
    <section className="py-10 md:py-14 px-4 md:px-10">
      <SectionHeader
        title={title || "What Our Customers Say"}
        subtitle={subtitle || "Real experiences from clients who found their dream homes with us"}
        align={align}
      />
      {testimonials.length > 0 ? (
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
                    <Image
                      src={backendAssetUrl(t.image)}
                      alt={t.name}
                      width={44}
                      height={44}
                      className="w-11 h-11 rounded-full object-cover border-2 border-blue-100"
                    />
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
