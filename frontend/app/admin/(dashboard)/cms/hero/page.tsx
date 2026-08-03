"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import API, { backendAssetUrl } from "@/lib/api";
import GalleryPicker from "@/components/admin/GalleryPicker";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/hooks/useConfirm";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const FONT_FAMILIES = [
  { value: "", label: "Default" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "'Courier New', monospace", label: "Courier New" },
];

const FONT_STYLES = [
  { value: "normal", label: "Normal" },
  { value: "bold", label: "Bold" },
  { value: "italic", label: "Italic" },
  { value: "bold-italic", label: "Bold Italic" },
];

function buildFontStyle(cssStyle?: string): React.CSSProperties {
  if (!cssStyle || cssStyle === "normal") return {};
  const s: React.CSSProperties = {};
  if (cssStyle.includes("bold")) s.fontWeight = 700;
  if (cssStyle.includes("italic")) s.fontStyle = "italic";
  return s;
}

const hAlign = (v?: string) =>
  v === "left" ? "items-start text-left" : v === "right" ? "items-end text-right" : "items-center text-center";

const vAlign = (v?: string) =>
  v === "top" ? "justify-start pt-12 md:pt-16" : v === "bottom" ? "justify-end pb-12 md:pb-16" : "justify-center";

function SizeSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const current = value ? Number(value) : 0;
  const options = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72];
  return (
    <select
      value={current || ""}
      onChange={(e) => { const v = e.target.value; onChange(v ? v : ""); }}
      disabled={disabled}
      className="w-14 border border-gray-200 rounded px-0.5 py-1 text-[10px] bg-white disabled:bg-gray-100 disabled:text-gray-400"
    >
      <option value="">Auto</option>
      {options.map((n) => (
        <option key={n} value={n}>{n}</option>
      ))}
    </select>
  );
}

type SlideForm = {
  image: string;
  title: string;
  subtitle: string;
  button_text: string;
  button_link: string;
  overlay_opacity: number;
  content_vertical: string;
  title_align: string;
  title_font_size: string;
  title_color: string;
  title_font_style: string;
  title_font_family: string;
  title_line_height: string;
  subtitle_align: string;
  subtitle_font_size: string;
  subtitle_color: string;
  subtitle_font_style: string;
  subtitle_font_family: string;
  subtitle_line_height: string;
  button_align: string;
  button_font_size: string;
  button_color: string;
  background_color: string;
  button_bg_color: string;
  button_font_style: string;
  button_font_family: string;
};

const DEFAULT_FORM: SlideForm = {
  image: "", title: "", subtitle: "", button_text: "", button_link: "", overlay_opacity: 40,
  content_vertical: "middle",
  title_align: "center", title_font_size: "", title_color: "#ffffff", title_font_style: "bold", title_font_family: "", title_line_height: "",
  subtitle_align: "center", subtitle_font_size: "", subtitle_color: "#ffffff", subtitle_font_style: "normal", subtitle_font_family: "", subtitle_line_height: "",
  button_align: "center", button_font_size: "", button_color: "#ffffff", background_color: "#1e3a5f", button_bg_color: "#2563eb", button_font_style: "normal", button_font_family: "",
};

