"use client";

import { useEffect, useState, useRef } from "react";
import API, { backendAssetUrl } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/hooks/useConfirm";
import ImageCropperTool from "@/components/admin/ImageCropperTool";


interface GalleryFile {
  filename: string;
  url: string;
  size: number;
  last_modified: string;
  folder: string;
}

interface GalleryFolder {
  name: string;
  file_count: number;
}

type ViewMode = "grid" | "list";
type ThumbSize = "small" | "medium" | "big" | "bigger";

const GRID_COLS: Record<ThumbSize, string> = {
  small: "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10",
  medium: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  big: "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  bigger: "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3",
};

const FOLDER_GRID_COLS: Record<ThumbSize, string> = {
  small: "grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10",
  medium: "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8",
  big: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
  bigger: "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function GalleryPage() {
  const [folders, setFolders] = useState<GalleryFolder[]>([]);
  const [files, setFiles] = useState<GalleryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("grid");
  const [thumbSize, setThumbSize] = useState<ThumbSize>("medium");
  const [currentFolder, setCurrentFolder] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [cropTarget, setCropTarget] = useState<GalleryFile | null>(null);
  const [cropping, setCropping] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const loadGallery = () => {
    setLoading(true);
    API.get("/admin/gallery")
      .then((r) => {
        setFolders(r.data.folders || []);
        setFiles(r.data.files || []);
      })
      .catch(() => toast("Failed to load gallery", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadGallery(); }, []);

  const visibleFolders = currentFolder ? [] : folders;
  const visibleFiles = files.filter((f) => f.folder === currentFolder);

  const handleCreateFolder = async () => {
    const name = prompt("Enter folder name:");
    if (!name || !name.trim()) return;
    try {
      await API.post("/admin/gallery/folder", { name: name.trim() });
      toast("Folder created", "success");
      loadGallery();
    } catch {
      toast("Failed to create folder", "error");
    }
  };

  const handleRenameFolder = async (oldName: string) => {
    const newName = prompt("Rename folder to:", oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    try {
      await API.put("/admin/gallery/folder", { old_name: oldName, new_name: newName.trim() });
      toast("Folder renamed", "success");
      loadGallery();
    } catch {
      toast("Failed to rename folder", "error");
    }
  };

  const handleDeleteFolder = async (name: string) => {
    const ok = await confirm({ title: `Delete folder "${name}"?`, message: "Only empty folders can be deleted." });
    if (!ok) return;
    try {
      await API.delete("/admin/gallery/folder", { data: { name } });
      toast("Folder deleted", "success");
      loadGallery();
    } catch {
      toast("Failed to delete folder", "error");
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    for (const f of files) formData.append("files", f);
    if (currentFolder) formData.append("folder", currentFolder);
    try {
      const res = await API.post("/admin/gallery/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      const count = res.data.uploaded?.length || 0;
      if (count > 0) toast(`Uploaded ${count} file${count !== 1 ? "s" : ""}`, "success");
      if (res.data.errors?.length > 0) toast(`${res.data.errors.length} file${res.data.errors.length !== 1 ? "s" : ""} failed`, "error");
      loadGallery();
    } catch {
      toast("Upload failed", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleSelection = (url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedUrls(new Set(visibleFiles.map((f) => f.url)));
  };

  const deselectAll = () => {
    setSelectedUrls(new Set());
  };

  const handleDeleteFiles = async (urls: string[]) => {
    const ok = await confirm({ title: `Delete ${urls.length} file${urls.length !== 1 ? "s" : ""}?`, message: "This cannot be undone." });
    if (!ok) return;
    try {
      const res = await API.delete("/admin/gallery/file", { data: { urls } });
      const deleted = res.data.deleted?.length || 0;
      const errors = res.data.errors?.length || 0;
      if (deleted > 0) toast(`Deleted ${deleted} file${deleted !== 1 ? "s" : ""}`, "success");
      if (errors > 0) toast(`${errors} file${errors !== 1 ? "s" : ""} could not be deleted`, "error");
      setSelectedUrls(new Set());
      loadGallery();
    } catch {
      toast("Failed to delete files", "error");
    }
  };

  const handleRename = async (oldUrl: string, currentName: string) => {
    const newName = prompt("Rename file:", currentName);
    if (!newName || !newName.trim() || newName.trim() === currentName) return;
    try {
      const res = await API.put("/admin/gallery/file", { old_url: oldUrl, new_name: newName.trim() });
      toast(`Renamed to ${res.data.new_url.split("/").pop()} (${res.data.updates} DB record${res.data.updates !== 1 ? "s" : ""} updated)`, "success");
      loadGallery();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to rename file", "error");
    }
  };

  const allSelected = visibleFiles.length > 0 && selectedUrls.size === visibleFiles.length;

  const handleCropConfirm = async (file: File) => {
    if (!cropTarget) return;
    setCropping(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("old_url", cropTarget.url);
    try {
      const res = await API.post("/admin/gallery/file/crop", formData, { headers: { "Content-Type": "multipart/form-data" } });
      toast(`Cropped → ${res.data.new_url.split("/").pop()}`, "success");
      setCropTarget(null);
      loadGallery();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to crop image", "error");
    } finally {
      setCropping(false);
    }
  };

  const fileCount = visibleFiles.length;
  const folderCount = visibleFolders.length;
  const selCount = selectedUrls.size;

  return (
    <div className="p-4 md:p-6">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gallery</h1>
          <p className="text-sm text-gray-500 mt-1">
            {currentFolder ? `Folder: ${currentFolder}` : `All uploaded images (${fileCount} file${fileCount !== 1 ? "s" : ""}${folderCount ? `, ${folderCount} folder${folderCount !== 1 ? "s" : ""}` : ""})`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!currentFolder && (
            <button
              onClick={handleCreateFolder}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-dashed border-gray-300 hover:border-gray-400 text-gray-600 rounded-lg text-sm transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Folder
            </button>
          )}
          {selCount > 0 && (
            <button
              onClick={() => handleDeleteFiles([...selectedUrls])}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Selected ({selCount})
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--primary-hover)] transition disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {uploading ? "Uploading..." : "Upload Image"}
          </button>
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            <button
              onClick={() => setView("grid")}
              className={`p-2 rounded ${view === "grid" ? "bg-gray-100 text-gray-800" : "text-gray-400 hover:text-gray-600"}`}
              title="Grid view"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-2 rounded ${view === "list" ? "bg-gray-100 text-gray-800" : "text-gray-400 hover:text-gray-600"}`}
              title="List view"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
          {/* Size toggle */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {(["small", "medium", "big", "bigger"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setThumbSize(s)}
                className={`px-2 py-1.5 rounded text-xs font-medium transition ${
                  thumbSize === s ? "bg-gray-100 text-gray-800" : "text-gray-400 hover:text-gray-600"
                }`}
                title={`${s} thumbnails`}
              >
                {s === "small" ? "S" : s === "medium" ? "M" : s === "big" ? "B" : "XL"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* BREADCRUMB / FOLDER NAV */}
      {currentFolder && (
        <div className="flex items-center gap-2 text-sm mb-4">
          <button onClick={() => { setCurrentFolder(""); setSelectedUrls(new Set()); }} className="text-blue-600 hover:underline">All Images</button>
          <span className="text-gray-400">/</span>
          <span className="text-gray-700 font-medium">{currentFolder}</span>
        </div>
      )}

      {/* FOLDERS */}
      {!currentFolder && visibleFolders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Folders</h2>
          {view === "grid" ? (
            <div className={`grid gap-2 ${FOLDER_GRID_COLS[thumbSize]}`}>
              {visibleFolders.map((f) => (
                <div
                  key={f.name}
                  className="bg-white border border-gray-200 rounded-lg p-2.5 hover:shadow-md transition group relative"
                >
                  <button
                    onClick={() => { setCurrentFolder(f.name); setSelectedUrls(new Set()); }}
                    className="flex flex-col items-center gap-1 w-full text-center"
                  >
                    <svg className={`text-yellow-500 ${thumbSize === "small" ? "w-5 h-5" : thumbSize === "bigger" ? "w-10 h-10" : "w-7 h-7"}`} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-800 truncate w-full">{f.name}</span>
                    <span className="text-xs text-gray-400">{f.file_count} file{f.file_count !== 1 ? "s" : ""}</span>
                  </button>
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRenameFolder(f.name); }}
                      className="p-1 bg-white border border-gray-200 rounded hover:bg-gray-100 text-gray-500"
                      title="Rename"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f.name); }}
                      className="p-1 bg-white border border-gray-200 rounded hover:bg-red-50 text-red-500"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-3 font-semibold text-gray-600">Folder</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Files</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleFolders.map((f) => (
                    <tr key={f.name} className="hover:bg-gray-50 transition group">
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => { setCurrentFolder(f.name); setSelectedUrls(new Set()); }}
                          className="flex items-center gap-2 text-blue-600 hover:underline font-medium"
                        >
                          <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                          </svg>
                          {f.name}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-sm">{f.file_count} file{f.file_count !== 1 ? "s" : ""}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRenameFolder(f.name); }}
                            className="p-1.5 text-gray-400 hover:text-gray-600"
                            title="Rename"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f.name); }}
                            className="p-1.5 text-gray-400 hover:text-red-500"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SEPARATOR */}
      {!currentFolder && visibleFolders.length > 0 && visibleFiles.length > 0 && (
        <hr className="border-t border-gray-200 my-4" />
      )}

      {/* FILES HEADER */}
      {visibleFiles.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => allSelected ? deselectAll() : selectAll()}
              className="w-4 h-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
            />
            <span className="text-sm text-gray-500">{selCount > 0 ? `${selCount} selected` : "Select all"}</span>
          </div>
        </div>
      )}

      {/* FILES */}
      {loading ? (
        <p className="text-sm text-gray-400 py-12 text-center">Loading images...</p>
      ) : visibleFiles.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center">No images in this location.</p>
      ) : view === "grid" ? (
        <div className={`grid gap-4 ${GRID_COLS[thumbSize]}`}>
          {visibleFiles.map((f) => (
            <div key={f.url} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition group relative">
              <div className="absolute top-2 left-2 z-10">
                <input
                  type="checkbox"
                  checked={selectedUrls.has(f.url)}
                  onChange={() => toggleSelection(f.url)}
                  className="w-4 h-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                />
              </div>
              <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => { setCropTarget(f); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }}
                  className="p-1.5 bg-white/80 hover:bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-[var(--primary)]"
                  title="Crop"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9.5V6a1 1 0 011-1h3.5M18 14.5V18a1 1 0 01-1 1h-3.5M9.5 6H18a1 1 0 011 1v8.5M6 9.5h8.5a1 1 0 011 1V19" />
                  </svg>
                </button>
                <button
                  onClick={() => handleRename(f.url, f.filename)}
                  className="p-1.5 bg-white/80 hover:bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-blue-600"
                  title="Rename"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteFiles([f.url])}
                  className="p-1.5 bg-white/80 hover:bg-white border border-gray-200 rounded-lg text-red-500"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <a href={backendAssetUrl(f.url)} target="_blank" rel="noopener noreferrer" className="block">
                <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                  <img
                    src={backendAssetUrl(f.url)}
                    alt={f.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </a>
              <div className="p-2.5">
                <p className="text-xs font-medium text-gray-800 truncate" title={f.filename}>{f.filename}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatSize(f.size)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => allSelected ? deselectAll() : selectAll()}
                    className="w-4 h-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600">Preview</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Filename</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Size</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Last Modified</th>
                <th className="px-4 py-3 font-semibold text-gray-600 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleFiles.map((f) => (
                <tr key={f.url} className="hover:bg-gray-50 transition group">
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedUrls.has(f.url)}
                      onChange={() => toggleSelection(f.url)}
                      className="w-4 h-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <a href={backendAssetUrl(f.url)} target="_blank" rel="noopener noreferrer">
                      <div className="w-12 h-12 bg-gray-50 rounded-lg overflow-hidden">
                        <img
                          src={backendAssetUrl(f.url)}
                          alt={f.filename}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    </a>
                  </td>
                  <td className="px-4 py-2.5">
                    <a href={backendAssetUrl(f.url)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                      {f.filename}
                    </a>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{formatSize(f.size)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{formatDate(f.last_modified)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => { setCropTarget(f); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }}
                        className="p-1.5 text-gray-400 hover:text-[var(--primary)]"
                        title="Crop"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9.5V6a1 1 0 011-1h3.5M18 14.5V18a1 1 0 01-1 1h-3.5M9.5 6H18a1 1 0 011 1v8.5M6 9.5h8.5a1 1 0 011 1V19" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRename(f.url, f.filename)}
                        className="p-1.5 text-gray-400 hover:text-blue-600"
                        title="Rename"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteFiles([f.url])}
                        className="p-1.5 text-gray-400 hover:text-red-500"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CROP TOOL */}
      {cropTarget && (
        <div className="mt-6 border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Crop Image</h2>
              <p className="text-sm text-gray-500 mt-1">Cropping: {cropTarget.filename}</p>
            </div>
            <button
              onClick={() => setCropTarget(null)}
              disabled={cropping}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          <ImageCropperTool
            initialSrc={backendAssetUrl(cropTarget.url)}
            filenameHint={cropTarget.filename}
            defaultW={1200}
            defaultH={800}
            onConfirm={handleCropConfirm}
          />
          {cropping && <p className="text-sm text-gray-500 mt-3">Uploading cropped image...</p>}
        </div>
      )}

    </div>
  );
}
