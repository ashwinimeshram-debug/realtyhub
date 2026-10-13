"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import API, { backendAssetUrl } from "@/lib/api";
import GalleryPicker from "@/components/admin/GalleryPicker";
import SectionHeaderEditor from "@/components/admin/SectionHeaderEditor";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/hooks/useConfirm";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableServiceCard({
  service,
  onEdit,
  onDelete,
}: {
  service: any;
  onEdit: (s: any) => void;
  onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: service.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white p-3 shadow rounded flex flex-col ${
        isDragging ? "ring-2 ring-blue-400" : ""
      }`}
    >
      <div className="relative">
        {service.image ? (
          <img
            src={backendAssetUrl(service.image)}
            className="h-32 w-full object-cover rounded"
          />
        ) : (
          <div className="h-32 bg-gray-200 flex items-center justify-center text-sm text-gray-500">
            No Image
          </div>
        )}

        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          className="absolute top-2 right-2 cursor-grab active:cursor-grabbing bg-white/90 rounded-md p-1.5 text-gray-500 hover:text-gray-700 shadow"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
            <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
          </svg>
        </button>
      </div>

      <p className="font-bold mt-2">{service.title || "No Title"}</p>

      <p className="text-sm text-gray-600 mt-1">{service.description || ""}</p>

      {/* ACTIONS */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onEdit(service)}
          className="flex-1 bg-yellow-500 text-white py-1 rounded text-sm"
        >
          Edit
        </button>

        <button
          onClick={() => onDelete(service.id)}
          className="flex-1 bg-red-500 text-white py-1 rounded text-sm"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function ServicesCMS() {
  const router = useRouter();

  const [services, setServices] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    image: "",
  });

  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const fetchData = () => {
    API.get("/services")
      .then((res) => setServices(res.data))
      .catch(() => {});
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback(
    async (event: any) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = services.findIndex((s) => s.id === active.id);
      const newIndex = services.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const newList = arrayMove(services, oldIndex, newIndex);
      setServices(newList);
      try {
        await API.post("/admin/services/reorder", newList.map((s) => s.id));
      } catch {
        toast("Error reordering services", "error");
        fetchData();
      }
    },
    [services]
  );

  useEffect(() => {
    fetchData();
    API.get("/settings").then((res) => setSettings(res.data)).catch(() => {});
  }, []);

  const handleHeaderUpdate = async (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    try { await API.put("/admin/settings", { [key]: value }); } catch {}
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      if (editingId) {
        await API.put(`/admin/services/${editingId}`, form);
      } else {
        await API.post("/admin/services", form);
      }

      setForm({ title: "", description: "", image: "" });
      setEditingId(null);
      fetchData();
    } catch {
      toast("Error saving service", "error");
    }

    setLoading(false);
  };

  const handleEdit = (s: any) => {
    setForm({
      title: s.title || "",
      description: s.description || "",
      image: s.image || "",
    });
    setEditingId(s.id);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: "Delete Service", message: "Delete this service?", danger: true, confirmLabel: "Delete" });
    if (!ok) return;

    await API.delete(`/admin/services/${id}`);
    fetchData();
  };

  return (
    <div className="p-3 md:p-6">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-4 md:mb-6">

        {/* LEFT: Back Button */}
        <button
          onClick={() => router.push("/admin/cms")}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg shadow-sm transition"
        >
          ← Back
        </button>

        {/* CENTER: Title */}
        <h1 className="text-xl font-bold text-center flex-1">
          Services
        </h1>

        {/* RIGHT: Spacer */}
        <div className="w-[90px]" />
      </div>
      <p className="text-sm text-gray-500 text-center -mt-1 mb-4 md:mb-6">Manage services displayed on the homepage</p>

      <SectionHeaderEditor sectionKey="services" sectionName="Services" settings={settings} onUpdate={handleHeaderUpdate} />

      {/* FORM */}
      <div className="grid gap-3 mb-4 md:mb-6 bg-white p-3 md:p-4 rounded shadow">

      {/* IMAGE */}
        <GalleryPicker
          currentImage={form.image}
          onSelect={(url) => setForm({ ...form, image: url })}
          cropSettings={{ width: 800, height: 450, quality: 0.80, brightness: 100, sharpness: 0 }}
          folder="services"
        />

        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) =>
            setForm({ ...form, title: e.target.value })
          }
          className="border p-2 rounded"
        />

        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) =>
            setForm({ ...form, description: e.target.value })
          }
          className="border p-2 rounded"
        />

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-blue-600 text-white py-2 rounded"
        >
          {loading
            ? "Saving..."
            : editingId
            ? "Update Service"
            : "Add Service"}
        </button>

        {/* CANCEL EDIT */}
        {editingId && (
          <button
            onClick={() => {
              setEditingId(null);
              setForm({ title: "", description: "", image: "" });
            }}
            className="bg-gray-400 text-white py-2 rounded"
          >
            Cancel Edit
          </button>
        )}
      </div>

      {/* LIST */}
      {services.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={services.map((s) => s.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {services.map((s) => (
                <SortableServiceCard
                  key={s.id}
                  service={s}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <p>No services added</p>
      )}
    </div>
  );
}
