"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import { useToast } from "@/components/Toast";

interface Owner {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  is_verified: boolean;
  is_active: boolean;
  property_count: number;
  last_login: string | null;
  created_at: string | null;
}

export default function OwnersPage() {
  const { toast } = useToast();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const timer = setTimeout(() => {
      API.get("/admin/owners", { params: search ? { search } : {} })
        .then((r) => { if (!cancel) setOwners(r.data.owners || []); })
        .catch(() => { if (!cancel) toast("Failed to load registered users", "error"); })
        .finally(() => { if (!cancel) setLoading(false); });
    }, 300);
    return () => { cancel = true; clearTimeout(timer); };
  }, [search]);

  const toggleActive = async (o: Owner) => {
    const next = !o.is_active;
    setOwners((prev) => prev.map((x) => (x.id === o.id ? { ...x, is_active: next } : x)));
    try {
      await API.put(`/admin/owners/${o.id}`, { is_active: next });
      toast(
        next ? "Account activated" : "Account deactivated - their listings are now hidden",
        "success"
      );
    } catch (err: any) {
      setOwners((prev) => prev.map((x) => (x.id === o.id ? { ...x, is_active: o.is_active } : x)));
      toast(err?.response?.data?.error || "Failed to update", "error");
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Registered Users</h1>
          <p className="text-sm text-gray-500 mt-1">
            Public accounts created via website registration. Disabling an account blocks login
            and hides their listings from the public site; data is retained.
          </p>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or phone..."
          className="w-full sm:w-72 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : owners.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No registered users found</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 font-medium text-gray-600 text-left">User</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-center">Phone</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-center">Email Status</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-center">Listings</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-center">Registered</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-center">Last Login</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {owners.map((o) => (
                <tr key={o.id} className="border-b last:border-b-0 hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{o.name}</div>
                    <div className="text-xs text-gray-500">{o.email}</div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap">{o.mobile || "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${o.is_verified ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {o.is_verified ? "Verified" : "Unverified"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{o.property_count}</td>
                  <td className="px-4 py-3 text-center text-gray-500 text-xs whitespace-nowrap">
                    {o.created_at ? new Date(o.created_at).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500 text-xs whitespace-nowrap">
                    {o.last_login ? new Date(o.last_login).toLocaleString() : "Never"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(o)}
                      title={o.is_active ? "Click to deactivate (soft delete)" : "Click to activate"}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition ${o.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-200 text-gray-600 hover:bg-gray-300"}`}
                    >
                      {o.is_active ? "Active" : "Disabled"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
