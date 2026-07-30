"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import API from "@/lib/api";

const PRICE_OPTIONS = [
  { label: "Any", value: "" },
  { label: "1K", value: "1000" },
  { label: "5K", value: "5000" },
  { label: "10K", value: "10000" },
  { label: "25K", value: "25000" },
  { label: "50K", value: "50000" },
  { label: "1L", value: "100000" },
  { label: "2L", value: "200000" },
  { label: "5L", value: "500000" },
  { label: "10L", value: "1000000" },
  { label: "15L", value: "1500000" },
  { label: "20L", value: "2000000" },
  { label: "25L", value: "2500000" },
  { label: "30L", value: "3000000" },
  { label: "40L", value: "4000000" },
  { label: "50L", value: "5000000" },
  { label: "75L", value: "7500000" },
  { label: "1 Cr", value: "10000000" },
  { label: "1.5 Cr", value: "15000000" },
  { label: "2 Cr", value: "20000000" },
  { label: "3 Cr", value: "30000000" },
  { label: "5 Cr", value: "50000000" },
  { label: "7.5 Cr", value: "75000000" },
  { label: "10 Cr", value: "100000000" },
  { label: "15 Cr", value: "150000000" },
  { label: "20 Cr", value: "200000000" },
  { label: "50 Cr", value: "500000000" },
  { label: "100 Cr", value: "1000000000" },
];

interface SearchBarProps {
  onSearch?: () => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState({
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
      location: searchParams.get("location") || "",
      type: searchParams.get("type") || "",
      category: searchParams.get("category") || "",
      min_price: searchParams.get("min_price") || "",
      max_price: searchParams.get("max_price") || "",
    });
  }, [searchParams]);

  useEffect(() => {
    API.get("/types?category=property").then((r) => setPropertyTypes(r.data)).catch(() => {});
    API.get("/types?category=transaction").then((r) => setTransactionTypes(r.data)).catch(() => {});
    API.get("/location-counts").then((r) => setLocations(r.data)).catch(() => {});
  }, []);

  const buildQueryString = () => {
    const params = new URLSearchParams();
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
    const qs = buildQueryString();
    window.location.href = `/properties${qs ? `?${qs}` : ""}`;
    onSearch?.();
  };

  const handleClear = () => {
    setFilters({ location: "", type: "", category: "", min_price: "", max_price: "" });
    if (typeof window !== "undefined" && window.location.pathname === "/properties") {
      window.location.href = "/properties";
    }
    onSearch?.();
  };

  return (
    <div className="bg-white shadow-xl rounded-lg px-2 py-2 flex flex-col md:flex-row flex-wrap gap-2 items-stretch md:items-center justify-center border border-gray-100">
      <select
        className="form-input min-w-0 flex-1 md:flex-none md:w-44 !py-1.5 !px-2"
        value={filters.location}
        onChange={(e) => setFilters({ ...filters, location: e.target.value })}
      >
        <option value="">All Locations</option>
        {locations.map((loc) => (
          <option key={loc.name} value={loc.name}>{loc.name} ({loc.count})</option>
        ))}
      </select>
      <select
        className="form-input min-w-0 flex-1 md:flex-none md:w-28 !py-1.5 !px-2"
        value={filters.type}
        onChange={(e) => setFilters({ ...filters, type: e.target.value })}
      >
        <option value="">All</option>
        {transactionTypes.map((t) => (
          <option key={t.value} value={t.value}>{t.name}</option>
        ))}
      </select>
      <select
        className="form-input min-w-0 flex-1 md:flex-none md:w-36 !py-1.5 !px-2"
        value={filters.category}
        onChange={(e) => setFilters({ ...filters, category: e.target.value })}
      >
        <option value="">Type</option>
        {propertyTypes.map((t) => (
          <option key={t.value} value={t.value}>{t.name}</option>
        ))}
      </select>
      <select
        className="form-input min-w-0 flex-1 md:flex-none md:w-24 !py-1.5 !px-2"
        value={filters.min_price}
        onChange={(e) => setFilters({ ...filters, min_price: e.target.value })}
      >
        {PRICE_OPTIONS.map((p) => (
          <option key={p.value || "min"} value={p.value}>Min {p.label}</option>
        ))}
      </select>
      <select
        className="form-input min-w-0 flex-1 md:flex-none md:w-24 !py-1.5 !px-2"
        value={filters.max_price}
        onChange={(e) => setFilters({ ...filters, max_price: e.target.value })}
      >
        {PRICE_OPTIONS.map((p) => (
          <option key={p.value || "max"} value={p.value}>Max {p.label}</option>
        ))}
      </select>
      <button
        onClick={handleSearch}
        className="btn btn-ghost btn-sm !px-3 min-w-0 flex-1 md:flex-none"
      >
        Search
      </button>
      <button
        onClick={handleClear}
        className="btn btn-ghost btn-sm !px-3 min-w-0 flex-1 md:flex-none"
      >
        Clear
      </button>
    </div>
  );
}
