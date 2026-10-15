"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import API from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { getLocationCounts, getTypes } from "@/lib/lookups";
import { PRICE_OPTIONS } from "@/lib/priceOptions";

interface SearchBarProps {
  onSearch?: () => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState({
    q: "",
    location: "",
    type: "",
    category: "",
    min_price: "",
    max_price: ""
  });

  const [propertyTypes, setPropertyTypes] = useState<Array<{name: string, value: string}>>([]);
  const [transactionTypes, setTransactionTypes] = useState<Array<{name: string, value: string}>>([]);
  const [locations, setLocations] = useState<Array<{name: string, count: number}>>([]);

  useEffect(() => {
    setFilters({
      q: searchParams.get("q") || "",
      location: searchParams.get("location") || "",
      type: searchParams.get("type") || "",
      category: searchParams.get("category") || "",
      min_price: searchParams.get("min_price") || "",
      max_price: searchParams.get("max_price") || "",
    });
  }, [searchParams]);

  useEffect(() => {
    getTypes("property").then(setPropertyTypes);
    getTypes("transaction").then(setTransactionTypes);
    getLocationCounts().then(setLocations);
  }, []);

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.location) params.set("location", filters.location);
    if (filters.type) params.set("type", filters.type);
    if (filters.category) params.set("category", filters.category);
    if (filters.min_price) params.set("min_price", filters.min_price);
    if (filters.max_price) params.set("max_price", filters.max_price);
    return params.toString();
  };

  const handleSearch = () => {
    API.post("/analytics/search", {
      location: filters.location,
      property_type: filters.category,
      transaction_type: filters.type,
      min_price: filters.min_price ? Number(filters.min_price) : null,
      max_price: filters.max_price ? Number(filters.max_price) : null,
    }).catch(() => {});
    trackEvent("search", {
      search_term: filters.q || filters.location || "",
      location: filters.location || undefined,
      property_type: filters.category || undefined,
      transaction_type: filters.type || undefined,
    });
    const qs = buildQueryString();
    window.location.href = `/properties${qs ? `?${qs}` : ""}`;
    onSearch?.();
  };

  const handleClear = () => {
    setFilters({ q: "", location: "", type: "", category: "", min_price: "", max_price: "" });
    if (typeof window !== "undefined" && window.location.pathname === "/properties") {
      window.location.href = "/properties";
    }
    onSearch?.();
  };

  return (
    <div className="bg-white shadow-xl rounded-lg px-2 py-2 flex flex-col md:flex-row flex-wrap gap-2 items-stretch md:items-center justify-center border border-gray-100">
      <input
        type="text"
        className="form-input min-w-0 flex-1 md:flex-none md:w-40 !py-1.5 !px-2"
        placeholder="Search by keyword..."
        value={filters.q}
        onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
      />
      <select
        className="form-input min-w-0 flex-1 md:flex-none md:w-40 !py-1.5 !px-2"
        value={filters.location}
        onChange={(e) => setFilters({ ...filters, location: e.target.value })}
      >
        <option value="">All Locations</option>
        {locations.map((loc) => (
          <option key={loc.name} value={loc.name}>{loc.name} ({loc.count})</option>
        ))}
      </select>
      <select
        className="form-input min-w-0 flex-1 md:flex-none md:w-24 !py-1.5 !px-2"
        value={filters.type}
        onChange={(e) => setFilters({ ...filters, type: e.target.value })}
      >
        <option value="">All</option>
        {transactionTypes.map((t) => (
          <option key={t.value} value={t.value}>{t.name}</option>
        ))}
      </select>
      <select
        className="form-input min-w-0 flex-1 md:flex-none md:w-28 !py-1.5 !px-2"
        value={filters.category}
        onChange={(e) => setFilters({ ...filters, category: e.target.value })}
      >
        <option value="">Type</option>
        {propertyTypes.map((t) => (
          <option key={t.value} value={t.value}>{t.name}</option>
        ))}
      </select>
      <select
        className="form-input min-w-0 flex-1 md:flex-none md:w-20 !py-1.5 !px-2"
        value={filters.min_price}
        onChange={(e) => setFilters({ ...filters, min_price: e.target.value })}
      >
        {PRICE_OPTIONS.map((p) => (
          <option key={p.value || "min"} value={p.value}>Min {p.label}</option>
        ))}
      </select>
      <select
        className="form-input min-w-0 flex-1 md:flex-none md:w-20 !py-1.5 !px-2"
        value={filters.max_price}
        onChange={(e) => setFilters({ ...filters, max_price: e.target.value })}
      >
        {PRICE_OPTIONS.map((p) => (
          <option key={p.value || "max"} value={p.value}>Max {p.label}</option>
        ))}
      </select>
      <div className="flex gap-2 md:flex-none">
        <button
          onClick={handleSearch}
          className="btn btn-ghost btn-sm !px-3 flex-1 md:flex-none"
        >
          Search
        </button>
        <button
          onClick={handleClear}
          className="btn btn-ghost btn-sm !px-3 flex-1 md:flex-none"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
