"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import PropertyCard from "@/components/PropertyCard";
import SearchBar from "@/components/SearchBar";
import SavedSearchAlertButton from "@/components/SavedSearchAlertButton";
import { sortProperties } from "@/lib/propertySort";
import { slugifyLocality } from "@/lib/seo/nagpur-geo";

export default function PropertiesClient({
  properties,
  areas,
  activeLocation,
  listQuery,
  total,
  page,
  perPage,
  basePath = "/properties",
}: {
  properties: any[];
  areas: { name: string; count: number }[];
  activeLocation: string;
  listQuery: string;
  total: number;
  page: number;
  perPage: number;
  basePath?: string;
}) {
  const [sortBy, setSortBy] = useState("newest");

  const sortedProperties = useMemo(
    () => sortProperties(properties, sortBy),
    [properties, sortBy]
  );

  const totalPages = Math.max(1, Math.ceil((total || properties.length) / (perPage || 50)));

  // Link that drops the location filter but keeps any other filters (type,
  // budget, etc.) on the generic listing page. From a locality hub page it
  // always returns to the default /properties view.
  const clearParams = new URLSearchParams(listQuery);
  clearParams.delete("location");
  clearParams.delete("page");
  const remainingQuery = clearParams.toString();
  const clearHref =
    basePath === "/properties" && remainingQuery
      ? `/properties?${remainingQuery}`
      : "/properties";

  const pageHref = (target: number) => {
    const params = new URLSearchParams(listQuery);
    params.delete("page");
    if (sortBy && sortBy !== "newest") params.set("sort", sortBy);
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i += 1) pages.push(i);
    return pages;
  }, [page, totalPages]);

  return (
    <div className="text-gray-800">
      <div className="hidden md:block px-4 md:px-10 py-4">
        <Suspense fallback={<div className="h-14 bg-white shadow-xl rounded-lg animate-pulse" />}>
          <SearchBar />
        </Suspense>
      </div>

      <div className="px-4 md:px-10">
        <h1 className="text-2xl md:text-3xl font-bold mt-4 mb-4 text-center" style={{ color: "var(--primary)" }}>
          {activeLocation
            ? `Properties in ${activeLocation}, Nagpur`
            : "Properties for Sale, Resale and Rent in Nagpur"}
        </h1>

        {activeLocation && (
          <div className="flex justify-center mb-4">
            <Link
              href={clearHref}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-100 transition"
            >
              <span aria-hidden>✕</span> Clear location filter
            </Link>
          </div>
        )}

        {areas.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              key="__all__"
              href={clearHref}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                !activeLocation ? "text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              style={!activeLocation ? { backgroundColor: "var(--primary)" } : undefined}
            >
              All Properties
            </Link>
            {areas.map((a) => (
              <Link
                key={a.name}
                href={`/properties/${slugifyLocality(a.name)}`}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  activeLocation === a.name ? "text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                style={activeLocation === a.name ? { backgroundColor: "var(--primary)" } : undefined}
              >
                Properties In {a.name} ({a.count})
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-6 mb-4 flex-wrap gap-3">
          <p className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-700">{properties.length}</span> of{" "}
            <span className="font-semibold text-gray-700">{total || properties.length}</span>{" "}
            {total === 1 ? "Property" : "Properties"}
          </p>
          <div className="flex items-center gap-2">
            <SavedSearchAlertButton query={listQuery} />
            <span className="text-sm text-gray-500">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-200 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="featured">Featured</option>
            </select>
          </div>
        </div>

        {sortedProperties.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedProperties.map((p: any) => (
              <PropertyCard key={p.id} p={p} ctx={listQuery} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-500">No properties found.</p>
            {activeLocation && (
              <Link
                href={clearHref}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-white transition"
                style={{ backgroundColor: "var(--primary)" }}
              >
                <span aria-hidden>✕</span> Clear location filter
              </Link>
            )}
          </div>
        )}

        {totalPages > 1 && (
          <nav
            className="flex items-center justify-center gap-2 mt-8"
            aria-label="Pagination"
          >
            {page > 1 && (
              <Link
                href={paginationHref(basePath, listQuery, page - 1)}
                className="px-3 py-1.5 rounded-md border border-gray-200 text-sm hover:bg-gray-50"
              >
                Previous
              </Link>
            )}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={paginationHref(basePath, listQuery, p)}
                className={`px-3 py-1.5 rounded-md border text-sm ${
                  p === page
                    ? "text-white"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
                style={p === page ? { backgroundColor: "var(--primary)", borderColor: "var(--primary)" } : undefined}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </Link>
            ))}
            {page < totalPages && (
              <Link
                href={paginationHref(basePath, listQuery, page + 1)}
                className="px-3 py-1.5 rounded-md border border-gray-200 text-sm hover:bg-gray-50"
              >
                Next
              </Link>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}

function paginationHref(basePath: string, listQuery: string, page: number): string {
  const params = new URLSearchParams(listQuery);
  params.delete("page");
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `${basePath}${qs ? `?${qs}` : ""}`;
}
