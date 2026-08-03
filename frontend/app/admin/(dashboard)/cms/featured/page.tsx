"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import API, { backendAssetUrl, encodePropertyId } from "@/lib/api";
import { formatPriceDisplay } from "@/lib/priceFormat";
import SectionHeaderEditor from "@/components/admin/SectionHeaderEditor";
import { useToast } from "@/components/Toast";

type Filter = "all" | "featured" | "not_featured";

export default function FeaturedPropertiesPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchProperties();
    API.get("/settings").then((res) => setSettings(res.data)).catch(() => {});
  }, []);

  const fetchProperties = async () => {
    try {
      const res = await API.get("/admin/properties");
      const approved = (res.data.items || []).filter((p: any) => p.status === "approved");
      approved.sort((a: any, b: any) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
      setProperties(approved);
    } catch {
      toast("Failed to load properties", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleHeaderUpdate = async (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    try { await API.put("/admin/settings", { [key]: value }); } catch {}
  };

  const handleToggle = async (id: number) => {
    try {
      const res = await API.post(`/admin/feature/${id}`);
      setProperties((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_featured: res.data.is_featured } : p))
      );
      toast(res.data.is_featured ? "Added to featured" : "Removed from featured", "success");
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to toggle", "error");
    }
  };

  const filtered = properties.filter((p) => {
    if (filter === "featured" && !p.is_featured) return false;
    if (filter === "not_featured" && p.is_featured) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return p.title?.toLowerCase().includes(q) || p.location?.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    all: properties.length,
    featured: properties.filter((p) => p.is_featured).length,
    not_featured: properties.filter((p) => !p.is_featured).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading properties...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-center md:justify-between relative">
        <button
          onClick={() => router.push("/admin/cms")}
          className="absolute left-0 flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg shadow-sm transition text-sm"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-gray-800 pl-16 md:pl-0">Featured Properties</h1>
        <div className="hidden md:block w-[90px]" />
      </div>
      <p className="text-sm text-gray-500 text-center -mt-1">Mark properties as featured to display them on the homepage</p>

      <SectionHeaderEditor sectionKey="featured" sectionName="Featured Properties" settings={settings} onUpdate={handleHeaderUpdate} />

      {/* FILTERS */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-2">
          {(["all", "featured", "not_featured"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filter === key
                  ? "bg-[var(--primary)] text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
              }`}
            >
              {key === "all" ? "All" : key === "featured" ? "Featured" : "Not Featured"}
              <span className="ml-1.5 text-xs opacity-70">({counts[key]})</span>
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search title or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm flex-1 sm:max-w-xs"
        />
      </div>

      {/* PROPERTY GRID */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">No properties found</p>
          <p className="text-sm mt-1">Try a different filter or search term</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition"
            >
              {/* IMAGE */}
              <div className="relative aspect-[4/3] bg-gray-100">
                {p.first_image ? (
                  <img
                    src={backendAssetUrl(p.first_image)}
                    alt={p.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                {p.is_featured && (
                  <span className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    ★ FEATURED
                  </span>
                )}
              </div>

              {/* INFO */}
              <div className="flex-1 p-3 flex flex-col gap-1.5">
                <h3 className="font-semibold text-sm text-gray-800 truncate" title={p.title}>
                  {p.title}
                </h3>
                {p.location && (
                  <p className="text-xs text-gray-500 truncate">📍 {p.location}</p>
                )}
                <p className="text-sm font-bold text-[var(--primary)]">
                  {formatPriceDisplay(p.price, p.price_text)}
                </p>
              </div>

              {/* ACTIONS */}
              <div className="px-3 pb-3 flex items-center justify-between border-t border-gray-50 pt-2.5">
                <a
                  href={`/property/${encodePropertyId(p.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-400 hover:text-[var(--primary)] transition"
                  title="View public page"
                >
                  View ↗
                </a>
                <button
                  onClick={() => handleToggle(p.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    p.is_featured
                      ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {p.is_featured ? "★ Unfeature" : "☆ Feature"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
