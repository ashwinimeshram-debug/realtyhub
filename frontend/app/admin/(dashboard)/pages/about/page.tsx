"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import API, { backendAssetUrl } from "@/lib/api";
import { processImages } from "@/lib/imageProcessor";
import SectionForm, { Section, EMPTY_SECTION, EMPTY_DESCRIPTION, uid, inputClass } from "@/components/admin/SectionForm";
import GalleryPicker from "@/components/admin/GalleryPicker";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/hooks/useConfirm";
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
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TeamMember {
  id: number;
  name: string;
  role: string;
  bio: string;
  email: string;
  social_links: Record<string, string>;
  photo_url: string;
  is_leader: boolean;
  sort_order: number;
}

const EMPTY_MEMBER: TeamMember = {
  id: 0,
  name: "",
  role: "",
  bio: "",
  email: "",
  social_links: {},
  photo_url: "",
  is_leader: false,
  sort_order: 0,
};

// ═══════════════════════════════════════════
// MEMBER FORM (extracted outside parent, owns upload state)
// ═══════════════════════════════════════════
function MemberForm({
  member,
  saving,
  onSave,
  onCancel,
}: {
  member: TeamMember;
  saving: boolean;
  onSave: (m: TeamMember) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...member });
  const [social, setSocial] = useState({
    linkedin: member.social_links?.linkedin || "",
    twitter: member.social_links?.twitter || "",
    instagram: member.social_links?.instagram || "",
  });
  const { toast } = useToast();

  return (
    <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* PHOTO */}
        <div className="md:row-span-3">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Photo</label>
          <div className="max-w-[200px]">
        <GalleryPicker
          currentImage={form.photo_url}
          onSelect={(url) => setForm((prev) => ({ ...prev, photo_url: url }))}
          cropSettings={{ width: 400, height: 400, quality: 0.78, brightness: 100, sharpness: 0 }}
          folder="about"
        />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Role / Designation</label>
          <input type="text" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Founder & CEO" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" className={inputClass} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Short Bio</label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={3}
            placeholder="Brief description..."
            className={`${inputClass} resize-y`}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Social Links</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(["linkedin", "twitter", "instagram"] as const).map((platform) => (
              <input
                key={platform}
                type="url"
                value={social[platform]}
                onChange={(e) => setSocial({ ...social, [platform]: e.target.value })}
                placeholder={`${platform.charAt(0).toUpperCase() + platform.slice(1)} URL`}
                className={inputClass}
              />
            ))}
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              className={`relative w-11 h-6 rounded-full transition-colors ${form.is_leader ? "bg-[var(--primary)]" : "bg-gray-300"}`}
              onClick={() => setForm({ ...form, is_leader: !form.is_leader })}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_leader ? "translate-x-5" : ""}`}
              />
            </div>
            <span className="text-sm font-medium text-gray-700">Mark as Featured Leader</span>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-6 pt-5 border-t border-gray-100">
        <button
          onClick={() => onSave({ ...form, social_links: social })}
          disabled={!form.name.trim() || !form.role.trim() || saving}
          className="px-6 py-2.5 bg-[var(--primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--primary-hover)] disabled:bg-gray-300 disabled:cursor-not-allowed transition"
        >
          {saving ? "Saving..." : "Save Member"}
        </button>
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-900 transition">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SORTABLE GALLERY THUMBNAIL
// ═══════════════════════════════════════════
function GalleryThumb({
  img,
  onDelete,
}: {
  img: any;
  onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(img.id) });
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
      {...attributes}
      {...listeners}
      className="group relative aspect-square rounded-xl overflow-hidden border border-gray-100 shadow-sm cursor-grab active:cursor-grabbing"
    >
      <img
        src={backendAssetUrl(img.image_url)}
        alt={img.caption || "Gallery"}
        className="w-full h-full object-cover pointer-events-none"
      />
      <span className="absolute top-1 left-1 bg-black/50 text-white text-[9px] px-1 rounded pointer-events-none">
        {img.sort_order + 1}
      </span>
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(img.id); }}
          className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition shadow-lg pointer-events-auto"
          title="Remove image"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SORTABLE SECTION ITEM (for drag-and-drop)
// ═══════════════════════════════════════════
function SortableSectionItem({
  section,
  onEdit,
  onDelete,
}: {
  section: Section;
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
    <div ref={setNodeRef} style={style}>
      <div className={`bg-white border rounded-xl p-5 transition group ${isDragging ? "shadow-lg border-[var(--primary)]" : "border-gray-100 hover:shadow-sm"}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <button className="mt-1 p-1 cursor-grab active:cursor-grabbing shrink-0" {...attributes} {...listeners}>
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              {isDesc ? (
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Description</span>
              ) : (
                <h3 className="font-bold text-[#1E293B] text-base">{section.label}</h3>
              )}
              <div className="mt-2 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{section.content}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
            <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-blue-50 transition" title="Edit">
              <svg className="w-4 h-4 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-red-50 transition" title="Delete">
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

