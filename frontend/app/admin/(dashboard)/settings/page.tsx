"use client";

import { useEffect, useState } from "react";
import API, { backendAssetUrl } from "@/lib/api";
import GalleryPicker from "@/components/admin/GalleryPicker";
import { useToast } from "@/components/Toast";

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    API.get("/admin/settings")
      .then((res) => setSettings(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const clean = Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, v ?? ""]));
      await API.put("/admin/settings", clean);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast("Failed to save settings", "error");
    }
    setSaving(false);
  };

  if (loading) return <div className="p-3 md:p-6">Loading...</div>;

  return (
    <div className="p-3 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
      <p className="text-sm text-gray-500 mt-1 mb-4 md:mb-6">Configure site name, logo, brand colors, social links, and session settings</p>

      {/* GENERAL */}
      <div className="bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6">
        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">General</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Website Name</label>
          <input
            type="text"
            value={settings.site_name || ""}
            onChange={(e) => handleChange("site_name", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>

          <div className="mb-3 max-w-[200px]">
        <GalleryPicker
          currentImage={settings.site_logo}
          onSelect={(url) => {
            setSettings((prev) => ({ ...prev, site_logo: url }));
            setSaved(false);
          }}
          cropSettings={{ width: 512, height: 512, quality: 0.85, brightness: 100, sharpness: 0 }}
          folder="settings"
        />
          </div>

          {/* MANUAL URL OVERRIDE */}
          <input
            type="text"
            value={settings.site_logo || ""}
            onChange={(e) => handleChange("site_logo", e.target.value)}
            placeholder="Or paste logo URL directly"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* COLORS */}
      <div className="bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6">
        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Brand Colors</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={settings.primary_color || "#0f4cba"}
                onChange={(e) => handleChange("primary_color", e.target.value)}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <input
                type="text"
                value={settings.primary_color || ""}
                onChange={(e) => handleChange("primary_color", e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={settings.secondary_color || "#1e40af"}
                onChange={(e) => handleChange("secondary_color", e.target.value)}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <input
                type="text"
                value={settings.secondary_color || ""}
                onChange={(e) => handleChange("secondary_color", e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* COLOR PREVIEW */}
        <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: settings.primary_color || "#0f4cba" }}>
          <p className="text-white font-semibold">Primary Color Preview</p>
          <p className="text-white/80 text-sm">This is how your primary color looks</p>
        </div>
      </div>

      {/* SOCIAL LINKS */}
      <div className="bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6">
        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Social Media Links</h2>
        <p className="text-xs md:text-sm text-gray-500 mb-3 md:mb-4">These will be displayed in the footer. Leave blank to hide.</p>

        <div className="space-y-3">
          {[
            { key: "social_facebook", label: "Facebook", placeholder: "https://facebook.com/..." },
            { key: "social_instagram", label: "Instagram", placeholder: "https://instagram.com/..." },
            { key: "social_twitter", label: "Twitter / X", placeholder: "https://twitter.com/..." },
            { key: "social_youtube", label: "YouTube", placeholder: "https://youtube.com/..." },
            { key: "social_linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/..." },
          ].map((social) => (
            <div key={social.key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <label className="sm:w-28 text-sm font-medium text-gray-700 shrink-0">
                {social.label}
              </label>
              <input
                type="url"
                value={settings[social.key] || ""}
                onChange={(e) => handleChange(social.key, e.target.value)}
                placeholder={social.placeholder}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
      </div>

      {/* LOCATION TAGS VISIBILITY */}
      <div className="bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6">
        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Location Tags</h2>
        <p className="text-xs md:text-sm text-gray-500 mb-3 md:mb-4">Show location chips above the footer on all public pages.</p>
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            onClick={() => handleChange("section_locations_visible", settings.section_locations_visible === "true" ? "false" : "true")}
            className={`w-10 h-5 rounded-full flex items-center p-0.5 transition shrink-0 ${
              settings.section_locations_visible !== "false" ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <div className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
              settings.section_locations_visible !== "false" ? "translate-x-5" : ""
            }`} />
          </button>
          <span className="text-sm text-gray-700">
            {settings.section_locations_visible !== "false" ? "Visible on all pages" : "Hidden"}
          </span>
        </label>
      </div>

      {/* ADMIN SESSION */}
      <div className="bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6">
        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Admin Session</h2>
        <p className="text-xs md:text-sm text-gray-500 mb-3 md:mb-4">Configure how long an admin session stays active before auto-logout due to inactivity.</p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="sm:w-48 text-sm font-medium text-gray-700 shrink-0">
            Session Timeout (minutes)
          </label>
          <div className="flex items-center gap-3 flex-1">
            <input
              type="range"
              min="1"
              max="120"
              step="1"
              value={settings.session_timeout_minutes || "30"}
              onChange={(e) => handleChange("session_timeout_minutes", e.target.value)}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="number"
                min="1"
                max="120"
                value={settings.session_timeout_minutes || "30"}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(120, parseInt(e.target.value) || 30));
                  handleChange("session_timeout_minutes", String(v));
                }}
                className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-500">min</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {[5, 10, 15, 30, 60, 120].map((mins) => (
            <button
              key={mins}
              onClick={() => handleChange("session_timeout_minutes", String(mins))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                String(settings.session_timeout_minutes || "30") === String(mins)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-center mt-6 pt-4 border-t">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-6 py-2.5 rounded-lg text-white font-medium transition ${
            saved
              ? "bg-green-500"
              : "bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
          }`}
        >
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
