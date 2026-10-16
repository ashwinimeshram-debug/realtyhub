"use client";

import { useCallback, useEffect, useState } from "react";
import API from "@/lib/api";
import { useToast } from "@/components/Toast";

interface Txn {
  id: number;
  property_id: number;
  property_title: string | null;
  listing_id: string | null;
  owner_id: number | null;
  purpose: string;
  transaction_type: string | null;
  amount: number | null;
  currency: string;
  duration_days: number;
  provider: string;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  status: string;
  method: string;
  created_at: string | null;
  paid_at: string | null;
}

const STATUS_CLS: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
};

const PURPOSE_LABEL: Record<string, string> = {
  listing: "Listing",
  featured: "Featured",
};

export default function AdminPaymentsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Txn[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const perPage = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/admin/payments/transactions", {
        params: { page, per_page: perPage, status: status || undefined, purpose: purpose || undefined },
      });
      setRows(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to load transactions", "error");
    } finally {
      setLoading(false);
    }
  }, [page, status, purpose, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status, purpose]);

  const markPaid = async (t: Txn) => {
    setBusy(t.id);
    try {
      await API.post(`/admin/payments/transactions/${t.id}/mark-paid`, { method: "manual" });
      toast("Marked as paid", "success");
      load();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to update", "error");
    } finally {
      setBusy(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="max-w-6xl mx-auto p-3 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Payments &amp; Transactions</h1>
        <p className="text-sm text-gray-500 mt-1">Listing publication, renewal and featured listing payments.</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600 font-medium">Filters:</label>
        <select className="form-input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="form-input !w-auto" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
          <option value="">All purposes</option>
          <option value="listing">Listing</option>
          <option value="featured">Featured</option>
        </select>
        <button onClick={load} className="btn btn-sm btn-ghost">Refresh</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Property</th>
                <th className="px-4 py-3 font-medium">Purpose</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No transactions found.</td></tr>
              )}
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">#{t.id}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800">{t.property_title || "—"}</span>
                    <span className="block text-xs text-gray-400">{t.listing_id || `#${t.property_id}`}</span>
                  </td>
                  <td className="px-4 py-3">{PURPOSE_LABEL[t.purpose] || t.purpose}</td>
                  <td className="px-4 py-3 font-medium">
                    ₹{Number(t.amount || 0).toLocaleString("en-IN")}
                    <span className="block text-xs text-gray-400">{t.currency}</span>
                  </td>
                  <td className="px-4 py-3">
                    {t.provider}
                    <span className="block text-xs text-gray-400">{t.method}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[t.status] || "bg-gray-100 text-gray-500"}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {t.created_at ? new Date(t.created_at).toLocaleString("en-IN") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.status === "pending" ? (
                      <button
                        onClick={() => markPaid(t)}
                        disabled={busy === t.id}
                        className="btn btn-sm btn-primary"
                      >
                        {busy === t.id ? "…" : "Mark Paid"}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
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
