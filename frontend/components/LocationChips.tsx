"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getLocationCounts, type LocationCount } from "@/lib/lookups";
import { useSettings } from "@/hooks/useSettings";
import { slugifyLocality } from "@/lib/seo/nagpur-geo";

export default function LocationChips() {
  const { settings } = useSettings();
  const pathname = usePathname();
  const [areas, setAreas] = useState<LocationCount[]>([]);

  const visible = settings.section_locations_visible !== "false";

  // Hooks must run unconditionally, so the data fetch is set up before any
  // early return (admin routes still skip rendering below).
  useEffect(() => {
    if (!visible) return;
    getLocationCounts().then(setAreas);
  }, [visible]);

  if (pathname.startsWith("/admin")) return null;

  if (!visible || areas.length === 0) return null;

  return (
    <div className="w-full px-4 md:px-10 py-8">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider text-center mb-4">
        Browse Properties by Location
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {(() => {
          const cols: typeof areas[] = Array.from({ length: 6 }, () => []);
          areas.forEach((a, i) => cols[i % 6].push(a));
          return cols.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-2">
              {col.map((a) => (
                <Link
                  key={a.name}
                  href={`/properties/${slugifyLocality(a.name)}`}
                  className="block w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:text-white transition truncate"
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = "var(--primary)"; (e.target as HTMLElement).style.color = "white"; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = ""; (e.target as HTMLElement).style.color = ""; }}
                >
                  Properties In {a.name} ({a.count})
                </Link>
              ))}
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
