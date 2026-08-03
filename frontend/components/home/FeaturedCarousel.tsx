"use client";

import Image from "next/image";
import { backendAssetUrl, encodePropertyId } from "@/lib/api";
import { formatPriceDisplay } from "@/lib/priceFormat";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import SectionHeader from "./SectionHeader";

export default function FeaturedCarousel({
  featured,
  title,
  subtitle,
  align,
}: {
  featured: any[];
  title?: string;
  subtitle?: string;
  align?: string;
}) {
  return (
    <section className="py-10 md:py-14 px-4 md:px-10">
      <SectionHeader
        title={title || "Featured Properties"}
        subtitle={subtitle || "Handpicked premium properties in prime locations across Nagpur"}
        align={align}
      />
      {featured.length > 0 ? (
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
                    <div className="relative aspect-[16/10] w-full overflow-hidden">
                      <Image
                        src={backendAssetUrl(p.images[0])}
                        alt={p.title || "Property"}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover object-top"
                      />
                    </div>
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
      {featured.length > 0 && (
        <div className="mt-10 text-center">
          <a href="/properties" className="btn btn-secondary btn-lg">
            View All Listings
          </a>
        </div>
      )}
    </section>
  );
}
