"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";

interface User {
  id: number;
  user_id: string | null;
  username: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string | null;
}

const emptyForm = { user_id: "", username: "", email: "", name: "", password: "", phone: "", role: "power_user" };

export default function UsersPage() {
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    API.get("/admin/users")
      .then((r) => setUsers(r.data.users))
      .catch(() => toast("Failed to load users", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (u: User) => { setEditingId(u.id); setForm({ user_id: u.user_id || "", username: u.username, email: u.email, name: u.name || "", password: "", phone: u.phone || "", role: u.role }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.username.trim() || !form.email.trim()) { toast("Username and email are required", "error"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { toast("Please enter a valid email address", "warning"); return; }
    if (!editingId && !form.password.trim()) { toast("Password is required", "error"); return; }
    setSaving(true);
    try {
      if (editingId) {
        const payload: any = { ...form };
        if (!payload.password) delete payload.password;
        await API.put(`/admin/users/${editingId}`, payload);
        toast("User updated", "success");
      } else {
        await API.post("/admin/users", form);
        toast("User created", "success");
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed", "error");
    }
    setSaving(false);
  };

  const handleDelete = async (u: User) => {
    if (u.id === currentUser?.admin_id) { toast("Cannot delete yourself", "error"); return; }
    const ok = await confirm({ title: "Delete User", message: `Delete "${u.username}"? This cannot be undone.`, confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await API.delete(`/admin/users/${u.id}`);
      toast("User deleted", "success");
      load();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to delete", "error");
    }
  };

  const toggleActive = async (u: User) => {
    try {
      await API.put(`/admin/users/${u.id}`, { is_active: !u.is_active });
      toast(u.is_active ? "User disabled" : "User enabled", "success");
      load();
    } catch {
      toast("Failed to update", "error");
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage admin and power user accounts</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
          + Add User
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No users found</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 font-medium text-gray-600 text-center">User ID</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-center">User</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-center">Role</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-center">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-center">Last Login</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-b-0 hover:bg-gray-50 transition">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{u.user_id || "-"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{u.username}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                      {u.role === "admin" ? "Admin" : "Power User"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(u)} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition ${u.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                      {u.is_active ? "Active" : "Disabled"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(u)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                    {u.id !== currentUser?.admin_id && (
                      <button onClick={() => handleDelete(u)} className="text-red-600 hover:text-red-800 text-xs font-medium">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">{editingId ? "Edit User" : "Add User"}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID (leave blank for auto-generate)</label>
                <input type="text" value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="e.g. EMP-042" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                <p className="text-xs text-gray-400 mt-1">For multiple numbers, separate with comma</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                  <option value="admin">Admin</option>
                  <option value="power_user">Power User</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password {editingId ? "(leave blank to keep)" : "*"}</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
