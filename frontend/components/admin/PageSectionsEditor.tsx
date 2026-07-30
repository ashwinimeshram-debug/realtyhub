"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import API from "@/lib/api";
import { useToast } from "@/components/Toast";
import SectionForm, { Section, EMPTY_SECTION, EMPTY_DESCRIPTION, uid } from "@/components/admin/SectionForm";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useConfirm } from "@/hooks/useConfirm";

function GripIcon() {
  return (
    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
    </svg>
  );
}

function SortableSectionItem({
  section,
  editing,
  onEdit,
  onDelete,
}: {
  section: Section;
  editing: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  };

  const isDesc = section.type === "description";

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "relative" : ""}>
      <div className={`bg-white border rounded-xl p-5 transition group ${isDragging ? "shadow-lg border-[var(--primary)]" : "border-gray-100 hover:shadow-sm"}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <button
              className="mt-1 p-1 cursor-grab active:cursor-grabbing shrink-0"
              {...attributes}
              {...listeners}
            >
              <GripIcon />
            </button>
            <div className="flex-1 min-w-0">
              {isDesc ? (
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Description</span>
              ) : (
                <h3 className="font-bold text-[#1E293B] text-base">{section.label}</h3>
              )}
              <div className="mt-2 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap line-clamp-4">{section.content}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-md hover:bg-blue-50 transition"
              title="Edit"
            >
              <svg className="w-4 h-4 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-md hover:bg-red-50 transition"
              title="Delete"
            >
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PageSectionsEditor({ slug, label }: { slug: string; label: string }) {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>([]);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [addingType, setAddingType] = useState<"section" | "description" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { confirm } = useConfirm();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    API.get(`/admin/pages/${slug}/sections`)
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) setSections(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  const saveSections = async (updated: Section[]) => {
    setSaving(true);
    try {
      await API.put(`/admin/pages/${slug}/sections`, updated);
    } catch {
      toast("Failed to save sections", "error");
    }
    setSaving(false);
  };

  const handleSaveSection = (section: Section) => {
    let updated: Section[];
    if (section.id) {
      updated = sections.map((s) => (s.id === section.id ? section : s));
    } else {
      updated = [...sections, { ...section, id: uid() }];
    }
    setSections(updated);
    saveSections(updated);
    setEditingSection(null);
    setAddingType(null);
  };

  const handleDeleteSection = async (id: string) => {
    const ok = await confirm({ title: "Delete Section", message: "Delete this section?", danger: true, confirmLabel: "Delete" });
    if (!ok) return;
    const updated = sections.filter((s) => s.id !== id);
    setSections(updated);
    saveSections(updated);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections((items) => {
      const oldIndex = items.findIndex((s) => s.id === active.id);
      const newIndex = items.findIndex((s) => s.id === over.id);
      const updated = arrayMove(items, oldIndex, newIndex);
      saveSections(updated);
      return updated;
    });
  };

  const sectionIds = sections.map((s) => s.id);

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/admin/pages")} className="hover:text-[var(--primary)] transition">
            Pages
          </button>
          <span>/</span>
          <span className="text-gray-600">{label}</span>
        </div>
        <button onClick={() => router.push("/admin/pages")} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg shadow-sm transition text-sm">
          ← Back
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-[#1E293B]">{label} — Content Sections</h2>
            <p className="text-sm text-gray-500 mt-0.5">Drag to reorder. Manage the sections displayed on your {label} page.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setAddingType("section");
                setEditingSection(null);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[var(--primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--primary-hover)] transition shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add Section
            </button>
            <button
              onClick={() => {
                setAddingType("description");
                setEditingSection(null);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[var(--primary)] text-[var(--primary)] rounded-lg text-sm font-semibold hover:bg-blue-50 transition shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              Add Description
            </button>
          </div>
        </div>

        {saving && <p className="text-xs text-gray-400 mb-3">Saving...</p>}

        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Loading sections...</p>
        ) : (
          <div className="space-y-4">
            {addingType && (
              <SectionForm
                section={addingType === "description" ? EMPTY_DESCRIPTION : EMPTY_SECTION}
                onSave={handleSaveSection}
                onCancel={() => setAddingType(null)}
              />
            )}

            {editingSection && (
              <SectionForm
                section={editingSection}
                onSave={handleSaveSection}
                onCancel={() => setEditingSection(null)}
              />
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
                {sections.map((section) => (
                  <SortableSectionItem
                    key={section.id}
                    section={section}
                    editing={editingSection?.id === section.id}
                    onEdit={() => {
                      setEditingSection(section);
                      setAddingType(null);
                    }}
                    onDelete={() => handleDeleteSection(section.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {!addingType && !editingSection && sections.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-400 text-sm">No sections yet. Click &quot;Add Section&quot; or &quot;Add Description&quot; to get started.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
