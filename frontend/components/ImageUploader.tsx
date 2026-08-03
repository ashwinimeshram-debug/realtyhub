"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { compressImagesToWebP } from "@/lib/imageProcessor";
import { backendAssetUrl } from "@/lib/api";
import { useToast } from "@/components/Toast";
import GalleryPicker from "@/components/admin/GalleryPicker";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type ExistingImage = { id: number; image_url: string; order: number };

type UnifiedImage = {
  key: string;
  url: string;
  existingId?: number;
  galleryUrl?: string;
};

function SortableThumb({
  item,
  index,
  total,
  isActive,
  onClick,
  disabled,
}: {
  item: UnifiedImage;
  index: number;
  total: number;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.key, disabled: !!disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  };
  return (
    <div
      ref={setNodeRef} style={style} {...attributes} {...(disabled ? {} : listeners)} onClick={onClick}
      className={`h-20 w-28 shrink-0 rounded border-2 relative select-none ${disabled ? "cursor-not-allowed opacity-70" : "cursor-grab active:cursor-grabbing"} ${isActive ? "border-blue-500" : "border-gray-200"}`}
    >
      <img src={item.url} alt="Upload preview" className="h-full w-full object-cover rounded pointer-events-none" />
      <span className="absolute top-0.5 right-0.5 bg-black/50 text-white text-[9px] px-1 rounded pointer-events-none">{index + 1}</span>
      {index === 0 && total > 1 && (
        <span className="absolute bottom-0.5 left-0.5 bg-blue-500 text-white text-[8px] px-1 rounded pointer-events-none">1st</span>
      )}
    </div>
  );
}

