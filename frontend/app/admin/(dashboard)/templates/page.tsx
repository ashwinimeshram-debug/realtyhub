"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/components/Toast";

interface Template {
  id: number;
  category: string;
  property_type: string | null;
  template_text: string;
  sort_order: number;
  is_active: boolean;
}

const CATEGORIES = ["title", "overview", "amenities", "highlights", "closing"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  title: "Title Templates",
  overview: "Overview Sentences",
  amenities: "Amenities Sentences",
  highlights: "Highlights Sentences",
  closing: "Closing Sentences",
};

const PROPERTY_TYPES = ["flat", "house", "plot", "commercial"] as const;
const PROPERTY_TYPE_LABELS: Record<string, string> = {
  flat: "Flat", house: "House", plot: "Plot", commercial: "Commercial",
};

export default function TemplatesPage() {
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [newText, setNewText] = useState("");
  const [newPropertyType, setNewPropertyType] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    API.get("/admin/description-templates")
      .then((r) => setTemplates(r.data.templates))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = filter ? templates.filter((t) => t.category === filter) : templates;

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = filtered.filter((t) => t.category === cat);
    return acc;
  }, {} as Record<string, Template[]>);

  const handleAdd = async (category: string) => {
    if (!newText.trim()) return;
    setSaving(true);
    try {
      await API.post("/admin/description-templates", {
        category,
        property_type: newPropertyType || null,
        template_text: newText.trim(),
        sort_order: filtered.filter((t) => t.category === category).length + 1,
      });
      setNewText("");
      setNewPropertyType("");
      setAddingCategory(null);
      load();
      toast("Template added", "success");
    } catch {
      toast("Failed to add template", "error");
    }
    setSaving(false);
  };

  const handleUpdate = async (id: number) => {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      await API.put(`/admin/description-templates/${id}`, { template_text: editText.trim() });
      setEditingId(null);
      load();
      toast("Template updated", "success");
    } catch {
      toast("Failed to update template", "error");
    }
    setSaving(false);
  };

  const handleToggle = async (id: number, current: boolean) => {
    try {
      await API.put(`/admin/description-templates/${id}`, { is_active: !current });
      load();
    } catch {
      toast("Failed to toggle", "error");
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: "Delete Template", message: "Delete this template permanently?", danger: true, confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await API.delete(`/admin/description-templates/${id}`);
      load();
      toast("Template deleted", "success");
    } catch {
      toast("Failed to delete", "error");
    }
  };

  if (loading) return <div className="p-3 md:p-6">Loading...</div>;

  return (
    <div className="p-3 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800">Templates</h1>
      <p className="text-sm text-gray-500 mt-1 mb-4 md:mb-6">Manage property description templates with placeholders</p>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter("")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${!filter ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          style={!filter ? { backgroundColor: "var(--primary)" } : {}}
        >
          All ({templates.length})
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filter === cat ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            style={filter === cat ? { backgroundColor: "var(--primary)" } : {}}
          >
            {CATEGORY_LABELS[cat]} ({templates.filter((t) => t.category === cat).length})
          </button>
        ))}
      </div>

      {CATEGORIES.map((cat) => {
        const items = grouped[cat];
        if (items.length === 0 && filter && filter !== cat) return null;
        return (
          <div key={cat} className="mb-8">
            <h3 className="text-lg font-bold mb-3" style={{ color: "var(--text-dark)" }}>{CATEGORY_LABELS[cat]}</h3>
            <div className="bg-white rounded-xl shadow border border-gray-100 divide-y">
              {items.map((t) => (
                <div key={t.id} className="p-4 flex items-start gap-3">
                  <button
                    onClick={() => handleToggle(t.id, t.is_active)}
                    className={`mt-0.5 w-10 h-5 rounded-full relative transition-colors shrink-0 ${t.is_active ? "bg-green-500" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${t.is_active ? "left-5" : "left-0.5"}`} />
                  </button>
                  <div className="flex-1 min-w-0">
                    {editingId === t.id ? (
                      <div className="flex gap-2">
                        <input
                          className="form-input flex-1"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleUpdate(t.id); if (e.key === "Escape") setEditingId(null); }}
                          autoFocus
                        />
                        <button onClick={() => handleUpdate(t.id)} disabled={saving} className="btn btn-primary text-sm !px-3">Save</button>
                        <button onClick={() => setEditingId(null)} className="btn btn-ghost text-sm !px-3">Cancel</button>
                      </div>
                    ) : (
                      <p className={`text-sm ${t.is_active ? "" : "text-gray-400"}`}>{t.template_text}</p>
                    )}
                    <span className="text-xs text-gray-400 mt-1 block">
                      Sort: {t.sort_order}
                      {t.property_type && <span className="ml-1.5 inline-block px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">{PROPERTY_TYPE_LABELS[t.property_type] || t.property_type}</span>}
                      {!t.is_active && " · Inactive"}
                    </span>
                  </div>
                  {editingId !== t.id && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setEditingId(t.id); setEditText(t.template_text); }} className="text-sm text-blue-500 hover:text-blue-700 px-2 py-1">Edit</button>
                      <button onClick={() => handleDelete(t.id)} className="text-sm text-red-500 hover:text-red-700 px-2 py-1">Delete</button>
                    </div>
                  )}
                </div>
              ))}

              {/* Add new */}
              {addingCategory === cat ? (
                <div className="p-4 space-y-2">
                  <div className="flex gap-2">
                    <input
                      className="form-input flex-1"
                      placeholder="Enter template text with {placeholders}..."
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAdd(cat); if (e.key === "Escape") setAddingCategory(null); }}
                      autoFocus
                    />
                    <button onClick={() => handleAdd(cat)} disabled={saving} className="btn btn-primary text-sm !px-3">Add</button>
                    <button onClick={() => setAddingCategory(null)} className="btn btn-ghost text-sm !px-3">Cancel</button>
                  </div>
                  {(cat === "amenities" || cat === "highlights") && (
                    <select className="form-input text-sm" value={newPropertyType} onChange={(e) => setNewPropertyType(e.target.value)}>
                      <option value="">All property types (generic)</option>
                      {PROPERTY_TYPES.map((pt) => (<option key={pt} value={pt}>{PROPERTY_TYPE_LABELS[pt]}</option>))}
                    </select>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => { setAddingCategory(cat); setNewText(""); }}
                  className="w-full p-3 text-sm text-center hover:bg-gray-50 transition rounded-b-xl"
                  style={{ color: "var(--primary)" }}
                >
                  + Add {CATEGORY_LABELS[cat].replace(/s$/, "")}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1 ml-1">Placeholders: {"{property_type}, {transaction_type}, {location}, {bedrooms}, {area_size}, {facing}, {furnishing}"}</p>
          </div>
        );
      })}
    </div>
  );
}
