"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import API, { backendAssetUrl, propertyHref } from "@/lib/api";
import { formatPriceDisplay } from "@/lib/priceFormat";
import SectionHeaderEditor from "@/components/admin/SectionHeaderEditor";
import { useToast } from "@/components/Toast";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isNew(createdAt?: string | null) {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  return !isNaN(t) && Date.now() - t < WEEK_MS;
}

export default function NewPropertiesAdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(10);

  const loadItems = useCallback(
    async (n: number) => {
      try {
        const res = await API.get("/properties", { params: { per_page: n } });
        setItems(res.data.items || []);
      } catch {
        toast("Failed to load properties", "error");
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    API.get("/settings")
      .then((res) => {
        const data = res.data || {};
        setSettings(data);
        const parsed = parseInt(data["section_new_count"] || "10", 10);
        const n = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 10, 1), 20);
        setCount(n);
        loadItems(n);
      })
      .catch(() => loadItems(10));
  }, [loadItems]);

  const handleHeaderUpdate = async (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    try {
      await API.put("/admin/settings", { [key]: value });
    } catch {}
  };

  const saveCount = async (value: number) => {
    const clamped = Math.min(Math.max(Number.isFinite(value) ? value : 10, 1), 20);
    if (clamped === count) return;
    setCount(clamped);
    try {
      await API.put("/admin/settings", { section_new_count: String(clamped) });
      toast("Number of properties updated", "success");
      loadItems(clamped);
    } catch {
      toast("Failed to update", "error");
    }
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
          New Properties
        </h1>

        <div className="w-[90px]" />
      </div>
      <p className="text-sm text-gray-500 text-center -mt-1 mb-4 md:mb-6">
        Automatically shows the latest posted properties on the homepage. Marked &quot;New&quot; when posted within 7 days.
      </p>

      <SectionHeaderEditor
        sectionKey="new"
        sectionName="New Properties"
        settings={settings}
        onUpdate={handleHeaderUpdate}
      />

      {/* COUNT CONTROL */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Number of properties to display</h3>
          <p className="text-xs text-gray-400 mt-0.5">Between 1 and 20 (most recent first)</p>
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
            max={20}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value || "10", 10))}
            onBlur={(e) => saveCount(parseInt(e.target.value || "10", 10))}
            className="w-16 text-center border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] outline-none"
          />
          <button
            onClick={() => saveCount(count + 1)}
            disabled={count >= 20}
            className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Preview — latest {items.length} properties
        </h3>
        {items.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No properties posted yet</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col"
              >
                <div className="relative aspect-[4/3] bg-gray-100">
                  {p.images && p.images.length > 0 ? (
                    <img
                      src={backendAssetUrl(p.images[0])}
                      alt={p.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h4m-6-4h.01M6 20h.01" />
                      </svg>
                    </div>
                  )}
                  {isNew(p.created_at) && (
                    <span className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded font-medium">
                      New
                    </span>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-semibold text-gray-800 text-sm">{p.title || "No Title"}</h3>
                  <p className="text-sm font-bold text-[var(--primary)] mt-1">
                    {formatPriceDisplay(p.price, p.price_text)}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">{p.location || ""}</p>
                  <a
                    href={propertyHref(p.id, p.title)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-xs text-gray-400 hover:text-[var(--primary)] transition"
                  >
                    View public page ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
