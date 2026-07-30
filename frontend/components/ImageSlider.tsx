"use client";

import { useState } from "react";
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

  return (
    <div className="w-full">

      {/* MAIN IMAGE */}
      <div className="relative overflow-hidden rounded-xl">
        <img
          src={backendAssetUrl(images[index])}
          alt="Property"
          className={`w-full object-cover object-top ${
            small ? "h-[180px]" : "h-[400px] md:h-[500px]"
          }`}
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
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={() => setIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:bg-white transition z-10"
            >
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* THUMBNAILS (ONLY FOR LARGE VIEW) */}
      {!small && (
        <div className="flex gap-2 mt-3 overflow-x-auto">
          {images.map((img, i) => (
            <img
              key={i}
              src={backendAssetUrl(img)}
              alt="Property thumbnail"
              onClick={() => setIndex(i)}
              className={`h-20 w-28 object-cover object-top rounded cursor-pointer border ${
                index === i ? "border-blue-500" : "border-gray-200"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
