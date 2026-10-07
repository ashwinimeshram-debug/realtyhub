"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/components/Toast";

interface Role {
  id: number;
  name: string;
  slug: string;
  description: string;
  is_system: boolean;
  permissions: string[];
  user_count: number;
}

interface PermEntry {
  code: string;
  label: string;
  module: string;
  description: string;
}

interface PermModule {
  module: string;
  permissions: PermEntry[];
}

export default function RolesPage() {
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [modules, setModules] = useState<PermModule[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [permDraft, setPermDraft] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);

  const loadRoles = () => {
    API.get("/admin/roles")
      .then((r) => setRoles(r.data.roles || []))
      .catch(() => {});
  };

  const loadAll = () => {
    API.get("/admin/roles")
      .then((r) => {
        const rs: Role[] = r.data.roles || [];
        setRoles(rs);
        const pending = pendingSelect;
        if (pending) setPendingSelect(null);
        setSelectedId((cur) => {
          if (pending) {
            const created = rs.find((x) => x.slug === pending);
            if (created) return created.id;
          }
          if (cur && rs.some((x) => x.id === cur)) return cur;
          return rs.find((x) => x.is_system && x.slug === "agent")?.id ?? rs[0]?.id ?? null;
        });
      })
      .catch(() => toast("Failed to load roles", "error"));
    API.get("/admin/permissions")
      .then((r) => setModules(r.data.modules || []))
      .catch(() => toast("Failed to load permissions", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  const selectedRole = roles.find((r) => r.id === selectedId);

  const selectRole = (r: Role) => {
    setSelectedId(r.id);
    setPermDraft(new Set(r.permissions));
  };

  useEffect(() => {
    if (selectedRole) setPermDraft(new Set(selectedRole.permissions));
  }, [selectedId]);

  const togglePerm = (code: string) => {
    setPermDraft((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const savePermissions = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      await API.put(`/admin/roles/${selectedRole.id}`, { permissions: Array.from(permDraft) });
      toast("Permissions saved", "success");
      loadRoles();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to save", "error");
    }
    setSaving(false);
  };

  const openCreate = () => { setEditingRole(null); setForm({ name: "", description: "" }); setShowForm(true); };

  const openEdit = (r: Role) => { setEditingRole(r); setForm({ name: r.name, description: r.description || "" }); setShowForm(true); };

  const handleSaveRole = async () => {
    if (!form.name.trim()) { toast("Role name is required", "error"); return; }
    setSaving(true);
    try {
      if (editingRole) {
        await API.put(`/admin/roles/${editingRole.id}`, form);
        toast("Role updated", "success");
        loadRoles();
      } else {
        const res = await API.post("/admin/roles", form);
        toast("Role created", "success");
        setPendingSelect(res.data.slug);
        loadAll();
      }
      setShowForm(false);
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed", "error");
    }
    setSaving(false);
  };

  const handleDelete = async (r: Role) => {
    const ok = await confirm({ title: "Delete Role", message: `Delete role "${r.name}"? This cannot be undone.`, confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await API.delete(`/admin/roles/${r.id}`);
      toast("Role deleted", "success");
      loadAll();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to delete", "error");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Roles & Permissions</h1>
          <p className="text-sm text-gray-500 mt-1">Create staff roles and configure what each role can access</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
          + Add Role
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {/* Role list */}
          <div className="md:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {roles.map((r) => (
                <button
                  key={r.id}
                  onClick={() => selectRole(r)}
                  className={`w-full text-left px-4 py-3 transition ${selectedId === r.id ? "bg-blue-50 border-l-4 border-blue-600" : "hover:bg-gray-50 border-l-4 border-transparent"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-gray-800">{r.name}</span>
                    {r.is_system && <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">System</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {r.user_count > 0 ? `${r.user_count} user${r.user_count > 1 ? "s" : ""}` : "No users"} · {r.permissions.length} permissions
                  </div>
                  <div className="flex gap-3 mt-1.5 text-xs">
                    <span onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="text-blue-600 hover:text-blue-800 cursor-pointer">Edit</span>
                    {!r.is_system && (
                      <span onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="text-red-600 hover:text-red-800 cursor-pointer">Delete</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Permission matrix */}
          <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            {selectedRole ? (
              <>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">{selectedRole.name}</h2>
                    <p className="text-sm text-gray-500">{selectedRole.description || "No description"}</p>
                  </div>
                  <button
                    onClick={savePermissions}
                    disabled={saving || (selectedRole.is_system && selectedRole.slug === "admin")}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Permissions"}
                  </button>
                </div>

                {modules.map((mod) => (
                  <div key={mod.module} className="mt-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">{mod.module}</h3>
                    <div className="grid sm:grid-cols-2 gap-1.5">
                      {mod.permissions.map((p) => (
                        <label key={p.code} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-0.5 accent-blue-600"
                            checked={permDraft.has(p.code)}
                            onChange={() => togglePerm(p.code)}
                            title={p.description}
                          />
                          <span className="text-sm text-gray-700">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-center py-16 text-gray-400">Select a role to edit its permissions</div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Role Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">{editingRole ? "Edit Role" : "Add Role"}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={editingRole?.is_system}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100"
                  placeholder="e.g. Marketing Executive"
                />
                {editingRole?.is_system && <p className="text-xs text-gray-400 mt-1">System role names cannot be renamed</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="What does this role do?"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition">Cancel</button>
              <button onClick={handleSaveRole} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                {saving ? "Saving..." : editingRole ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}