/* ───────── ELEMENT STYLING GRID ───────── */
function ElementStyleGrid({ form, setForm, disabled }: { form: SlideForm; setForm: (f: SlideForm) => void; disabled?: boolean }) {
  const hAlignOptions = ["left", "center", "right"];

  const set = (k: keyof SlideForm, v: string) => setForm({ ...form, [k]: v });

  const renderRow = (label: string, prefix: "title" | "subtitle" | "button", index: number) => (
    <tr key={prefix} className={`border-t border-gray-200 ${index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
      <td className="py-2.5 px-2 font-medium text-gray-600 text-left whitespace-nowrap">{label}</td>
      <td className="py-2.5 px-1 text-center">
        <div className="flex gap-0.5 justify-center">
          {hAlignOptions.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => set(`${prefix}_align` as keyof SlideForm, v)}
              disabled={disabled}
              className={`px-2 py-1 text-[10px] rounded border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                form[`${prefix}_align` as keyof SlideForm] === v
                  ? "bg-blue-50 border-blue-400 text-blue-700"
                  : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
              }`}
              title={v}
            >
              {v === "left" ? "◀" : v === "right" ? "▶" : "■"}
            </button>
          ))}
        </div>
      </td>
      <td className="py-2.5 px-1 align-middle">
        <SizeSelect
          value={String(form[`${prefix}_font_size` as keyof SlideForm])}
          onChange={(v) => set(`${prefix}_font_size` as keyof SlideForm, v)}
          disabled={disabled}
        />
      </td>
      <td className="py-2.5 px-1 text-center">
        <div className="flex items-center gap-1.5 justify-center">
          <input
            type="color"
            value={String(form[`${prefix}_color` as keyof SlideForm]) || "#ffffff"}
            onChange={(e) => set(`${prefix}_color` as keyof SlideForm, e.target.value)}
            disabled={disabled}
            className="w-6 h-6 border border-gray-200 rounded cursor-pointer p-0 disabled:cursor-not-allowed"
          />
          <input
            type="text"
            value={String(form[`${prefix}_color` as keyof SlideForm])}
            onChange={(e) => set(`${prefix}_color` as keyof SlideForm, e.target.value)}
            disabled={disabled}
            className="w-16 border border-gray-200 rounded px-1 py-1 text-[10px] text-center disabled:bg-gray-100 disabled:text-gray-400"
          />
        </div>
      </td>
      <td className="py-2.5 px-1 align-middle">
          <select
            value={String(form[`${prefix}_font_style` as keyof SlideForm])}
            onChange={(e) => set(`${prefix}_font_style` as keyof SlideForm, e.target.value)}
            disabled={disabled}
            className="w-full border border-gray-200 rounded px-1 py-1 text-[10px] bg-white disabled:bg-gray-100 disabled:text-gray-400"
          >
            {FONT_STYLES.map((fs) => (
              <option key={fs.value} value={fs.value}>{fs.label}</option>
            ))}
          </select>
      </td>
      <td className="py-2.5 px-1 align-middle">
          <select
            value={String(form[`${prefix}_font_family` as keyof SlideForm])}
            onChange={(e) => set(`${prefix}_font_family` as keyof SlideForm, e.target.value)}
            disabled={disabled}
            className="w-full border border-gray-200 rounded px-1 py-1 text-[10px] bg-white disabled:bg-gray-100 disabled:text-gray-400"
          >
            {FONT_FAMILIES.map((ff) => (
              <option key={ff.value} value={ff.value}>{ff.label}</option>
            ))}
          </select>
      </td>
      <td className="py-2.5 px-1 align-middle text-center">
        <SizeSelect
          value={String(form[`${prefix}_line_height` as keyof SlideForm])}
          onChange={(v) => set(`${prefix}_line_height` as keyof SlideForm, v)}
          disabled={disabled}
        />
      </td>
    </tr>
  );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-sm font-medium text-gray-700">Overlay Content Styling</label>
        <p className="text-xs text-gray-400 mt-0.5">Per-element alignment, size, colour, and font</p>
      </div>

      {/* Block vertical position */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-gray-500 w-20">Block Position</span>
        <div className="flex gap-1.5">
          {(["top", "middle", "bottom"] as const).map((v) => (
            <label
              key={v}
              className={`px-3 py-1 text-xs rounded border transition ${
                disabled
                  ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                  : "cursor-pointer " + (form.content_vertical === v
                    ? "bg-blue-50 border-blue-400 text-blue-700 font-medium"
                    : "bg-white border-gray-200 text-gray-500 hover:border-gray-300")
              }`}
            >
              <input
                type="radio"
                name="content_vertical"
                value={v}
                checked={form.content_vertical === v}
                onChange={() => setForm({ ...form, content_vertical: v })}
                disabled={disabled}
                className="sr-only"
              />
              {v === "top" ? "Top ↑" : v === "bottom" ? "Bottom ↓" : "Middle —"}
            </label>
          ))}
        </div>
      </div>

      {/* Per-element grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-center py-2.5 px-2 font-semibold text-gray-600 w-[72px]"></th>
              <th className="text-center py-2.5 px-1 font-semibold text-gray-600">HAlign</th>
              <th className="text-center py-2.5 px-1 font-semibold text-gray-600 w-[72px]">Size</th>
              <th className="text-center py-2.5 px-1 font-semibold text-gray-600">Colour</th>
              <th className="text-center py-2.5 px-1 font-semibold text-gray-600">Style</th>
              <th className="text-center py-2.5 px-1 font-semibold text-gray-600">Family</th>
              <th className="text-center py-2.5 px-1 font-semibold text-gray-600 w-[72px]">Spacing</th>
            </tr>
          </thead>
          <tbody>
            {(["Title", "Subtitle", "Button"] as const).map((label, i) => {
              const prefix = label.toLowerCase() as "title" | "subtitle" | "button";
              return renderRow(label, prefix, i);
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────── COMPACT SORTABLE THUMBNAIL ───────── */
function ThumbnailSlide({
  slide,
  isActive,
  onSelect,
  onEdit,
  onDelete,
  onToggle,
}: {
  slide: any;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: (id: number) => void;
  onToggle: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg overflow-hidden border-2 transition shrink-0 ${
        isActive ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-200"
      } ${isDragging ? "ring-2 ring-blue-500" : ""}`}
    >
      {/* Status bar */}
      <div className={`flex items-center gap-1.5 px-2 py-1 ${slide.is_active ? "bg-green-50" : "bg-gray-100"}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${slide.is_active ? "bg-green-500" : "bg-gray-400"}`} />
        <span className={`text-[10px] font-medium ${slide.is_active ? "text-green-700" : "text-gray-500"}`}>
          {slide.is_active ? "Active" : "Inactive"}
        </span>
        <span className="ml-auto text-[10px] text-gray-400">
          #{slide.id}
        </span>
      </div>

      {/* Thumbnail preview */}
      <div className="relative aspect-[3/1] cursor-pointer overflow-hidden" onClick={onSelect}>
        {slide.image ? (
          <img src={backendAssetUrl(slide.image)} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: slide.background_color || "#1e3a5f" }} />
        )}
        <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${(slide.overlay_opacity ?? 40) / 100})` }} />
        {(slide.title || slide.subtitle || slide.button_text) && (
          <div className={`absolute inset-0 flex flex-col ${vAlign(slide.content_vertical)}`}>
            <div className="p-2 text-white w-full max-w-full">
              {slide.title && (
                <p className={`flex flex-col text-[10px] font-bold leading-tight ${hAlign(slide.title_align)}`}
                  style={{ color: slide.title_color || undefined }}>
                  {slide.title}
                </p>
              )}
              {slide.subtitle && (
                <p className={`flex flex-col text-[8px] mt-0.5 ${hAlign(slide.subtitle_align)}`}
                  style={{ color: slide.subtitle_color || undefined }}>
                  {slide.subtitle}
                </p>
              )}
              {slide.button_text && (
                <div className={`flex flex-col mt-1 ${hAlign(slide.button_align)}`}>
                  <span className="text-[6px] px-1 py-0.5 rounded"
                    style={{ backgroundColor: slide.button_bg_color || "#2563eb", color: slide.button_color || "#fff" }}>
                    {slide.button_text}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        {!slide.title && !slide.subtitle && !slide.button_text && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] text-white/60 drop-shadow-md">No content</span>
          </div>
        )}
        <div
          {...listeners}
          className="absolute top-1 left-1 cursor-grab active:cursor-grabbing text-white/70 hover:text-white text-xs select-none drop-shadow-md"
          title="Drag to reorder"
        >
          ⠿
        </div>
      </div>

      {/* Action buttons row */}
      <div className="flex border-t border-gray-100">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(slide.id); }}
          className={`flex-1 text-[10px] py-1.5 font-semibold transition border-r border-gray-100 ${
            slide.is_active
              ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "bg-green-50 text-green-700 hover:bg-green-100"
          }`}
        >
          {slide.is_active ? "Deactivate" : "Activate"}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="flex-1 text-[10px] py-1.5 font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition border-r border-gray-100"
        >
          Edit
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(slide.id); }}
          className="flex-1 text-[10px] py-1.5 font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/* ───────── LIVE PREVIEW ───────── */
function LivePreview({ form, animation }: { form: SlideForm; animation: string }) {
  const renderMultiline = (text: string) =>
    text.split("\n").map((line, i, arr) => (
      <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
    ));

  const hasContent = form.image || form.title || form.subtitle || form.button_text;

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-gray-900" style={{ aspectRatio: "21 / 9" }}>
      {form.image ? (
        <div
          className={`absolute inset-0 bg-cover bg-center ${animation === "kenburns" ? "animate-[kenBurnsSlow_12s_ease-in-out_infinite]" : ""}`}
          style={{ backgroundImage: `url(${backendAssetUrl(form.image)})` }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundColor: form.background_color || "#1e3a5f" }}>
          <div className="text-center text-white/40">
            <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-xs">No background image selected</p>
          </div>
        </div>
      )}

      {/* Overlay */}
      <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${form.overlay_opacity / 100})` }} />

      {/* Content */}
      {(form.title || form.subtitle || form.button_text) && (
        <div className={`absolute inset-0 z-10 flex flex-col gap-0 h-full overflow-hidden ${vAlign(form.content_vertical)}`}>
          <div className={`p-3 md:p-6 text-white ${hasContent ? "max-w-[90%] md:max-w-none w-full" : ""}`}>
            {form.title && (
              <h2
                className={`text-lg md:text-4xl font-bold leading-tight flex flex-col ${hAlign(form.title_align)}`}
                style={{
                  color: form.title_color || undefined,
                  fontFamily: form.title_font_family || undefined,
                  fontSize: form.title_font_size ? `${form.title_font_size}px` : undefined,
                  lineHeight: form.title_line_height ? `${form.title_line_height}px` : undefined,
                  ...buildFontStyle(form.title_font_style),
                }}
              >
                {renderMultiline(form.title)}
              </h2>
            )}
            {form.subtitle && (
              <p
                className={`mt-0.5 md:mt-2 text-xs md:text-base flex flex-col ${hAlign(form.subtitle_align)}`}
                style={{
                  color: form.subtitle_color || undefined,
                  fontFamily: form.subtitle_font_family || undefined,
                  fontSize: form.subtitle_font_size ? `${form.subtitle_font_size}px` : undefined,
                  lineHeight: form.subtitle_line_height ? `${form.subtitle_line_height}px` : undefined,
                  ...buildFontStyle(form.subtitle_font_style),
                }}
              >
                {renderMultiline(form.subtitle)}
              </p>
            )}
            {form.button_text && (
              <div className={`flex flex-col mt-2 md:mt-4 ${hAlign(form.button_align)}`}>
                <button
                  className="btn btn-primary btn-sm"
                  style={{
                    color: form.button_color || undefined,
                    fontFamily: form.button_font_family || undefined,
                    fontSize: form.button_font_size ? `${form.button_font_size}px` : undefined,
                    backgroundColor: form.button_bg_color || undefined,
                    ...buildFontStyle(form.button_font_style),
                  }}
                >
                  {form.button_text}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Animation badge */}
      <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1">
        {animation === "kenburns" ? (
          <>
            <svg className="w-3 h-3 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <span>Ken Burns Zoom</span>
          </>
        ) : (
          <>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>Swipe Slide</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ───────── MAIN ───────── */
export default function HeroCMS() {
  const router = useRouter();

  const [slides, setSlides] = useState<any[]>([]);
  const [animation, setAnimation] = useState("default");
  const [form, setForm] = useState<SlideForm>({ ...DEFAULT_FORM });
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedSlideId, setSelectedSlideId] = useState<number | null>(null);
  const [isFormEnabled, setIsFormEnabled] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const fetchData = () => {
    API.get("/admin/hero").then((res) => {
      setSlides(res.data);
      if (!editingId && !isFormEnabled) {
        setSelectedSlideId(res.data[0]?.id ?? null);
      }
    });
  };

  useEffect(() => {
    fetchData();
    API.get("/settings").then((res) => {
      if (res.data.hero_animation) setAnimation(res.data.hero_animation);
    }).catch(() => {});
  }, []);

  const resetForm = () => {
    setForm({ ...DEFAULT_FORM });
    setEditingId(null);
    setSelectedSlideId(null);
    setIsFormEnabled(false);
    setErrors([]);
  };

  const handleStartNew = () => {
    setForm({ ...DEFAULT_FORM });
    setEditingId(null);
    setSelectedSlideId(null);
    setIsFormEnabled(true);
    setErrors([]);
    setShowMobilePreview(false);
  };

  const handleSubmit = async () => {
    const errs: string[] = [];
    setErrors(errs);
    if (errs.length > 0) return;

    const wasEditing = editingId;
    setLoading(true);
    try {
      if (wasEditing) {
        await API.put(`/hero/${wasEditing}`, form);
      } else {
        const nextOrder = slides.length > 0 ? Math.max(...slides.map((s) => s.order ?? 0)) + 1 : 0;
        await API.post("/admin/hero", { ...form, order: nextOrder });
      }
      resetForm();
      const res = await API.get("/admin/hero");
      setSlides(res.data);
      if (wasEditing) {
        setSelectedSlideId(wasEditing);
      } else {
        setSelectedSlideId(res.data[res.data.length - 1]?.id ?? null);
      }
    } catch {
      toast(wasEditing ? "Error updating hero" : "Error adding hero", "error");
    }
    setLoading(false);
  };

  const handleEdit = (slide: any) => {
    setIsFormEnabled(true);
    setErrors([]);
    setShowMobilePreview(false);
    setEditingId(slide.id);
    setSelectedSlideId(slide.id);
    setForm({
      image: slide.image || "",
      title: slide.title || "",
      subtitle: slide.subtitle || "",
      button_text: slide.button_text || "",
      button_link: slide.button_link || "",
      overlay_opacity: slide.overlay_opacity ?? 40,
      content_vertical: slide.content_vertical || "middle",
      title_align: slide.title_align || "center",
      title_font_size: slide.title_font_size || "",
      title_color: slide.title_color || "#ffffff",
      title_font_style: slide.title_font_style || "bold",
      title_font_family: slide.title_font_family || "",
      title_line_height: slide.title_line_height || "",
      subtitle_align: slide.subtitle_align || "center",
      subtitle_font_size: slide.subtitle_font_size || "",
      subtitle_color: slide.subtitle_color || "#ffffff",
      subtitle_font_style: slide.subtitle_font_style || "normal",
      subtitle_font_family: slide.subtitle_font_family || "",
      subtitle_line_height: slide.subtitle_line_height || "",
      button_align: slide.button_align || "center",
      button_font_size: slide.button_font_size || "",
      button_color: slide.button_color || "#ffffff",
      background_color: slide.background_color || "#1e3a5f",
      button_bg_color: slide.button_bg_color || "#2563eb",
      button_font_style: slide.button_font_style || "normal",
      button_font_family: slide.button_font_family || "",
    });
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: "Delete Slide", message: "Delete this slide?", danger: true, confirmLabel: "Delete" });
    if (!ok) return;
    await API.delete(`/hero/${id}`);
    if (editingId === id) resetForm();
    const res = await API.get("/admin/hero");
    setSlides(res.data);
    if (selectedSlideId === id) {
      setSelectedSlideId(res.data[0]?.id ?? null);
    }
  };

  const handleToggle = async (id: number) => {
    setSlides((prev) => prev.map((s) => s.id === id ? { ...s, is_active: !s.is_active } : s));
    try {
      await API.patch(`/hero/toggle/${id}`);
    } catch {
      fetchData();
    }
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = slides.findIndex((s) => s.id === active.id);
    const newIndex = slides.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newSlides = arrayMove(slides, oldIndex, newIndex);
    setSlides(newSlides);
    const payload = newSlides.map((s, i) => ({ id: s.id, order: i + 1 }));
    try { await API.post("/hero/reorder", payload); } catch { fetchData(); }
  };

  const handleAnimationChange = async (value: string) => {
    setAnimation(value);
    try { await API.put("/admin/settings", { hero_animation: value }); } catch {}
  };

  const activeSlides = slides.filter((s) => s.is_active);

  const previewForm = isFormEnabled
    ? form
    : selectedSlideId
      ? (() => {
          const s = slides.find((x) => x.id === selectedSlideId);
          return s ? {
            image: s.image || "",
            title: s.title || "",
            subtitle: s.subtitle || "",
            button_text: s.button_text || "",
            button_link: s.button_link || "",
            overlay_opacity: s.overlay_opacity ?? 40,
            content_vertical: s.content_vertical || "middle",
            title_align: s.title_align || "center",
            title_font_size: s.title_font_size || "",
            title_color: s.title_color || "#ffffff",
            title_font_style: s.title_font_style || "bold",
            title_font_family: s.title_font_family || "",
            title_line_height: s.title_line_height || "",
            subtitle_align: s.subtitle_align || "center",
            subtitle_font_size: s.subtitle_font_size || "",
            subtitle_color: s.subtitle_color || "#ffffff",
            subtitle_font_style: s.subtitle_font_style || "normal",
            subtitle_font_family: s.subtitle_font_family || "",
            subtitle_line_height: s.subtitle_line_height || "",
            button_align: s.button_align || "center",
            button_font_size: s.button_font_size || "",
            button_color: s.button_color || "#ffffff",
            background_color: s.background_color || "#1e3a5f",
            button_bg_color: s.button_bg_color || "#2563eb",
            button_font_style: s.button_font_style || "normal",
            button_font_family: s.button_font_family || "",
          } : DEFAULT_FORM;
        })()
      : DEFAULT_FORM;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* HEADER */}
      <div className="flex items-center justify-between px-3 md:px-6 py-3 bg-white border-b shrink-0">
        <button
          onClick={() => router.push("/admin/cms")}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg shadow-sm transition text-sm"
        >
          ← Back
        </button>
        <h1 className="text-lg font-bold">Hero Section</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 hidden sm:inline">
            {activeSlides.length} / {slides.length} active
          </span>
          <button
            onClick={() => setShowMobilePreview(!showMobilePreview)}
            className="lg:hidden px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg shadow"
          >
            {showMobilePreview ? "Show Form" : "Preview"}
          </button>
        </div>
      </div>

      {/* BODY: Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL — Scrollable Form (40%) */}
        <div className={`${showMobilePreview ? "hidden" : "flex"} lg:flex flex-col w-full lg:w-[40%] overflow-y-auto bg-gray-50 p-3 md:p-4 gap-3`}>
          {/* Edit indicator */}
          {isFormEnabled && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-3 py-2 rounded flex items-center justify-between shrink-0">
              <span>{editingId ? `Editing slide #${editingId}` : "New slide"}</span>
              <button onClick={resetForm} className="text-[var(--primary)] underline text-xs">Cancel</button>
            </div>
          )}

          {/* Image */}
          <div className="bg-white rounded-lg shadow-sm border p-3 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Background Image</h2>
              <p className="text-xs text-gray-400 mt-0.5">1521×475 recommended</p>
            </div>
            <GalleryPicker
              currentImage={form.image}
              onSelect={(url) => setForm({ ...form, image: url })}
              aspectRatio="1521 / 475"
              cropSettings={{ width: 1521, height: 475, quality: 0.82, brightness: 100, sharpness: 0 }}
              folder="hero"
              showPreview
              compact
              disabled={!isFormEnabled}
            />
            {form.image && isFormEnabled && (
              <button
                type="button"
                onClick={() => setForm({ ...form, image: "" })}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove image
              </button>
            )}
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-500">Background Color</label>
              <input
                type="color"
                value={form.background_color || "#1e3a5f"}
                onChange={(e) => setForm({ ...form, background_color: e.target.value })}
                disabled={!isFormEnabled}
                className="w-7 h-7 rounded cursor-pointer border-0 p-0 disabled:cursor-not-allowed"
              />
              <input
                type="text"
                value={form.background_color || ""}
                onChange={(e) => setForm({ ...form, background_color: e.target.value })}
                disabled={!isFormEnabled}
                className="w-20 border border-gray-200 rounded px-2 py-1 text-xs disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">
                Dark Overlay: <span className="text-blue-600 font-bold">{form.overlay_opacity}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={form.overlay_opacity}
                onChange={(e) => setForm({ ...form, overlay_opacity: Number(e.target.value) })}
                disabled={!isFormEnabled}
                className="w-full accent-blue-600 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Content */}
          <div className="bg-white rounded-lg shadow-sm border p-3 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">Content</h2>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Title (Enter for new line)</label>
              <textarea
                placeholder="Title text"
                value={form.title}
                rows={2}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                disabled={!isFormEnabled}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm resize-none disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Subtitle</label>
              <textarea
                placeholder="Subtitle text"
                value={form.subtitle}
                rows={2}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                disabled={!isFormEnabled}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm resize-none disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Button Text</label>
                <input
                  placeholder="e.g. Explore"
                  value={form.button_text}
                  onChange={(e) => setForm({ ...form, button_text: e.target.value })}
                  disabled={!isFormEnabled}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Button Link</label>
                <input
                  placeholder="/properties"
                  value={form.button_link}
                  onChange={(e) => setForm({ ...form, button_link: e.target.value })}
                  disabled={!isFormEnabled}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-500">Button BG</label>
              <input
                type="color"
                value={form.button_bg_color || "#2563eb"}
                onChange={(e) => setForm({ ...form, button_bg_color: e.target.value })}
                disabled={!isFormEnabled}
                className="w-7 h-7 rounded cursor-pointer border-0 p-0 disabled:cursor-not-allowed"
              />
              <input
                type="text"
                value={form.button_bg_color || ""}
                onChange={(e) => setForm({ ...form, button_bg_color: e.target.value })}
                disabled={!isFormEnabled}
                className="w-20 border border-gray-200 rounded px-2 py-1 text-xs disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
          </div>

          {/* Typography */}
          <div className="bg-white rounded-lg shadow-sm border p-3">
            <ElementStyleGrid form={form} setForm={setForm} disabled={!isFormEnabled} />
          </div>

          {/* Animation */}
          <div className="bg-white rounded-lg shadow-sm border p-3 space-y-2">
            <h2 className="text-sm font-semibold text-gray-800">Animation</h2>
            <div className="flex gap-2">
              <label className="flex items-center gap-2 px-3 py-1.5 rounded border cursor-pointer transition text-xs has-[:checked]:bg-blue-50 has-[:checked]:border-blue-400 has-[:checked]:text-blue-700 bg-white border-gray-200 text-gray-500 hover:border-gray-300">
                <input
                  type="radio"
                  name="hero_animation"
                  value="default"
                  checked={animation === "default"}
                  onChange={() => handleAnimationChange("default")}
                  className="accent-blue-600"
                />
                Swipe
              </label>
              <label className="flex items-center gap-2 px-3 py-1.5 rounded border cursor-pointer transition text-xs has-[:checked]:bg-blue-50 has-[:checked]:border-blue-400 has-[:checked]:text-blue-700 bg-white border-gray-200 text-gray-500 hover:border-gray-300">
                <input
                  type="radio"
                  name="hero_animation"
                  value="kenburns"
                  checked={animation === "kenburns"}
                  onChange={() => handleAnimationChange("kenburns")}
                  className="accent-blue-600"
                />
                Ken Burns
              </label>
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded flex flex-col gap-1">
              {errors.map((e, i) => <span key={i}>{e}</span>)}
            </div>
          )}

          {/* Save */}
          <button
            onClick={handleSubmit}
            disabled={loading || !isFormEnabled}
            className={`w-full py-2.5 rounded-lg text-white font-semibold shadow transition text-sm ${
              !isFormEnabled
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : editingId
                  ? "bg-green-600 hover:bg-green-700 disabled:bg-green-400"
                  : "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400"
            }`}
          >
            {loading
              ? "Saving..."
              : editingId ? "Update Slide" : "Add New Slide"}
          </button>
        </div>

        {/* RIGHT PANEL — Sticky Preview (60%) */}
        <div className={`${showMobilePreview ? "flex" : "hidden"} lg:flex flex-col w-full lg:w-[60%] bg-gray-100 p-3 md:p-4 gap-3 overflow-y-auto`}>
          {/* Live Preview */}
          <div className="sticky top-0 z-10">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700">Live Preview</h2>
              <span className="text-[10px] text-gray-400">21:9 aspect ratio</span>
            </div>
            <LivePreview form={previewForm} animation={animation} />
          </div>

          {/* Slide Thumbnails */}
          <div className="flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700">
                Slides ({slides.length})
              </h2>
              <button
                onClick={handleStartNew}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                + New
              </button>
            </div>

            {slides.length === 0 ? (
              <div className="bg-white rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-400 text-sm">
                No slides yet. Add your first slide using the form.
              </div>
            ) : (
              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={slides.map((s) => s.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                    {slides.map((s) => (
                      <ThumbnailSlide
                        key={s.id}
                        slide={s}
                        isActive={selectedSlideId === s.id || editingId === s.id}
                        onSelect={() => setSelectedSlideId(s.id)}
                        onEdit={() => handleEdit(s)}
                        onDelete={handleDelete}
                        onToggle={handleToggle}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            <p className="text-[10px] text-gray-400 mt-2 text-center">
              Drag thumbnails to reorder · Click Edit to load into form
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