export default function ImageUploader({
  existingImages = [],
  files,
  onFilesChange,
  onReorderExisting,
  onDeleteExisting,
  galleryUrls = [],
  onGalleryUrlsChange,
  disabled = false,
}: {
  existingImages?: ExistingImage[];
  files: File[];
  onFilesChange: (files: File[]) => void;
  onReorderExisting?: (reordered: ExistingImage[]) => void;
  onDeleteExisting?: (imageId: number) => void;
  galleryUrls?: string[];
  onGalleryUrlsChange?: (urls: string[]) => void;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const [activeIndex, setActiveIndex] = useState(0);
  const [processing, setProcessing] = useState(false);

  const fileUrls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => { return () => { fileUrls.forEach((u) => URL.revokeObjectURL(u)); }; }, [fileUrls]);

  const allItems: UnifiedImage[] = useMemo(() => {
    const existing = existingImages.map((img) => ({
      key: `existing-${img.id}`,
      url: backendAssetUrl(img.image_url),
      existingId: img.id,
    }));
    const newOnes = fileUrls.map((url, i) => ({
      key: `new-${i}-${url}`,
      url,
    }));
    const gallery = galleryUrls.map((url, i) => ({
      key: `gallery-${i}-${url}`,
      url: backendAssetUrl(url),
      galleryUrl: url,
    }));
    return [...existing, ...newOnes, ...gallery];
  }, [existingImages, fileUrls, galleryUrls]);

  const totalCount = allItems.length;

  useEffect(() => {
    if (activeIndex >= totalCount) setActiveIndex(Math.max(0, totalCount - 1));
  }, [totalCount, activeIndex]);

  const prev = () => setActiveIndex((p) => (p === 0 ? totalCount - 1 : p - 1));
  const next = () => setActiveIndex((p) => (p === totalCount - 1 ? 0 : p + 1));

  const handleRemoveSelected = () => {
    const item = allItems[activeIndex];
    if (!item) return;
    if (item.existingId && onDeleteExisting) {
      onDeleteExisting(item.existingId);
    } else if (item.galleryUrl && onGalleryUrlsChange) {
      const galIdx = galleryUrls.indexOf(item.galleryUrl);
      if (galIdx !== -1) {
        onGalleryUrlsChange(galleryUrls.filter((_, i) => i !== galIdx));
      }
    } else {
      const fileIdx = fileUrls.indexOf(item.url);
      if (fileIdx !== -1) {
        const newFiles = files.filter((_, i) => i !== fileIdx);
        onFilesChange(newFiles);
      }
    }
    setActiveIndex(0);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setProcessing(true);
    try {
      const processed = await compressImagesToWebP(Array.from(e.target.files));
      onFilesChange([...files, ...processed]);
    } catch {
      toast("Image processing failed", "error");
    }
    setProcessing(false);
    e.target.value = "";
  };

  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = allItems.findIndex((img) => img.key === active.id);
    const newIndex = allItems.findIndex((img) => img.key === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const movedItem = allItems[oldIndex];

    if (movedItem.galleryUrl && onGalleryUrlsChange) {
      const targetItem = allItems[newIndex];
      if (targetItem?.galleryUrl) {
        const oldGalIdx = galleryUrls.indexOf(movedItem.galleryUrl);
        const newGalIdx = galleryUrls.indexOf(targetItem.galleryUrl);
        if (oldGalIdx !== -1 && newGalIdx !== -1) {
          onGalleryUrlsChange(arrayMove(galleryUrls, oldGalIdx, newGalIdx));
        }
      }
    } else if (!movedItem.existingId) {
      const oldFileIdx = fileUrls.indexOf(movedItem.url);
      const targetItem = allItems[newIndex];
      if (!targetItem?.existingId && !targetItem?.galleryUrl) {
        const newFileIdx = fileUrls.indexOf(targetItem.url);
        const newFiles = arrayMove(files, oldFileIdx, newFileIdx);
        onFilesChange(newFiles);
      }
    } else if (onReorderExisting) {
      const newItems = arrayMove(existingImages, oldIndex, newIndex);
      const reordered = newItems.map((img, i) => ({ ...img, order: i + 1 }));
      onReorderExisting(reordered);
    }
    setActiveIndex(newIndex);
  }, [allItems, fileUrls, files, existingImages, galleryUrls, onFilesChange, onReorderExisting, onGalleryUrlsChange]);

  return (
    <div>
      <div className="relative h-[340px] md:h-[440px] bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
        {totalCount > 0 ? (
          <img src={allItems[activeIndex]?.url} alt="Selected" className="w-full h-full object-contain bg-gray-50" />
        ) : (
          <div className="text-center px-4">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v14.25a1.5 1.5 0 001.5 1.5z" /></svg>
            <p className="text-sm font-medium text-gray-400">No Image Selected</p>
            <p className="text-xs text-gray-300 mt-1">Upload images below</p>
          </div>
        )}
        {totalCount > 1 && <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full z-10">{activeIndex + 1} / {totalCount}</div>}
        {totalCount > 1 && (
          <>
            <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:bg-white transition z-10">
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            </button>
            <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:bg-white transition z-10">
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </button>
          </>
        )}
      </div>

      {totalCount > 0 && <p className="text-xs mt-3 mb-1" style={{ color: "var(--text-muted)" }}>Drag to reorder — first image shows on public website</p>}

      {disabled ? (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
          {allItems.map((item, i) => (
            <SortableThumb key={item.key} item={item} index={i} total={totalCount} isActive={activeIndex === i} onClick={() => setActiveIndex(i)} disabled />
          ))}
        </div>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={allItems.map((img) => img.key)} strategy={rectSortingStrategy}>
            <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
              {allItems.map((item, i) => (
                <SortableThumb key={item.key} item={item} index={i} total={totalCount} isActive={activeIndex === i} onClick={() => setActiveIndex(i)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="mt-4">
        <input type="file" multiple accept="image/*" className="mt-4" disabled={disabled || processing} onChange={handleFileInput} />
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          {processing ? "Compressing images to WebP..." : "Click to upload photos here · PNG, JPG, or WEBP up to 10MB"}
        </p>

        {!disabled && onGalleryUrlsChange && (
          <div className="mt-4">
            <GalleryPicker
              multiSelect
              compact
              onSelectMultiple={(urls) => {
                const seen = new Set(existingImages.map((img) => img.image_url));
                const fresh = urls.filter((u) => !galleryUrls.includes(u) && !seen.has(u));
                if (fresh.length > 0) onGalleryUrlsChange([...galleryUrls, ...fresh]);
              }}
            />
          </div>
        )}
      </div>
      {totalCount > 0 && (
        <button onClick={handleRemoveSelected} disabled={disabled} className={`mt-3 text-sm ${disabled ? "text-gray-400 cursor-not-allowed" : "text-red-500 hover:text-red-700"}`}>Remove Selected Image</button>
      )}
    </div>
  );
}
