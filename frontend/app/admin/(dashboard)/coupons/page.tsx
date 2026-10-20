"use client";

import { useCallback, useEffect, useState } from "react";
import API from "@/lib/api";
import { useToast } from "@/components/Toast";

interface Coupon {
  id: number;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  value: number;
  max_discount: number | null;
  min_amount: number;
  applies_to: string;
  valid_from: string | null;
  valid_until: string | null;
  usage_limit: number | null;
  per_user_limit: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string | null;
}

interface FormState {
  code: string;
  description: string;
  discount_type: "percent" | "fixed";
  value: string;
  max_discount: string;
  min_amount: string;
  applies_to: string;
  valid_from: string;
  valid_until: string;
  usage_limit: string;
  per_user_limit: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  code: "",
  description: "",
  discount_type: "percent",
  value: "",
  max_discount: "",
  min_amount: "",
  applies_to: "all",
  valid_from: "",
  valid_until: "",
  usage_limit: "",
  per_user_limit: "",
  is_active: true,
};

const APPLIES_LABEL: Record<string, string> = {
  all: "Any purchase",
  listing: "Listing only",
  featured: "Featured only",
  combo: "Listing + Featured bundle",
};

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export default function AdminCouponsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/admin/coupons");
      setRows(res.data.items || []);
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to load coupons", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (c: Coupon) => {
    setEditingId(c.id);
    setForm({
      code: c.code,
      description: c.description || "",
      discount_type: c.discount_type,
      value: String(c.value),
      max_discount: c.max_discount != null ? String(c.max_discount) : "",
      min_amount: c.min_amount ? String(c.min_amount) : "",
      applies_to: c.applies_to,
      valid_from: toDateInput(c.valid_from),
      valid_until: toDateInput(c.valid_until),
      usage_limit: c.usage_limit != null ? String(c.usage_limit) : "",
      per_user_limit: c.per_user_limit != null ? String(c.per_user_limit) : "",
      is_active: c.is_active,
    });
    setFormError("");
    setShowForm(true);
  };

  const save = async () => {
    setFormError("");
    if (!form.code.trim()) {
      setFormError("Coupon code is required.");
      return;
    }
    if (!form.value || Number(form.value) <= 0) {
      setFormError("Discount value must be greater than 0.");
      return;
    }
    if (form.valid_from && form.valid_until && form.valid_from > form.valid_until) {
      setFormError("End date must be after the start date.");
      return;
    }
    const payload = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      discount_type: form.discount_type,
      value: Number(form.value),
      max_discount: form.max_discount === "" ? null : Number(form.max_discount),
      min_amount: form.min_amount === "" ? 0 : Number(form.min_amount),
      applies_to: form.applies_to,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
      usage_limit: form.usage_limit === "" ? null : Number(form.usage_limit),
      per_user_limit: form.per_user_limit === "" ? null : Number(form.per_user_limit),
      is_active: form.is_active,
    };
    setSaving(true);
    try {
      if (editingId) {
        await API.put(`/admin/coupons/${editingId}`, payload);
        toast("Coupon updated", "success");
      } else {
        await API.post("/admin/coupons", payload);
        toast("Coupon created", "success");
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || "Could not save coupon");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: Coupon) => {
    setBusy(c.id);
    try {
      await API.put(`/admin/coupons/${c.id}`, { is_active: !c.is_active });
      toast(c.is_active ? "Coupon deactivated" : "Coupon activated", "success");
      load();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to update", "error");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (c: Coupon) => {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    setBusy(c.id);
    try {
      const res = await API.delete(`/admin/coupons/${c.id}`);
      toast(res.data?.message || "Coupon deleted", "success");
      load();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to delete", "error");
    } finally {
      setBusy(null);
    }
  };

  const discountLabel = (c: Coupon) =>
    c.discount_type === "percent"
      ? `${c.value}%${c.max_discount ? ` (max ₹${c.max_discount})` : ""}`
      : `₹${c.value}`;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-dark)" }}>Coupons</h1>
          <p className="text-sm text-gray-500 mt-1">Create discount codes for listing and featured purchases.</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary px-5">+ New Coupon</button>
      </div>

      {loading ? (
        <p className="text-gray-400 py-10 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
          No coupons yet. Click “New Coupon” to create one.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Applies to</th>
                <th className="px-4 py-3 font-medium">Validity</th>
                <th className="px-4 py-3 font-medium">Used</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-gray-800">{c.code}</span>
                    {c.description && <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{discountLabel(c)}</td>
                  <td className="px-4 py-3 text-gray-600">{APPLIES_LABEL[c.applies_to] || c.applies_to}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {c.valid_from ? `From ${toDateInput(c.valid_from)}` : "—"}
                    <br />
                    {c.valid_until ? `Until ${toDateInput(c.valid_until)}` : "No end date"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.used_count}{c.usage_limit != null ? ` / ${c.usage_limit}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(c)} className="text-blue-600 hover:underline mr-3">Edit</button>
                    <button onClick={() => toggleActive(c)} disabled={busy === c.id} className="text-gray-600 hover:underline mr-3">
                      {c.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => remove(c)} disabled={busy === c.id} className="text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-8">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: "var(--text-dark)" }}>
                {editingId ? "Edit Coupon" : "New Coupon"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              {formError && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{formError}</p>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. SAVE20"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Shown internally on the coupons list"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount type</label>
                  <select
                    value={form.discount_type}
                    onChange={(e) => setForm({ ...form, discount_type: e.target.value as "percent" | "fixed" })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <option value="percent">Percentage</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value {form.discount_type === "percent" ? "(%)" : "(₹)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max discount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.max_discount}
                    onChange={(e) => setForm({ ...form, max_discount: e.target.value })}
                    placeholder="No cap"
                    disabled={form.discount_type !== "percent"}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min purchase (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.min_amount}
                    onChange={(e) => setForm({ ...form, min_amount: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Applies to</label>
                <select
                  value={form.applies_to}
                  onChange={(e) => setForm({ ...form, applies_to: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {Object.entries(APPLIES_LABEL).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid from</label>
                  <input
                    type="date"
                    value={form.valid_from}
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid until</label>
                  <input
                    type="date"
                    value={form.valid_until}
                    onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total usage limit</label>
                  <input
                    type="number"
                    min="1"
                    value={form.usage_limit}
                    onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                    placeholder="Unlimited"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Per-user limit</label>
                  <input
                    type="number"
                    min="1"
                    value={form.per_user_limit}
                    onChange={(e) => setForm({ ...form, per_user_limit: e.target.value })}
                    placeholder="Unlimited"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Active
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="btn btn-ghost px-5">Cancel</button>
              <button onClick={save} disabled={saving} className="btn btn-primary px-6 disabled:opacity-50">
                {saving ? "Saving…" : editingId ? "Save Changes" : "Create Coupon"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
