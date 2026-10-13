"use client";

import { useState } from "react";
import Image from "next/image";
import { backendAssetUrl } from "@/lib/api";

export default function ImageSlider({
  images,
  small = false,
}: {
  images: string[];
  small?: boolean;
}) {
  const [index, setIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div
        className={`bg-gray-200 flex items-center justify-center rounded-xl ${
          small ? "h-[180px]" : "h-[400px]"
        }`}
      >
        No Image
      </div>
    );
  }

  const heightClass = small ? "h-[180px]" : "h-[400px] md:h-[500px]";

  return (
    <div className="w-full">

      {/* MAIN IMAGE */}
      <div className={`relative overflow-hidden rounded-xl bg-gray-50 ${heightClass}`}>
        <Image
          key={images[index]}
          src={backendAssetUrl(images[index])}
          alt="Property"
          fill
          sizes={
            small
              ? "(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              : "100vw"
          }
          className={small ? "object-cover object-top" : "object-contain"}
        />

        {/* PHOTO COUNT BADGE */}
        {images.length > 1 && (
          <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
            {index + 1} / {images.length}
          </div>
        )}

        {/* GLASSMORPHIC PILL BUTTONS */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:bg-white transition z-10"
            >
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={() => setIndex((prev) => (prev + 1) % images.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:bg-white transition z-10"
            >
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* THUMBNAILS (ONLY FOR LARGE VIEW) */}
      {!small && (
        <div className="flex gap-2 mt-3 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`relative h-20 w-28 shrink-0 overflow-hidden rounded border ${
                index === i ? "border-blue-500" : "border-gray-200"
              }`}
              aria-label={`View image ${i + 1}`}
            >
              <Image
                src={backendAssetUrl(img)}
                alt="Property thumbnail"
                fill
                sizes="112px"
                className="object-cover object-top"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
