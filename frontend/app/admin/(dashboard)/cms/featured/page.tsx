"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import API, { backendAssetUrl, propertyHref } from "@/lib/api";
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
  const [count, setCount] = useState(20);
  const [split, setSplit] = useState(8);
  const { toast } = useToast();

  useEffect(() => {
    fetchProperties();
    API.get("/admin/settings")
      .then((res) => {
        setSettings(res.data);
        const parsed = parseInt(res.data["section_featured_count"] || "20", 10);
        setCount(Math.min(Math.max(Number.isFinite(parsed) ? parsed : 20, 1), 50));
        const parsedSplit = parseInt(res.data["section_featured_split"] || "8", 10);
        setSplit(Math.min(Math.max(Number.isFinite(parsedSplit) ? parsedSplit : 8, 2), 50));
      })
      .catch(() => {});
  }, []);

  const saveCount = async (value: number) => {
    const clamped = Math.min(Math.max(Number.isFinite(value) ? value : 20, 1), 50);
    if (clamped === count) return;
    setCount(clamped);
    try {
      await API.put("/admin/settings", { section_featured_count: String(clamped) });
      toast("Featured slot limit updated", "success");
    } catch {
      toast("Failed to update", "error");
    }
  };

  const saveSplit = async (value: number) => {
    const clamped = Math.min(Math.max(Number.isFinite(value) ? value : 8, 2), 50);
    if (clamped === split) return;
    setSplit(clamped);
    try {
      await API.put("/admin/settings", { section_featured_split: String(clamped) });
      toast("Second-row threshold updated", "success");
    } catch {
      toast("Failed to update", "error");
    }
  };

  const fetchProperties = async () => {
    try {
      const res = await API.get("/admin/properties?per_page=200");
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
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <button
          onClick={() => router.push("/admin/cms")}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg shadow-sm transition text-sm"
        >
          ← Back
        </button>

        <h1 className="text-xl font-bold text-gray-800 text-center flex-1">
          Featured Properties
        </h1>

        <div className="w-[90px]" />
      </div>
      <p className="text-sm text-gray-500 text-center -mt-1 mb-4 md:mb-6">Mark properties as featured to display them on the homepage</p>

      <SectionHeaderEditor sectionKey="featured" sectionName="Featured Properties" settings={settings} onUpdate={handleHeaderUpdate} />

      {/* SLOT LIMIT */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Featured slot limit</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Max properties shown in the featured section ({counts.featured} currently featured).
            New featured listings and payments are blocked once this many are live. Between 1 and 50.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Paid featured placement runs for {settings["featured_days"] || "30"} days (set in Settings → Listings &amp; Payments).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => saveCount(count - 1)}
            disabled={count <= 1}
            className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value || "20", 10))}
            onBlur={(e) => saveCount(parseInt(e.target.value || "20", 10))}
            className="w-16 text-center border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] outline-none"
          />
          <button
            onClick={() => saveCount(count + 1)}
            disabled={count >= 50}
            className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>
      </div>

      {/* SECOND-ROW THRESHOLD */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Second-row threshold</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Below this many featured cards the homepage shows a single carousel row. Once this many or more
            are live, a second scrolling row appears and the cards split across both rows. Between 2 and 50.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => saveSplit(split - 1)}
            disabled={split <= 2}
            className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            −
          </button>
          <input
            type="number"
            min={2}
            max={50}
            value={split}
            onChange={(e) => setSplit(parseInt(e.target.value || "8", 10))}
            onBlur={(e) => saveSplit(parseInt(e.target.value || "8", 10))}
            className="w-16 text-center border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] outline-none"
          />
          <button
            onClick={() => saveSplit(split + 1)}
            disabled={split >= 50}
            className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>
      </div>

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
                  href={propertyHref(p.id, p.title)}
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
