"use client";

import { useState, useEffect, useRef } from "react";
import API, { backendAssetUrl } from "@/lib/api";
import ImageProcessingModal, { type ImageSettings } from "@/components/admin/ImageProcessingModal";
import { useToast } from "@/components/Toast";

interface MediaFile {
  filename: string;
  url: string;
  size: number;
  last_modified: string;
}

interface GalleryPickerProps {
  currentImage?: string;
  onSelect: (url: string) => void;
  aspectRatio?: string;
  cropSettings?: ImageSettings;
  folder?: string;
  showPreview?: boolean;
  compact?: boolean;
  disabled?: boolean;
}

const DEFAULT_CROP: ImageSettings = { width: 1200, height: 675, quality: 0.8, brightness: 100, sharpness: 0 };

export default function GalleryPicker({
  currentImage,
  onSelect,
  aspectRatio,
  cropSettings,
  folder,
  showPreview = true,
  compact = false,
  disabled = false,
}: GalleryPickerProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFilename, setCropFilename] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    API.get("/admin/media").then((res) => {
      setFiles(res.data.files || []);
    }).catch(() => {
      toast("Failed to load media library", "error");
    }).finally(() => setLoading(false));
  }, [open, toast]);

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    if (folder) formData.append("folder", folder);
    const res = await API.post("/upload", formData, { withCredentials: true });
    return res.data.url;
  };

  const handleCropConfirm = async (file: File) => {
    setCropSrc(null);
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onSelect(url);
      setOpen(false);
    } catch {
      toast("Failed to upload image", "error");
    }
    setUploading(false);
  };

  const handleCropCancel = () => {
    setCropSrc(null);
    setCropFilename("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFilename(file.name);
    setCropSrc(URL.createObjectURL(file));
    e.target.value = "";
  };

  const defaultCrop = cropSettings || DEFAULT_CROP;

  return (
    <>
      <div className={disabled ? "pointer-events-none opacity-60" : ""}>
        {currentImage && showPreview ? (
          <div
            onClick={() => setOpen(true)}
            className="relative group cursor-pointer rounded-lg overflow-hidden border"
          >
            <img
              src={backendAssetUrl(currentImage)}
              alt="Selected"
              className="w-full object-cover"
              style={aspectRatio ? { aspectRatio } : { maxHeight: 200 }}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <span className="text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-lg">
                Change Image
              </span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`w-full border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-gray-400 hover:text-gray-500 transition flex flex-col items-center gap-1 ${compact ? "p-3" : "p-8"}`}
          >
            <svg className={compact ? "w-5 h-5" : "w-8 h-8"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className={compact ? "text-[11px]" : "text-sm"}>{compact ? "Select Image" : "Click to select or upload image"}</span>
          </button>
        )}
      </div>

      {/* MODAL */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* HEADER */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <h3 className="text-lg font-bold text-gray-800">Media Library</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {uploading ? "Uploading..." : "Upload New"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded hover:bg-gray-100 transition"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* BODY */}
            <div className="flex-1 overflow-y-auto p-5">
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
                </div>
              ) : files.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">No images yet. Click "Upload New" to add one.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {files.map((f) => (
                    <button
                      key={f.filename}
                      type="button"
                      onClick={() => {
                        onSelect(f.url);
                        setOpen(false);
                      }}
                      className={`group relative rounded-lg overflow-hidden border-2 aspect-square transition ${
                        currentImage === f.url
                          ? "border-[var(--primary)] ring-2 ring-[var(--primary)]"
                          : "border-gray-200 hover:border-blue-300"
                      }`}
                    >
                      <img
                        src={backendAssetUrl(f.url)}
                        alt={f.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition">
                        <p className="text-white text-[10px] truncate">{f.filename}</p>
                      </div>
                      {currentImage === f.url && (
                        <div className="absolute top-1.5 right-1.5 bg-[var(--primary)] text-white rounded-full p-0.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CROP MODAL */}
      {cropSrc && (
        <ImageProcessingModal
          src={cropSrc}
          filename={cropFilename}
          defaults={defaultCrop}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );
}