// ═══════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════
export default function AboutPageEditor() {
  const router = useRouter();

  // ─── SECTIONS STATE ───
  const [sections, setSections] = useState<Section[]>([]);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [addingType, setAddingType] = useState<"section" | "description" | null>(null);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [sectionsSaving, setSectionsSaving] = useState(false);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ─── TEAM STATE ───
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberSaving, setMemberSaving] = useState(false);
  const [teamLayout, setTeamLayout] = useState<"carousel" | "grid">("carousel");

  // ─── GALLERY STATE ───
  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryTransition, setGalleryTransition] = useState("fade");
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const GALLERY_TRANSITIONS = [
    { key: "fade", label: "Fade" },
    { key: "slide", label: "Slide" },
    { key: "cube", label: "Cube" },
    { key: "flip", label: "Flip" },
  ];

  // ─── LOAD DATA ───
  useEffect(() => {
    API.get("/admin/pages/about/sections")
      .then((res) => {
        const data = res.data;
        if (Array.isArray(data) && data.length > 0) setSections(data);
      })
      .catch(() => {})
      .finally(() => setSectionsLoading(false));

    API.get("/admin/team")
      .then((res) => setMembers(res.data))
      .catch(() => {})
      .finally(() => setTeamLoading(false));

    API.get("/admin/pages/about/team-layout")
      .then((res) => setTeamLayout(res.data.layout))
      .catch(() => {});

    API.get("/admin/about-gallery")
      .then((res) => setGalleryImages(res.data))
      .catch(() => {})
      .finally(() => setGalleryLoading(false));

    API.get("/settings")
      .then((res) => {
        if (res.data.about_gallery_transition) setGalleryTransition(res.data.about_gallery_transition);
      })
      .catch(() => {});
  }, []);

  // ─── SECTIONS HANDLERS ───
  const saveSections = async (updated: Section[]) => {
    setSectionsSaving(true);
    try {
      await API.put("/admin/pages/about/sections", updated);
    } catch {}
    setSectionsSaving(false);
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

  const handleSectionDragEnd = (event: DragEndEvent) => {
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

  // ─── TEAM HANDLERS ───
  const handleSaveMember = async (member: TeamMember) => {
    setMemberSaving(true);
    try {
      if (member.id) {
        const res = await API.put(`/admin/team/${member.id}`, member);
        setMembers((prev) => prev.map((m) => (m.id === member.id ? res.data : m)));
      } else {
        const res = await API.post("/admin/team", { ...member, sort_order: members.length });
        setMembers((prev) => [...prev, res.data]);
      }
      setEditingMember(null);
      setIsAddingMember(false);
    } catch {}
    setMemberSaving(false);
  };

  const handleDeleteMember = async (id: number) => {
    const ok = await confirm({ title: "Remove Member", message: "Remove this team member?", danger: true, confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await API.delete(`/admin/team/${id}`);
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch {}
  };

  const handleToggleLeader = async (member: TeamMember) => {
    const updated = { ...member, is_leader: !member.is_leader };
    try {
      await API.put(`/admin/team/${member.id}`, updated);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));
    } catch {}
  };

  const handleLayoutChange = async (layout: "carousel" | "grid") => {
    setTeamLayout(layout);
    try {
      await API.put("/admin/pages/about/team-layout", { layout });
    } catch {}
  };

  const handleMoveMember = (index: number, dir: -1 | 1) => {
    const updated = [...members];
    const target = index + dir;
    if (target < 0 || target >= updated.length) return;
    [updated[index], updated[target]] = [updated[target], updated[index]];
    updated.forEach((m, i) => (m.sort_order = i));
    setMembers(updated);
    API.put("/admin/team/reorder", {
      order: updated.map((m, i) => ({ id: m.id, sort_order: i })),
    }).catch(() => {});
  };

  // ─── GALLERY HANDLERS ───
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    if (galleryFileRef.current) galleryFileRef.current.value = "";
    setGalleryUploading(true);
    try {
      const processed = await processImages(files, {
        preset: { width: 1200, height: 800, quality: 0.82, brightness: 100, sharpness: 0, label: "gallery" },
      });
      for (const file of processed) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", "about-gallery");
        const uploadRes = await API.post("/upload", fd);
        if (uploadRes.data?.url) {
          const res = await API.post("/admin/about-gallery", {
            image_url: uploadRes.data.url,
            sort_order: galleryImages.length,
          });
          setGalleryImages((prev) => [...prev, { id: res.data.id, image_url: uploadRes.data.url, sort_order: galleryImages.length, is_active: true, is_featured: false }]);
        }
      }
    } catch (err: any) {
      toast(err.response?.data?.error || "Upload failed", "error");
    }
    setGalleryUploading(false);
  };

  const handleGalleryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = galleryImages.findIndex((img) => String(img.id) === active.id);
    const newIndex = galleryImages.findIndex((img) => String(img.id) === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(galleryImages, oldIndex, newIndex).map((img, i) => ({ ...img, sort_order: i }));
    setGalleryImages(reordered);
    API.post("/admin/about-gallery/reorder", reordered.map((img) => ({ id: img.id, sort_order: img.sort_order }))).catch(() => {});
  };

  const handleDeleteGalleryImage = async (id: number) => {
    const ok = await confirm({ title: "Remove Image", message: "Remove this image from gallery?", danger: true, confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await API.delete(`/admin/about-gallery/${id}`);
      setGalleryImages((prev) => prev.filter((img) => img.id !== id));
    } catch {}
  };

  const handleGalleryTransitionChange = async (key: string) => {
    setGalleryTransition(key);
    try {
      await API.put("/admin/settings", { about_gallery_transition: key });
    } catch {}
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">About Us</h1>
          <p className="text-sm text-gray-500 mt-1">Manage content sections, team members, and gallery for the About Us page</p>
        </div>
        <button onClick={() => router.push("/admin/pages")} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg shadow-sm transition shrink-0 text-sm">
          ← Back
        </button>
      </div>

      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <button onClick={() => router.push("/admin/pages")} className="hover:text-[var(--primary)] transition">
          Pages
        </button>
        <span>/</span>
        <span className="text-gray-600">About Us</span>
      </div>

      {/* ═══════════════════════════════════════════════
          SECTION 1: DYNAMIC CONTENT SECTIONS
         ═══════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-[#1E293B]">Content Sections</h2>
            <p className="text-sm text-gray-500 mt-0.5">Drag to reorder. Manage the sections displayed on your About Us page.</p>
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

        {sectionsSaving && <p className="text-xs text-gray-400 mb-3">Saving...</p>}

        {sectionsLoading ? (
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

            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {sections.map((section) => (
                  <SortableSectionItem
                    key={section.id}
                    section={section}
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

      {/* ═══════════════════════════════════════════════
          SECTION 2: IMAGE GALLERY
         ═══════════════════════════════════════════════ */}
      <div className="pt-8 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-[#1E293B]">Image Gallery</h2>
            <p className="text-sm text-gray-500 mt-0.5">Upload images for team events, customer handovers, and more. Displayed on the About Us page hero section.</p>
          </div>
          <button
            onClick={() => galleryFileRef.current?.click()}
            disabled={galleryUploading}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--primary-hover)] transition shadow-sm disabled:opacity-50"
          >
            {galleryUploading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            )}
            {galleryUploading ? "Uploading..." : "Add Images"}
          </button>
          <input ref={galleryFileRef} type="file" accept="image/*" multiple onChange={handleGalleryUpload} className="hidden" />
        </div>

        {/* TRANSITION PICKER */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-5">
          <p className="text-sm font-semibold text-[#1E293B] mb-3">Gallery Transition Effect</p>
          <div className="flex flex-wrap gap-2">
            {GALLERY_TRANSITIONS.map((t) => (
              <button
                key={t.key}
                onClick={() => handleGalleryTransitionChange(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                  galleryTransition === t.key
                    ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* THUMBNAILS */}
        {galleryLoading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Loading gallery...</p>
        ) : galleryImages.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-400 text-sm">No gallery images yet. Click &quot;Add Images&quot; to upload.</p>
          </div>
        ) : (
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleGalleryDragEnd}>
            <SortableContext items={galleryImages.map((img) => String(img.id))} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {galleryImages.map((img) => (
                  <GalleryThumb key={img.id} img={img} onDelete={handleDeleteGalleryImage} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* ═══════════════════════════════════════════════
          SECTION 3: TEAM & LEADERSHIP CONFIGURATOR
         ═══════════════════════════════════════════════ */}
      <div className="pt-8 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-[#1E293B]">Team &amp; Leadership</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage team members and configure the public display layout</p>
          </div>
          <button
            onClick={() => {
              setIsAddingMember(true);
              setEditingMember(null);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--primary-hover)] transition shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Team Member / Founder
          </button>
        </div>

        {/* LAYOUT TOGGLE */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
          <p className="text-sm font-semibold text-[#1E293B] mb-4">Team Layout View Configuration</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleLayoutChange("carousel")}
              className={`text-left p-5 rounded-xl border-2 transition ${
                teamLayout === "carousel"
                  ? "border-[var(--primary)] bg-blue-50/60 shadow-sm"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    teamLayout === "carousel" ? "border-[var(--primary)]" : "border-gray-300"
                  }`}
                >
                  {teamLayout === "carousel" && <div className="w-2.5 h-2.5 rounded-full bg-[var(--primary)]" />}
                </div>
                <span className="font-bold text-sm text-[#1E293B]">Showcased Leaders &amp; Carousel</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed ml-8">
                Top 2-3 senior leaders in premium floating cards with soft shadows. Remaining members in a horizontally scrolling carousel (3 at a time) with arrow controls and pagination dots.
              </p>
            </button>
            <button
              onClick={() => handleLayoutChange("grid")}
              className={`text-left p-5 rounded-xl border-2 transition ${
                teamLayout === "grid"
                  ? "border-[var(--primary)] bg-blue-50/60 shadow-sm"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    teamLayout === "grid" ? "border-[var(--primary)]" : "border-gray-300"
                  }`}
                >
                  {teamLayout === "grid" && <div className="w-2.5 h-2.5 rounded-full bg-[var(--primary)]" />}
                </div>
                <span className="font-bold text-sm text-[#1E293B]">Interactive Pop-out Grid</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed ml-8">
                All team members in a uniform 4-column grid. Shows photo, name and title on desktop. Clicking opens a comprehensive modal with full bio, photo and social links.
              </p>
            </button>
          </div>
        </div>

        {teamLoading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Loading team...</p>
        ) : (
          <div className="space-y-4">
            {isAddingMember && (
              <MemberForm member={EMPTY_MEMBER} saving={memberSaving} onSave={handleSaveMember} onCancel={() => setIsAddingMember(false)} />
            )}

            {editingMember && (
              <MemberForm member={editingMember} saving={memberSaving} onSave={handleSaveMember} onCancel={() => setEditingMember(null)} />
            )}

            {members.map((member, idx) => (
              <div
                key={member.id}
                className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-sm transition group"
              >
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    {member.photo_url ? (
                      <img src={backendAssetUrl(member.photo_url)} alt={member.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg font-bold">
                        {member.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[#1E293B] text-sm">{member.name}</h3>
                      {member.is_leader && (
                        <span className="px-2 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] font-bold rounded-full uppercase tracking-wide">
                          Leader
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{member.role}</p>
                    {member.bio && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{member.bio}</p>}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <button onClick={() => handleMoveMember(idx, -1)} disabled={idx === 0} className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 transition" title="Move up">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button onClick={() => handleMoveMember(idx, 1)} disabled={idx === members.length - 1} className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 transition" title="Move down">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <button onClick={() => handleToggleLeader(member)} className={`p-1.5 rounded-md transition ${member.is_leader ? "bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20" : "hover:bg-gray-100"}`} title={member.is_leader ? "Remove leader" : "Mark as leader"}>
                      <svg className={`w-4 h-4 ${member.is_leader ? "text-[var(--primary)]" : "text-gray-400"}`} fill={member.is_leader ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                    </button>
                    <button onClick={() => { setEditingMember(member); setIsAddingMember(false); }} className="p-1.5 rounded-md hover:bg-blue-50 transition" title="Edit">
                      <svg className="w-4 h-4 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => handleDeleteMember(member.id)} className="p-1.5 rounded-md hover:bg-red-50 transition" title="Delete">
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {!isAddingMember && !editingMember && members.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-gray-400 text-sm">No team members yet. Click the button above to add one.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
