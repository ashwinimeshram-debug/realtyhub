"use client";

import { useEffect, useState, useMemo } from "react";
import API from "@/lib/api";
import Link from "next/link";
import { encodePropertyId } from "@/lib/api";

interface Contact {
  id: number;
  property_id: number | null;
  property_title: string | null;
  user_id: string | null;
  type: string;
  name: string;
  email: string | null;
  mobile: string | null;
  created_at: string | null;
}

type SortKey = "user_id" | "property_title" | "name" | "type" | "created_at";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<"all" | "employee" | "guest">("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const perPage = 10;

  useEffect(() => {
    API.get("/admin/contacts")
      .then((res) => setContacts(res.data.contacts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortOrder("asc"); }
  };

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return "↕";
    return sortOrder === "asc" ? "↑" : "↓";
  };

  const filtered = useMemo(() => {
    let data = [...contacts];
    if (filterType === "employee") data = data.filter((c) => c.user_id);
    else if (filterType === "guest") data = data.filter((c) => !c.user_id);
    data.sort((a: any, b: any) => {
      let va = a[sortKey] ?? "";
      let vb = b[sortKey] ?? "";
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortOrder === "asc" ? -1 : 1;
      if (va > vb) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return data;
  }, [contacts, filterType, sortKey, sortOrder]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  useEffect(() => { setPage(1); }, [filterType, sortKey, sortOrder]);

  return (
    <div className="max-w-6xl mx-auto p-3 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Property Contacts</h1>
        <p className="text-sm text-gray-500 mt-1">Property owner contact information with associated user ID</p>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600 font-medium">Type:</label>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(["all", "employee", "guest"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setFilterType(opt)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                filterType === opt
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt === "all" ? "All" : opt === "employee" ? "Employee" : "Guest"}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} contact{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No contacts found</div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th onClick={() => handleSort("user_id")} className="px-4 py-3 font-medium text-gray-600 text-center cursor-pointer hover:text-gray-800">User ID {sortArrow("user_id")}</th>
                  <th onClick={() => handleSort("property_title")} className="px-4 py-3 font-medium text-gray-600 text-center cursor-pointer hover:text-gray-800">Property {sortArrow("property_title")}</th>
                  <th onClick={() => handleSort("name")} className="px-4 py-3 font-medium text-gray-600 text-center cursor-pointer hover:text-gray-800">Contact {sortArrow("name")}</th>
                  <th onClick={() => handleSort("type")} className="px-4 py-3 font-medium text-gray-600 text-center cursor-pointer hover:text-gray-800">Type {sortArrow("type")}</th>
                  <th onClick={() => handleSort("created_at")} className="px-4 py-3 font-medium text-gray-600 text-center cursor-pointer hover:text-gray-800">Created {sortArrow("created_at")}</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((c) => {
                  const isEmpty = !c.name && !c.email && !c.mobile;
                  return (
                  <tr key={c.id} className={`border-b last:border-b-0 transition ${isEmpty ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50"}`}>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-xs px-2 py-0.5 rounded ${c.user_id ? "bg-gray-100 text-gray-600" : "bg-amber-50 text-amber-700"}`}>{c.user_id || "Guest"}</span>
                    </td>
                    <td className="px-4 py-3">
                      {c.property_id ? (
                        <Link href={`/admin/properties/${encodePropertyId(c.property_id)}`} className="text-blue-600 hover:underline font-medium">
                          {c.property_title || `#${c.property_id}`}
                        </Link>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {isEmpty ? (
                        <span className="text-xs text-red-500 font-medium">No owner details — <Link href={`/admin/properties/${encodePropertyId(c.property_id!)}`} className="underline">fill now</Link></span>
                      ) : (
                        <>
                          <div className="font-medium text-gray-800">{c.name}</div>
                          {c.email && <div className="text-xs text-gray-500">{c.email}</div>}
                          {c.mobile && <div className="text-xs text-gray-500">{c.mobile}</div>}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 capitalize">{c.type}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {c.created_at || "-"}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-1 mt-4">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="w-8 h-8 rounded text-sm font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition">‹</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} className={`w-8 h-8 rounded text-sm font-medium transition ${page === i + 1 ? "bg-[var(--primary)] text-white" : "text-gray-500 hover:bg-gray-100"}`}>{i + 1}</button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-8 h-8 rounded text-sm font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition">›</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
