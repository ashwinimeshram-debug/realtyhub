"use client";

import { useCallback, useEffect, useState } from "react";
import API from "@/lib/api";
import { useToast } from "@/components/Toast";

interface SavedSearch {
  id: number;
  owner_id: number | null;
  owner_name: string | null;
  is_guest: boolean;
  email: string | null;
  phone: string | null;
  name: string | null;
  params: Record<string, string>;
  notify: boolean;
  is_active: boolean;
  last_notified_at: string | null;
  created_at: string | null;
}

interface Summary {
  all: number;
  guest: number;
  registered: number;
  active: number;
}

const PARAM_LABELS: Record<string, string> = {
  q: "Keyword",
  location: "Area",
  type: "Type",
  category: "Category",
  min_price: "Min budget",
  max_price: "Max budget",
  featured: "Featured",
  near: "Near",
  radius_km: "Radius (km)",
  timeline: "Timeline",
};

function paramChips(params: Record<string, string>) {
  const entries = Object.entries(params || {});
  if (entries.length === 0) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-[11px]"
        >
          <span className="text-gray-400">{PARAM_LABELS[k] || k}:</span>
          <span className="font-medium">{v}</span>
        </span>
      ))}
    </div>
  );
}

export default function AdminSavedSearchesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<SavedSearch[]>([]);
  const [summary, setSummary] = useState<Summary>({ all: 0, guest: 0, registered: 0, active: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [type, setType] = useState("all");
  const [active, setActive] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const perPage = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/admin/saved-searches", {
        params: {
          page,
          per_page: perPage,
          type: type || undefined,
          is_active: active || undefined,
          search: query || undefined,
        },
      });
      setRows(res.data.items || []);
      setTotal(res.data.total || 0);
      if (res.data.summary) setSummary(res.data.summary);
    } catch (err: any) {
      if (err?.response?.status !== 403) {
        toast(err?.response?.data?.error || "Failed to load saved searches", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [page, type, active, query, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [type, active, query]);

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(search.trim());
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const cards: { label: string; value: number }[] = [
    { label: "All subscriptions", value: summary.all },
    { label: "Guest (no account)", value: summary.guest },
    { label: "Registered users", value: summary.registered },
    { label: "Active alerts", value: summary.active },
  ];

  return (
    <div className="max-w-6xl mx-auto p-3 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Search Alerts</h1>
        <p className="text-sm text-gray-500 mt-1">
          People who opted in to property alerts from search — including guests who have not created an account.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form onSubmit={onSubmitSearch} className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, phone or name"
            className="border rounded-lg px-3 py-2 text-sm w-64"
          />
          <button type="submit" className="btn btn-sm btn-primary">Search</button>
        </form>
        <select className="border rounded-lg px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All types</option>
          <option value="guest">Guests only</option>
          <option value="registered">Registered only</option>
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={active} onChange={(e) => setActive(e.target.value)}>
          <option value="">Any status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <button onClick={load} className="btn btn-sm btn-ghost">Refresh</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Alert filters</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last notified</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No saved searches found.</td></tr>
              )}
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800">{s.name || s.owner_name || "Unnamed"}</span>
                    <span className="block text-xs text-gray-500">{s.email || "—"}</span>
                    <span className="block text-xs text-gray-500">{s.phone || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {s.is_guest ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Guest</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Registered</span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-xs">{paramChips(s.params)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                    <span className={`block mt-1 text-xs ${s.notify ? "text-gray-500" : "text-gray-400"}`}>
                      {s.notify ? "Alerts on" : "Alerts off"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {s.last_notified_at ? new Date(s.last_notified_at).toLocaleString("en-IN") : "Never"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {s.created_at ? new Date(s.created_at).toLocaleString("en-IN") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>Page {page} of {totalPages} · {total} total</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn btn-sm btn-ghost">Previous</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn btn-sm btn-ghost">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
