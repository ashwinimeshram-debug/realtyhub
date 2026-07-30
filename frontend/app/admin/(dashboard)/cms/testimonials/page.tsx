"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import API, { backendAssetUrl } from "@/lib/api";
import GalleryPicker from "@/components/admin/GalleryPicker";
import SectionHeaderEditor from "@/components/admin/SectionHeaderEditor";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/hooks/useConfirm";

/* ─── CropModal: drag a circular selector over the image ─── */
function CropModal({
  src,
  onConfirm,
  onCancel,
}: {
  src: string;
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
}) {
  const OUT_SIZE = 400;
  const PREVIEW = 300;

  const imgRef = useRef<HTMLImageElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const [displayScale, setDisplayScale] = useState(1);

  const [radius, setRadius] = useState(80);
  const [cx, setCx] = useState(PREVIEW / 2);
  const [cy, setCy] = useState(PREVIEW / 2);

  const dragRef = useRef({ active: false, startX: 0, startY: 0, origCx: 0, origCy: 0 });

  /* ── pinch-to-resize state ── */
  const pinchRef = useRef({ active: false, startDist: 0, startRadius: 0 });

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    setImgNatural({ w: el.naturalWidth, h: el.naturalHeight });

    const wrap = wrapRef.current;
    if (!wrap) return;

    const wrapW = wrap.clientWidth;
    const wrapH = wrap.clientHeight;
    const scale = Math.min(wrapW / el.naturalWidth, wrapH / el.naturalHeight);
    setDisplayScale(scale);

    const dispW = el.naturalWidth * scale;
    const dispH = el.naturalHeight * scale;
    const initR = Math.min(dispW, dispH) / 2 * 0.85;
    setRadius(initR);
    setCx(dispW / 2);
    setCy(dispH / 2);
  };

  /* ── clamp circle inside displayed image bounds ── */
  const clamp = useCallback(
    (nx: number, ny: number, r: number) => {
      const el = imgRef.current;
      if (!el) return { x: nx, y: ny };
      const dispW = el.clientWidth;
      const dispH = el.clientHeight;
      return {
        x: Math.max(r, Math.min(dispW - r, nx)),
        y: Math.max(r, Math.min(dispH - r, ny)),
      };
    },
    []
  );

  /* ── pointer drag (mouse + touch) ── */
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, origCx: cx, origCy: cy };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [cx, cy]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current.active) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const next = clamp(dragRef.current.origCx + dx, dragRef.current.origCy + dy, radius);
      setCx(next.x);
      setCy(next.y);
    },
    [radius, clamp]
  );

  const onPointerUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  /* ── wheel to resize radius ── */
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.3;
      const el = imgRef.current;
      if (!el) return;
      const maxR = Math.min(el.clientWidth, el.clientHeight) / 2;
      const next = Math.max(30, Math.min(maxR, radius + delta));
      const clamped = clamp(cx, cy, next);
      setRadius(next);
      setCx(clamped.x);
      setCy(clamped.y);
    },
    [radius, cx, cy, clamp]
  );

  /* ── pinch to resize on mobile ── */
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchRef.current = { active: true, startDist: Math.hypot(dx, dy), startRadius: radius };
      }
    },
    [radius]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current.active) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const ratio = dist / pinchRef.current.startDist;
        const el = imgRef.current;
        if (!el) return;
        const maxR = Math.min(el.clientWidth, el.clientHeight) / 2;
        const next = Math.max(30, Math.min(maxR, pinchRef.current.startRadius * ratio));
        const clamped = clamp(cx, cy, next);
        setRadius(next);
        setCx(clamped.x);
        setCy(clamped.y);
      }
    },
    [cx, cy, clamp]
  );

  /* ── crop to canvas ── */
  const crop = () => {
    const img = imgRef.current;
    if (!img || !imgNatural.w) return;

    const dispW = img.clientWidth;
    const dispH = img.clientHeight;
    const scaleX = imgNatural.w / dispW;
    const scaleY = imgNatural.h / dispH;

    const canvas = document.createElement("canvas");
    canvas.width = OUT_SIZE;
    canvas.height = OUT_SIZE;
    const ctx = canvas.getContext("2d")!;

    ctx.beginPath();
    ctx.arc(OUT_SIZE / 2, OUT_SIZE / 2, OUT_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const srcCx = cx * scaleX;
    const srcCy = cy * scaleY;
    const srcR = radius * Math.max(scaleX, scaleY);

    ctx.drawImage(
      img,
      srcCx - srcR,
      srcCy - srcR,
      srcR * 2,
      srcR * 2,
      0,
      0,
      OUT_SIZE,
      OUT_SIZE
    );

    canvas.toBlob((blob) => {
      if (blob) onConfirm(blob);
    }, "image/jpeg", 0.9);
  };

  /* ── clip path for circular overlay mask ── */
  const circleClip =
    `circle(${radius}px at ${cx}px ${cy}px)`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-[360px]">
        <h3 className="text-lg font-bold mb-1 text-center">Crop Photo</h3>
        <p className="text-xs text-gray-400 mb-3 text-center">
          Drag the circle to position · Scroll wheel or pinch to resize
        </p>

        {/* ── Crop viewport ── */}
        <div
          ref={wrapRef}
          className="relative mx-auto overflow-hidden rounded-lg bg-gray-900 select-none touch-none"
          style={{ width: PREVIEW, height: PREVIEW }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
        >
          {/* Full image */}
          <img
            ref={imgRef}
            src={src}
            onLoad={onImgLoad}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            draggable={false}
          />

          {/* Dark overlay with circle cutout (inverted mask) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "rgba(0,0,0,0.6)",
              clipPath: circleClip,
              clipRule: "evenodd",
            }}
          />

          {/* Circle border */}
          <div
            className="absolute pointer-events-none border-2 border-white rounded-full"
            style={{
              width: radius * 2,
              height: radius * 2,
              left: cx - radius,
              top: cy - radius,
            }}
          />

          {/* Crosshair */}
          <div
            className="absolute pointer-events-none"
            style={{ left: cx - 0.5, top: cy - 8, width: 1, height: 16, background: "rgba(255,255,255,0.4)" }}
          />
          <div
            className="absolute pointer-events-none"
            style={{ left: cx - 8, top: cy - 0.5, width: 16, height: 1, background: "rgba(255,255,255,0.4)" }}
          />
        </div>

        {/* ── Action buttons ── */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={crop}
            className="flex-1 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─── */
export default function TestimonialsCMS() {
  const router = useRouter();

  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    name: "",
    role: "",
    location: "",
    description: "",
    rating: 5,
    image: "",
  });

  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const fetchData = () => {
    API.get("/admin/testimonials")
      .then((res) => setTestimonials(res.data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchData();
    API.get("/settings").then((res) => setSettings(res.data)).catch(() => {});
  }, []);

  const handleHeaderUpdate = async (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    try { await API.put("/admin/settings", { [key]: value }); } catch {}
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast("Customer name is required", "warning");
      return;
    }
    if (!form.description.trim()) {
      toast("Description is required", "warning");
      return;
    }

    setLoading(true);

    try {
      if (editingId) {
        await API.put(`/admin/testimonials/${editingId}`, form);
      } else {
        await API.post("/admin/testimonials", form);
      }

      setForm({ name: "", role: "", location: "", description: "", rating: 5, image: "" });
      setEditingId(null);
      fetchData();
    } catch {
      toast("Error saving testimonial", "error");
    }

    setLoading(false);
  };

  const handleEdit = (t: any) => {
    setForm({
      name: t.name || "",
      role: t.role || "",
      location: t.location || "",
      description: t.description || "",
      rating: t.rating ?? 5,
      image: t.image || "",
    });
    setEditingId(t.id);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: "Delete Testimonial", message: "Delete this testimonial?", danger: true, confirmLabel: "Delete" });
    if (!ok) return;

    await API.delete(`/admin/testimonials/${id}`);
    fetchData();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const imageSrc = (path: string) => backendAssetUrl(path);

  return (
    <div className="p-3 md:p-6">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <button
          onClick={() => router.push("/admin/cms")}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg shadow-sm transition"
        >
          ← Back
        </button>

        <h1 className="text-xl font-bold text-center flex-1">
          Testimonials
        </h1>

        <div className="w-[90px]" />
      </div>
      <p className="text-sm text-gray-500 text-center -mt-1 mb-4 md:mb-6">Manage customer testimonials shown on the homepage</p>

      <SectionHeaderEditor sectionKey="testimonials" sectionName="Testimonials" settings={settings} onUpdate={handleHeaderUpdate} />

      {/* FORM */}
      <div className="grid gap-3 mb-4 md:mb-6 bg-white p-3 md:p-4 rounded shadow">

        {/* CUSTOMER PHOTO */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Customer Photo</label>
          <div className="max-w-[150px]">
        <GalleryPicker
          currentImage={form.image}
          onSelect={(url) => setForm({ ...form, image: url })}
          cropSettings={{ width: 400, height: 400, quality: 0.78, brightness: 100, sharpness: 0 }}
          folder="testimonials"
        />
          </div>
          {form.image && (
            <button
              onClick={() => setForm({ ...form, image: "" })}
              className="text-xs text-red-500 hover:underline mt-1"
            >
              Remove photo
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            placeholder="Customer Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border p-2 rounded"
          />

          <input
            placeholder="Role / Designation"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="border p-2 rounded"
          />

          <input
            placeholder="Location (e.g. Nagpur)"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="border p-2 rounded"
          />
        </div>

        <textarea
          placeholder="Testimonial / Description *"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="border p-2 rounded"
          rows={3}
        />

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Rating</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setForm({ ...form, rating: star })}
                className={`text-xl ${star <= form.rating ? "text-yellow-400" : "text-gray-300"}`}
              >
                ★
              </button>
            ))}
          </div>
          <span className="text-sm text-gray-400">({form.rating}/5)</span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`flex-1 py-2 rounded text-white ${
              editingId ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"
            } disabled:bg-gray-400 transition`}
          >
            {loading
              ? "Saving..."
              : editingId
              ? "Update Testimonial"
              : "Add Testimonial"}
          </button>

          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
      setForm({ name: "", role: "", location: "", description: "", rating: 5, image: "" });
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {testimonials.length > 0 ? (
          testimonials.map((t) => (
            <div
              key={t.id}
              className={`bg-white p-4 shadow rounded flex gap-4 transition ${
                t.is_active ? "" : "opacity-50"
              }`}
            >
              {t.image ? (
                <img
                  src={imageSrc(t.image)}
                  className="w-14 h-14 rounded-full object-cover shrink-0 border"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold shrink-0">
                  {getInitials(t.name)}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-bold">{t.name}</p>
                {t.role && (
                  <p className="text-xs text-[var(--primary)] font-medium">{t.role}</p>
                )}
                {t.location && (
                  <p className="text-xs text-gray-400">{t.location}</p>
                )}
                <p className="text-xs text-yellow-500 mt-0.5">
                  {"★".repeat(t.rating ?? 5)}{"☆".repeat(5 - (t.rating ?? 5))}
                </p>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{t.description}</p>

                <span
                  className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${
                    t.is_active
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {t.is_active ? "Visible" : "Hidden"}
                </span>
              </div>

              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={() => handleEdit(t)}
                  className="px-2 py-1 bg-yellow-500 text-white rounded text-xs"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-400">No testimonials added yet.</p>
        )}
      </div>
    </div>
  );
}
