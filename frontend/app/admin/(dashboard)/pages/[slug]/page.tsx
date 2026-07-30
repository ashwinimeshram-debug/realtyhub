"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import API from "@/lib/api";
import DOMPurify from "dompurify";

export default function AdminPageEditor({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    API.get(`/admin/pages/${slug}`)
      .then((res) => {
        setTitle(res.data.title || "");
        setContent(res.data.content || "");
      })
      .catch(() => setError("Failed to load page"))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await API.put(`/admin/pages/${slug}`, { title, content });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Failed to save page");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-400 text-sm">Loading page...</div>;
  }

  if (error && !title) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => router.push("/admin/pages")}
          className="text-[var(--primary)] underline"
        >
          Back to Pages
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-800 capitalize mb-1">{slug}</h1>
      <p className="text-sm text-gray-500 mb-4">Edit page title and content</p>

      <div className="flex items-center gap-3 mb-4 text-sm text-gray-400">
        <button
          onClick={() => router.push("/admin/pages")}
          className="hover:text-[var(--primary)] transition"
        >
          Pages
        </button>
        <span>/</span>
        <span className="text-gray-600 capitalize">{slug}</span>
      </div>

      <div className="bg-white border rounded-xl p-5 md:p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Page Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="Page title"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Page Content{" "}
            <span className="text-gray-400 font-normal">(HTML allowed)</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={20}
            className="w-full border rounded-lg px-4 py-3 text-sm font-mono leading-relaxed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
            placeholder="<h2>Section Title</h2><p>Your content here...</p>"
          />
        </div>

        <div className="mb-6">
          <p className="text-xs text-gray-400 mb-2 font-medium">Preview</p>
          <div
            className="prose prose-sm max-w-none border rounded-lg p-4 bg-gray-50 text-gray-700"
            dangerouslySetInnerHTML={{ __html: typeof DOMPurify?.sanitize === "function" ? DOMPurify.sanitize(content || "<p class='text-gray-400'>No content yet</p>") : content }}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium">
              ✓ Saved successfully
            </span>
          )}
          {error && (
            <span className="text-sm text-red-500">{error}</span>
          )}
        </div>
      </div>
    </div>
  );
}
