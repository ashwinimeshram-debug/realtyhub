import ImageSlider from "./ImageSlider";
import { propertyHref } from "@/lib/api";
import { formatPriceDisplay } from "@/lib/priceFormat";

export default function PropertyCard({ p, ctx }: { p: any; ctx?: string }) {
  const href = propertyHref(p.id, p.title, ctx);
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition flex flex-col">

      {/* IMAGE */}
      <div className="h-[180px]">
        <ImageSlider images={p.images} alt={`${p.title} in ${p.location}`} small />
      </div>

      {/* CONTENT */}
      <div className="p-4 flex flex-col flex-grow">

        {/* TITLE */}
        <h3 className="font-semibold text-md line-clamp-1 min-h-[24px]">
          {p.title}
        </h3>

        {/* PRICE */}
        <p className="font-bold mt-1 min-h-[24px]" style={{ color: "var(--primary)" }}>
          {formatPriceDisplay(p.price, p.price_text)}
        </p>

        {/* LOCATION */}
        <p className="text-gray-500 text-sm min-h-[20px]">
          📍 {p.location}
        </p>

        {/* VIEW DETAILS */}
        <a
          href={href}
          className="mt-2 inline-block text-sm" style={{ color: "var(--primary)" }}
        >
          View Details →
        </a>

      </div>
    </div>
  );
}
