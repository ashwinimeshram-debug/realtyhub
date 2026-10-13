"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PropertyCard from "@/components/PropertyCard";
import SearchBar from "@/components/SearchBar";
import { sortProperties } from "@/lib/propertySort";

export default function PropertiesClient({
  properties,
  areas,
  activeLocation,
  listQuery,
}: {
  properties: any[];
  areas: { name: string; count: number }[];
  activeLocation: string;
  listQuery: string;
}) {
  const [sortBy, setSortBy] = useState("newest");
  const router = useRouter();

  const handleAreaClick = (area: string) => {
    const params = new URLSearchParams();
    if (activeLocation !== area) params.set("location", area);
    const qs = params.toString();
    router.push(`/properties${qs ? `?${qs}` : ""}`);
  };

  const sortedProperties = useMemo(
    () => sortProperties(properties, sortBy),
    [properties, sortBy]
  );

  const ctx = useMemo(() => {
    const params = new URLSearchParams(listQuery);
    if (sortBy) params.set("sort", sortBy);
    return params.toString();
  }, [listQuery, sortBy]);

  return (
    <div className="text-gray-800">
      <div className="hidden md:block px-4 md:px-10 py-4">
        <Suspense fallback={<div className="h-14 bg-white shadow-xl rounded-lg animate-pulse" />}>
          <SearchBar />
        </Suspense>
      </div>

      <div className="px-4 md:px-10">
        {areas.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {areas.map((a) => (
              <button
                key={a.name}
                onClick={() => handleAreaClick(a.name)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  activeLocation === a.name ? "text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                style={activeLocation === a.name ? { backgroundColor: "var(--primary)" } : undefined}
              >
                Properties In {a.name} ({a.count})
              </button>
            ))}
          </div>
        )}

        {activeLocation && (
          <h2 className="text-2xl font-bold mt-6 mb-2 text-center" style={{ color: "var(--primary)" }}>
            Properties In {activeLocation}
          </h2>
        )}

        <div className="flex items-center justify-between mt-6 mb-4 flex-wrap gap-3">
          <p className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-700">{properties.length}</span>{" "}
            {properties.length === 1 ? "Property" : "Properties"}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="featured">Featured First</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {sortedProperties.map((p: any) => (
            <PropertyCard key={p.id} p={p} ctx={ctx} />
          ))}
        </div>

        {properties.length === 0 && (
          <p className="text-center text-gray-400 mt-10">No properties found</p>
        )}
      </div>
    </div>
  );
}
