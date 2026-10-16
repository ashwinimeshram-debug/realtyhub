"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import API, { encodePropertyId, propertyHref } from "@/lib/api";
import { SITE_URL } from "@/lib/assets";
import { useToast } from "@/components/Toast";
import ShareButtons from "@/components/ShareButtons";

export default function PropertiesListPage() {
  const { toast } = useToast();
  const [properties, setProperties] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortKey, setSortKey] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 15;

  const fetchProperties = useCallback(async () => {
    try {
      const res = await API.get("/admin/properties?per_page=200");
      setProperties(res.data.items || res.data || []);
    } catch {
      setError("Failed to load properties");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggleVisibility = async (id: number) => {
    try {
      const res = await API.post(`/admin/toggle-visibility/${id}`);
      toast(res.data.message || "Visibility updated", "success");
      await fetchProperties();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to toggle visibility", "error");
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    let data = [...properties];
    if (search.trim()) {
      data = data.filter((p: any) => p.title?.toLowerCase().includes(search.toLowerCase()));
    }
    if (filter !== "all") {
      data = data.filter((p: any) =>
        filter === "closed" ? p.is_closed === true :
        filter === "approved" ? p.status === "approved" && !p.is_closed :
        p.status === filter
      );
    }
    data.sort((a: any, b: any) => {
      let va = a[sortKey] ?? "";
      let vb = b[sortKey] ?? "";
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortOrder === "asc" ? -1 : 1;
      if (va > vb) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    setFiltered(data);
    setPage(1);
  }, [properties, search, filter, sortKey, sortOrder]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortOrder("asc"); }
  };

  const sortArrow = (key: string) => {
    if (sortKey !== key) return "↕";
    return sortOrder === "asc" ? "↑" : "↓";
  };

  const counts = {
    all: properties.length,
    approved: properties.filter((p: any) => p.status === "approved" && !p.is_closed).length,
    pending: properties.filter((p: any) => p.status === "pending").length,
    rejected: properties.filter((p: any) => p.status === "rejected").length,
    closed: properties.filter((p: any) => p.is_closed === true).length,
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

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="text-[var(--primary)] underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
          <p className="text-sm text-gray-500 mt-1">Manage all property listings</p>
        </div>
        <Link
          href="/admin/add-property"
          className="inline-flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add New Property
        </Link>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2">
        {(["all", "approved", "pending", "rejected", "closed"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === key
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
            }`}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
            <span className="ml-1.5 text-xs opacity-70">({counts[key]})</span>
          </button>
        ))}
      </div>

      {/* Search + Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <input
            type="text"
            placeholder="Search by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-full sm:max-w-xs"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th onClick={() => handleSort("id")} className="p-3 text-gray-500 font-medium cursor-pointer hover:text-gray-700 text-center"># {sortArrow("id")}</th>
                <th onClick={() => handleSort("title")} className="p-3 text-gray-500 font-medium cursor-pointer hover:text-gray-700 text-center">Title {sortArrow("title")}</th>
                <th onClick={() => handleSort("status")} className="p-3 text-gray-500 font-medium cursor-pointer hover:text-gray-700 text-center">Status {sortArrow("status")}</th>
                <th onClick={() => handleSort("owner_name")} className="p-3 text-gray-500 font-medium cursor-pointer hover:text-gray-700 text-center hidden md:table-cell">Owners {sortArrow("owner_name")}</th>
                <th onClick={() => handleSort("created_at")} className="p-3 text-gray-500 font-medium cursor-pointer hover:text-gray-700 text-center hidden lg:table-cell">Created {sortArrow("created_at")}</th>
                <th className="p-3 text-gray-500 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                if (filtered.length === 0) return <tr><td colSpan={6} className="p-6 text-center text-gray-400">No properties found</td></tr>;
                const start = (page - 1) * perPage;
                const pageData = filtered.slice(start, start + perPage);
                const groups: Record<string, any[]> = {};
                pageData.forEach((p: any) => {
                  const key = p.uploader_user_id || "Guest";
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(p);
                });
                const rows: React.ReactNode[] = [];
                let idx = 0;
                const sortedEntries = Object.entries(groups).sort(([a], [b]) => {
                  if (a === "Guest") return 1;
                  if (b === "Guest") return -1;
                  return a.localeCompare(b, undefined, { numeric: true });
                });
                for (const [key, props] of sortedEntries) {
                  const display = key === "Guest" ? "Guest" : (props[0]?.uploader_name || key);
                  rows.push(
                    <tr key={`g-${key}`} className="bg-gray-100 border-t border-b border-gray-200">
                      <td colSpan={6} className="p-2 px-3">
                        <span className="font-semibold text-sm text-gray-700">{display}</span>
                        <span className="ml-2 text-xs text-gray-500">({props.length} properties)</span>
                      </td>
                    </tr>
                  );
                  for (const property of props) {
                    idx++;
                    rows.push(
                      <tr key={property.id} className="border-t border-gray-50 hover:bg-gray-50 transition">
                        <td className="p-3 text-gray-400">{idx}</td>
                        <td className="p-3">
                          <Link href={`/admin/properties/${encodePropertyId(property.id)}`} className="text-[var(--primary)] hover:underline font-medium">
                            {property.title}
                          </Link>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            property.is_closed ? "bg-gray-100 text-gray-600" :
                            property.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                            property.status === "rejected" ? "bg-red-100 text-red-700" :
                            "bg-amber-100 text-amber-700"
                          }`}>
                            {property.is_closed ? "Closed" : property.status === "approved" ? "Approved" : property.status === "rejected" ? "Rejected" : "Pending"}
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {property.featured_until && new Date(property.featured_until) > new Date() && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-100 text-yellow-700">★ Featured</span>
                            )}
                            {property.payment_status === "unpaid" && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700">Unpaid</span>
                            )}
                            {property.expires_at && property.status === "approved" && !property.is_closed && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                new Date(property.expires_at) < new Date() ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"
                              }`}>
                                {new Date(property.expires_at) < new Date() ? "Expired" : `Exp ${new Date(property.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-gray-600 hidden md:table-cell text-xs">
                          {property.owner_name || "-"}
                        </td>
                        <td className="p-3 text-gray-400 hidden lg:table-cell">
                          {property.created_at ? new Date(property.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <ShareButtons
                              mode="trigger"
                              url={`${SITE_URL}${propertyHref(property.id, property.title)}`}
                              title={property.title}
                            />
                            {property.status === "approved" && !property.is_closed && (
                              <button
                                onClick={() => handleToggleVisibility(property.id)}
                                className={`inline-flex items-center gap-1 text-xs font-medium transition px-2 py-1 rounded ${
                                  property.is_active
                                    ? "text-gray-500 hover:text-red-600 hover:bg-red-50"
                                    : "text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                }`}
                                title={property.is_active ? "Hide from public listing" : "Show on public listing"}
                              >
                                {property.is_active ? "Hide" : "Show"}
                              </button>
                            )}
                            <Link href={propertyHref(property.id, property.title)} target="_blank" className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-emerald-600 transition" title="View property">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View
                            </Link>
                            <Link href={`/admin/properties/${encodePropertyId(property.id)}`} className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-[var(--primary)] transition" title="Edit property">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                }
                return rows;
              })()}
            </tbody>
          </table>
        </div>
        {filtered.length > perPage && (
          <div className="flex justify-center items-center gap-1 p-4 border-t border-gray-100">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="w-8 h-8 rounded text-sm font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition">‹</button>
            {Array.from({ length: Math.ceil(filtered.length / perPage) }, (_, i) => (
              <button key={i} onClick={() => setPage(i + 1)} className={`w-8 h-8 rounded text-sm font-medium transition ${page === i + 1 ? "bg-[var(--primary)] text-white" : "text-gray-500 hover:bg-gray-100"}`}>{i + 1}</button>
            ))}
            <button onClick={() => setPage((p) => Math.min(Math.ceil(filtered.length / perPage), p + 1))} disabled={page === Math.ceil(filtered.length / perPage)} className="w-8 h-8 rounded text-sm font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition">›</button>
          </div>
        )}
      </div>
    </div>
  );
}
