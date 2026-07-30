"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import API from "@/lib/api";
import { useSearchParams, useRouter } from "next/navigation";
import PropertyCard from "@/components/PropertyCard";
import SearchBar from "@/components/SearchBar";

function PropertiesContent() {
  const [properties, setProperties] = useState<any[]>([]);
  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState("newest");
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeLocation = searchParams.get("location") || "";

  useEffect(() => {
    const query = searchParams.toString();
    API.get(`/properties?${query}`)
      .then((res) => setProperties(res.data.items || res.data))
      .catch((err) => console.error(err));
  }, [searchParams]);

  useEffect(() => {
    API.get("/properties")
      .then((res) => setAllProperties(res.data.items || res.data))
      .catch((err) => console.error("Failed to load all properties", err));
  }, []);

  const areas = useMemo(() => {
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
  }, [allProperties]);

  const handleAreaClick = (area: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("location") === area) {
      params.delete("location");
    } else {
      params.set("location", area);
    }
    router.push(`/properties?${params.toString()}`);
  };

  const sortedProperties = useMemo(() => {
    const list = [...properties];
    switch (sortBy) {
      case "price_asc":
        return list.sort((a, b) => {
          const av = a.price != null && Number(a.price) > 0 ? Number(a.price) : Infinity;
          const bv = b.price != null && Number(b.price) > 0 ? Number(b.price) : Infinity;
          return av - bv;
        });
      case "price_desc":
        return list.sort((a, b) => {
          const av = a.price != null && Number(a.price) > 0 ? Number(a.price) : 0;
          const bv = b.price != null && Number(b.price) > 0 ? Number(b.price) : 0;
          return bv - av;
        });
      case "featured":
        return list.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
      case "newest":
      default:
        return list.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    }
  }, [properties, sortBy]);

  return (
    <div className="pb-6">
      {/* Search bar — hidden on mobile (search via navbar icon) */}
      <div className="hidden md:block px-4 md:px-10 py-4">
        <SearchBar />
      </div>

      <div className="px-4 md:px-10">
        {areas.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {areas.map((a) => (
              <button
                key={a.name}
                onClick={() => handleAreaClick(a.name)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  activeLocation === a.name
                    ? "text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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

        {/* SORT ROW */}
        <div className="flex items-center justify-between mt-6 mb-4 flex-wrap gap-3">
          <p className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-700">{properties.length}</span> {properties.length === 1 ? "Property" : "Properties"}
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
            <PropertyCard key={p.id} p={p} />
          ))}
        </div>

        {properties.length === 0 && (
          <p className="text-center text-gray-400 mt-10">No properties found</p>
        )}
      </div>
    </div>
  );
}

export default function Properties() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <PropertiesContent />
    </Suspense>
  );
}
