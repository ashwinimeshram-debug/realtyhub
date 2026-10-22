"use client";

import { useEffect, useState } from "react";
import API, { backendAssetUrl } from "@/lib/api";
import GalleryPicker from "@/components/admin/GalleryPicker";
import { useToast } from "@/components/Toast";

type TabKey = "general" | "seo" | "messaging" | "payments" | "automation" | "ai" | "security";

const TABS: { key: TabKey; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    key: "general",
    label: "General",
    hint: "Site identity, brand colors, social links and location tags",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
  },
  {
    key: "seo",
    label: "SEO",
    hint: "Search metadata, verification and share caption",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
      </svg>
    ),
  },
  {
    key: "messaging",
    label: "Email & Messaging",
    hint: "SMTP email and WhatsApp sending",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: "payments",
    label: "Listings & Payments",
    hint: "Paid listing prices, validity and payment gateway",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: "automation",
    label: "Automation",
    hint: "Automatic lead and listing workflows",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    key: "ai",
    label: "AI Configuration",
    hint: "Connect an AI provider for listing copy generation",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-6.36l-1.42 1.42M7.05 16.95l-1.41 1.41m12.72 0l-1.42-1.41M7.05 7.05L5.64 5.64M12 8a4 4 0 100 8 4 4 0 000-8z" />
      </svg>
    ),
  },
  {
    key: "security",
    label: "Security & Data",
    hint: "Admin session timeout and DPDP data retention",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z" />
      </svg>
    ),
  },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [aiModels, setAiModels] = useState<{ id: string; label: string }[]>([]);
  const [aiModelsLoading, setAiModelsLoading] = useState(false);
  const [aiModelsError, setAiModelsError] = useState("");
  const [aiDefaultModel, setAiDefaultModel] = useState("");

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

  const handleTestAi = async () => {
    setAiTesting(true);
    setAiTestResult(null);
    try {
      const res = await API.post("/ai/test", {});
      const d = res.data || {};
      setAiTestResult({
        ok: !!d.ok,
        message: d.ok
          ? `Connection successful — ${d.provider} (${d.model}).`
          : d.error || "AI test failed.",
      });
    } catch (err: any) {
      const d = err?.response?.data;
      setAiTestResult({ ok: false, message: d?.error || "AI test failed." });
    }
    setAiTesting(false);
  };

  const handleLoadModels = async () => {
    setAiModelsLoading(true);
    setAiModelsError("");
    setAiModels([]);
    try {
      const res = await API.post("/ai/models", {
        provider: settings.ai_provider || "openai",
        api_key: settings.ai_api_key || "",
      });
      const d = res.data || {};
      setAiModels(d.models || []);
      setAiDefaultModel(d.default || "");
      if (!d.models || d.models.length === 0) {
        setAiModelsError("No usable models were returned for this key.");
      }
    } catch (err: any) {
      const d = err?.response?.data;
      setAiModelsError(d?.error || "Failed to load models.");
    }
    setAiModelsLoading(false);
  };

  if (loading) return <div className="p-3 md:p-6">Loading...</div>;

  const show = (tab: TabKey) => activeTab === tab;
  const activeTabMeta = TABS.find((t) => t.key === activeTab);

  return (
    <div className="p-3 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        {activeTabMeta?.hint || "Configure your website"}
      </p>

      {/* TAB NAVIGATION */}
      <div className="flex flex-wrap gap-2 mb-5 md:mb-6">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border transition ${
                active
                  ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* GENERAL */}
      <div className={`bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6 ${show("general") ? "" : "hidden"}`}>
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
      <div className={`bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6 ${show("general") ? "" : "hidden"}`}>
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
      <div className={`bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6 ${show("general") ? "" : "hidden"}`}>
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
      <div className={`bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6 ${show("general") ? "" : "hidden"}`}>
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

      {/* SEO & VERIFICATION */}
      <div className={`bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6 ${show("seo") ? "" : "hidden"}`}>
        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">SEO &amp; Verification</h2>
        <p className="text-xs md:text-sm text-gray-500 mb-4">
          Optional identifiers used in structured data and search engine verification tags.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Meta Description</label>
          <textarea
            value={settings.seo_default_description || ""}
            onChange={(e) => handleChange("seo_default_description", e.target.value)}
            rows={2}
            placeholder="Verified properties for sale and rent in Nagpur..."
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">RERA License (agent/project)</label>
          <input
            type="text"
            value={settings.rera_license || ""}
            onChange={(e) => handleChange("rera_license", e.target.value)}
            placeholder="e.g. A51800012345"
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Google Site Verification</label>
            <input
              type="text"
              value={settings.seo_google_verification || ""}
              onChange={(e) => handleChange("seo_google_verification", e.target.value)}
              placeholder="google-site-verification content value"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bing Site Verification</label>
            <input
              type="text"
              value={settings.seo_bing_verification || ""}
              onChange={(e) => handleChange("seo_bing_verification", e.target.value)}
              placeholder="msvalidate.01 content value"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* SOCIAL SHARE CAPTION */}
      <div className={`bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6 ${show("seo") ? "" : "hidden"}`}>
        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Social Share Caption</h2>
        <p className="text-xs md:text-sm text-gray-500 mb-3 md:mb-4">
          {"Default caption used when sharing a property. Use {title}, {price}, {location} and {url} as placeholders. Leave blank to use the default wording."}
        </p>
        <textarea
          value={settings.share_caption_template || ""}
          onChange={(e) => handleChange("share_caption_template", e.target.value)}
          rows={4}
          placeholder={"🏠 {title}\n💰 {price}\n📍 {location}\n\nView details: {url}"}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* ADMIN SESSION */}
      <div className={`bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6 ${show("security") ? "" : "hidden"}`}>
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

      {/* EMAIL (SMTP) */}
      <div className={`bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6 ${show("messaging") ? "" : "hidden"}`}>
        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Email (SMTP)</h2>
        <p className="text-xs md:text-sm text-gray-500 mb-3 md:mb-4">
          Used for sending verification links, password resets and owner/visitor notifications.
          For your hosting mailbox use SSL on port 465 (e.g. <span className="font-medium text-gray-700">mail.plotandroof.com</span>);
          for Gmail use STARTTLS on port 587 with an <span className="font-medium text-gray-700">App Password</span>.
        </p>

        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <button
            type="button"
            onClick={() => handleChange("mail_enabled", settings.mail_enabled === "true" ? "false" : "true")}
            className={`w-10 h-5 rounded-full flex items-center p-0.5 transition shrink-0 ${
              settings.mail_enabled !== "false" ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <div className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
              settings.mail_enabled !== "false" ? "translate-x-5" : ""
            }`} />
          </button>
          <span className="text-sm text-gray-700 font-medium">
            {settings.mail_enabled !== "false" ? "Email sending enabled" : "Email sending disabled"}
          </span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Server</label>
            <input
              type="text"
              value={settings.mail_server || ""}
              onChange={(e) => handleChange("mail_server", e.target.value)}
              placeholder="smtp.gmail.com"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
            <input
              type="number"
              value={settings.mail_port || ""}
              onChange={(e) => handleChange("mail_port", e.target.value)}
              placeholder="587"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username (SMTP Login)</label>
            <input
              type="text"
              value={settings.mail_username || ""}
              onChange={(e) => handleChange("mail_username", e.target.value)}
              placeholder="info@example.com"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">App Password</label>
            <input
              type="password"
              value={settings.mail_password || ""}
              onChange={(e) => handleChange("mail_password", e.target.value)}
              placeholder="Leave blank to keep the saved password"
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sender (From Address)</label>
            <input
              type="text"
              value={settings.mail_sender || ""}
              onChange={(e) => handleChange("mail_sender", e.target.value)}
              placeholder="info@example.com"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                onClick={() => handleChange("mail_use_tls", settings.mail_use_tls !== "false" ? "false" : "true")}
                className={`w-10 h-5 rounded-full flex items-center p-0.5 transition shrink-0 ${
                  settings.mail_use_tls !== "false" ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
                  settings.mail_use_tls !== "false" ? "translate-x-5" : ""
                }`} />
              </button>
              <span className="text-sm text-gray-700">
                {settings.mail_use_tls !== "false" ? "Use STARTTLS (port 587)" : "No STARTTLS"}
              </span>
            </label>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                onClick={() => handleChange("mail_use_ssl", settings.mail_use_ssl === "true" ? "false" : "true")}
                className={`w-10 h-5 rounded-full flex items-center p-0.5 transition shrink-0 ${
                  settings.mail_use_ssl === "true" ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
                  settings.mail_use_ssl === "true" ? "translate-x-5" : ""
                }`} />
              </button>
              <span className="text-sm text-gray-700">
                {settings.mail_use_ssl === "true" ? "Use SSL (port 465)" : "No SSL"}
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* WHATSAPP */}
      <div className={`bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6 ${show("messaging") ? "" : "hidden"}`}>
        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">WhatsApp Messaging</h2>
        <p className="text-xs md:text-sm text-gray-500 mb-3 md:mb-4">
          Send lead and saved-search alerts over WhatsApp. Choose a provider and enter its
          credentials. Leave disabled to log messages only.
        </p>

        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <button
            type="button"
            onClick={() => handleChange("whatsapp_enabled", settings.whatsapp_enabled === "true" ? "false" : "true")}
            className={`w-10 h-5 rounded-full flex items-center p-0.5 transition shrink-0 ${
              settings.whatsapp_enabled === "true" ? "bg-green-600" : "bg-gray-300"
            }`}
          >
            <div className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
              settings.whatsapp_enabled === "true" ? "translate-x-5" : ""
            }`} />
          </button>
          <span className="text-sm text-gray-700 font-medium">
            {settings.whatsapp_enabled === "true" ? "WhatsApp sending enabled" : "WhatsApp sending disabled"}
          </span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <select
              value={settings.whatsapp_provider || "log"}
              onChange={(e) => handleChange("whatsapp_provider", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="log">Log only (disabled)</option>
              <option value="meta">Meta WhatsApp Cloud API</option>
              <option value="twilio">Twilio</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sender Number (with country code)</label>
            <input
              type="text"
              value={settings.whatsapp_from || ""}
              onChange={(e) => handleChange("whatsapp_from", e.target.value)}
              placeholder="+919876543210"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {settings.whatsapp_provider === "meta" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number ID</label>
                <input
                  type="text"
                  value={settings.whatsapp_phone_number_id || ""}
                  onChange={(e) => handleChange("whatsapp_phone_number_id", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
                <input
                  type="password"
                  value={settings.whatsapp_access_token || ""}
                  onChange={(e) => handleChange("whatsapp_access_token", e.target.value)}
                  placeholder="Leave blank to keep the saved token"
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Graph API Version</label>
                <input
                  type="text"
                  value={settings.whatsapp_api_version || ""}
                  onChange={(e) => handleChange("whatsapp_api_version", e.target.value)}
                  placeholder="v21.0"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}
          {settings.whatsapp_provider === "twilio" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Twilio Account SID</label>
                <input
                  type="text"
                  value={settings.twilio_account_sid || ""}
                  onChange={(e) => handleChange("twilio_account_sid", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Twilio Auth Token</label>
                <input
                  type="password"
                  value={settings.twilio_auth_token || ""}
                  onChange={(e) => handleChange("twilio_auth_token", e.target.value)}
                  placeholder="Leave blank to keep the saved token"
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Twilio WhatsApp From</label>
                <input
                  type="text"
                  value={settings.twilio_whatsapp_from || ""}
                  onChange={(e) => handleChange("twilio_whatsapp_from", e.target.value)}
                  placeholder="+14155238886"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* AUTOMATION */}
      <div className={`bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6 ${show("automation") ? "" : "hidden"}`}>
        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Automation</h2>
        <p className="text-xs md:text-sm text-gray-500 mb-3 md:mb-4">
          Control automatic workflows for new leads and property listings.
        </p>

        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <button
            type="button"
            onClick={() => handleChange("auto_assign_leads", settings.auto_assign_leads !== "true" ? "true" : "false")}
            className={`w-10 h-5 rounded-full flex items-center p-0.5 transition shrink-0 ${
              settings.auto_assign_leads === "true" ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <div className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
              settings.auto_assign_leads === "true" ? "translate-x-5" : ""
            }`} />
          </button>
          <div className="flex-1">
            <p className="text-sm text-gray-700 font-medium">Auto-assign new leads</p>
            <p className="text-xs text-gray-500">Automatically assign new leads to the least-loaded executive.</p>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            onClick={() => handleChange("auto_approve_properties", settings.auto_approve_properties === "true" ? "false" : "true")}
            className={`w-10 h-5 rounded-full flex items-center p-0.5 transition shrink-0 ${
              settings.auto_approve_properties === "true" ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <div className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
              settings.auto_approve_properties === "true" ? "translate-x-5" : ""
            }`} />
          </button>
          <div className="flex-1">
            <p className="text-sm text-gray-700 font-medium">Auto-approve new properties</p>
            <p className="text-xs text-gray-500">
              When on, new property submissions are published directly to the website without admin approval. When off, they require approval.
            </p>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <button
            type="button"
            onClick={() => handleChange("allow_public_post", settings.allow_public_post === "false" ? "true" : "false")}
            className={`w-10 h-5 rounded-full flex items-center p-0.5 transition shrink-0 ${
              settings.allow_public_post !== "false" ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <div className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
              settings.allow_public_post !== "false" ? "translate-x-5" : ""
            }`} />
          </button>
          <div className="flex-1">
            <p className="text-sm text-gray-700 font-medium">Allow public post</p>
            <p className="text-xs text-gray-500">
              When on, the Sign In and Post Property menus are shown on the public website, letting visitors register and list properties. When off, the public site is browse-only and only admins/employees can post.
            </p>
          </div>
        </label>
      </div>

      {/* LISTINGS & PAYMENTS */}
      <div className={`bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6 ${show("payments") ? "" : "hidden"}`}>
        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Listings &amp; Payments</h2>
        <p className="text-xs md:text-sm text-gray-500 mb-3 md:mb-4">
          Control paid listing publication, prices, validity periods and the payment gateway.
        </p>

        <label className="flex items-center gap-3 cursor-pointer mb-5">
          <button
            type="button"
            onClick={() => handleChange("require_listing_payment", settings.require_listing_payment === "true" ? "false" : "true")}
            className={`w-10 h-5 rounded-full flex items-center p-0.5 transition shrink-0 ${
              settings.require_listing_payment === "true" ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <div className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
              settings.require_listing_payment === "true" ? "translate-x-5" : ""
            }`} />
          </button>
          <div className="flex-1">
            <p className="text-sm text-gray-700 font-medium">Require payment to publish</p>
            <p className="text-xs text-gray-500">
              When on, submitted listings stay hidden until the owner pays. When off (free-listing promotion), listings publish immediately at no cost.
            </p>
          </div>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sell listing price</label>
            <input type="number" min={0} value={settings.listing_sell_price || "999"}
              onChange={(e) => handleChange("listing_sell_price", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sell validity (days)</label>
            <input type="number" min={1} value={settings.listing_sell_days || "90"}
              onChange={(e) => handleChange("listing_sell_days", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rent listing price</label>
            <input type="number" min={0} value={settings.listing_rent_price || "499"}
              onChange={(e) => handleChange("listing_rent_price", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rent validity (days)</label>
            <input type="number" min={1} value={settings.listing_rent_days || "30"}
              onChange={(e) => handleChange("listing_rent_days", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Featured add-on price</label>
            <input type="number" min={0} value={settings.featured_price || "299"}
              onChange={(e) => handleChange("featured_price", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Featured duration (days)</label>
            <input type="number" min={1} value={settings.featured_days || "30"}
              onChange={(e) => handleChange("featured_days", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bundle discount on Featured add-on (%)</label>
            <input type="number" min={0} max={100} value={settings.featured_bundle_discount_percent || "30"}
              onChange={(e) => handleChange("featured_bundle_discount_percent", e.target.value)}
              placeholder="30"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-500 mt-1">
              Discount applied to the Featured add-on when an owner bundles it with a listing payment.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grace period (days)</label>
            <input type="number" min={0} value={settings.listing_grace_days || "7"}
              onChange={(e) => handleChange("listing_grace_days", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expiry reminder days</label>
            <input type="text" value={settings.listing_expiry_reminder_days || "15,7,3,1"}
              onChange={(e) => handleChange("listing_expiry_reminder_days", e.target.value)}
              placeholder="15,7,3,1"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment provider</label>
            <select value={settings.payment_provider || "mock"}
              onChange={(e) => handleChange("payment_provider", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="mock">Mock (development — no real payment)</option>
              <option value="razorpay">Razorpay</option>
              <option value="stripe">Stripe</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <input type="text" value={settings.payment_currency || "INR"}
              onChange={(e) => handleChange("payment_currency", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {(settings.payment_provider === "razorpay" || settings.payment_provider === "stripe") && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Public key / Key ID</label>
                <input type="text" value={settings.payment_key_id || ""}
                  onChange={(e) => handleChange("payment_key_id", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secret key</label>
                <input type="password" value={settings.payment_key_secret || ""}
                  onChange={(e) => handleChange("payment_key_secret", e.target.value)}
                  placeholder="Leave blank to keep the saved secret"
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Webhook signing secret</label>
                <input type="password" value={settings.payment_webhook_secret || ""}
                  onChange={(e) => handleChange("payment_webhook_secret", e.target.value)}
                  placeholder="Leave blank to keep the saved secret"
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* AI CONFIGURATION */}
      <div className={`bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6 ${show("ai") ? "" : "hidden"}`}>
        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">AI Configuration</h2>
        <p className="text-xs md:text-sm text-gray-500 mb-4">
          Powers the &ldquo;Generate with AI&rdquo; button in the listing forms. Connect OpenAI
          (ChatGPT), Anthropic (Claude) or Google (Gemini) using your own API key. Without a key,
          listing copy falls back to a built-in template.
        </p>

        <label className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            checked={settings.ai_enabled !== "false"}
            onChange={(e) => handleChange("ai_enabled", e.target.checked ? "true" : "false")}
            className="h-4 w-4"
          />
          <span className="text-sm text-gray-700 font-medium">Enable AI copy generation</span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <label className="block">
            <span className="text-sm text-gray-700 font-medium">Provider</span>
            <select
              value={settings.ai_provider || "openai"}
              onChange={(e) => {
                handleChange("ai_provider", e.target.value);
                setAiModels([]);
                setAiModelsError("");
                setAiTestResult(null);
              }}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="openai">OpenAI (ChatGPT)</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="gemini">Google (Gemini)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-gray-700 font-medium">Model</span>
            <div className="mt-1 flex gap-2">
              {aiModels.length > 0 ? (
                <select
                  value={settings.ai_model || ""}
                  onChange={(e) => handleChange("ai_model", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">Default ({aiDefaultModel || "provider default"})</option>
                  {aiModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={settings.ai_model || ""}
                  onChange={(e) => handleChange("ai_model", e.target.value)}
                  placeholder={
                    settings.ai_provider === "anthropic"
                      ? "claude-3-5-haiku-latest"
                      : settings.ai_provider === "gemini"
                      ? "gemini-2.5-flash"
                      : "gpt-4o-mini"
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              )}
              <button
                type="button"
                onClick={handleLoadModels}
                disabled={aiModelsLoading}
                className="shrink-0 px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {aiModelsLoading ? "Loading..." : "Load models"}
              </button>
            </div>
            {aiModelsError ? (
              <p className="text-xs text-red-600 mt-1">{aiModelsError}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                {aiModels.length > 0
                  ? `${aiModels.length} models available — pick one, or leave on default.`
                  : "Type a model name, or load the models your key can access."}
              </p>
            )}
          </label>
        </div>

        <label className="block mb-4">
          <span className="text-sm text-gray-700 font-medium">API Key</span>
          <input
            type="password"
            autoComplete="new-password"
            value={settings.ai_api_key || ""}
            onChange={(e) => handleChange("ai_api_key", e.target.value)}
            placeholder={
              settings.ai_api_key_set
                ? "•••••••• (saved — leave blank to keep)"
                : settings.ai_provider === "gemini"
                ? "AIza..."
                : settings.ai_provider === "anthropic"
                ? "sk-ant-..."
                : "sk-..."
            }
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Stored securely on the server and never shown again. Leave blank to keep the current key.
          </p>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleTestAi}
            disabled={aiTesting}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {aiTesting ? "Testing..." : "Test AI Connection"}
          </button>
          {aiTestResult && (
            <span className={`text-sm ${aiTestResult.ok ? "text-green-600" : "text-red-600"}`}>
              {aiTestResult.message}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Tip: click &ldquo;Save Settings&rdquo; before testing so the latest key is used.
        </p>
      </div>

      {/* DATA & PRIVACY */}
      <div className={`bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6 ${show("security") ? "" : "hidden"}`}>
        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Data &amp; Privacy</h2>
        <p className="text-xs md:text-sm text-gray-500 mb-3 md:mb-4">
          DPDP data retention. The scheduled cleanup job anonymizes or deletes personal
          data older than this many days. Set to 0 to disable automatic cleanup.
        </p>
        <label className="block">
          <span className="text-sm text-gray-700 font-medium">Data retention (days)</span>
          <input
            type="number"
            min={0}
            value={settings.data_retention_days || "365"}
            onChange={(e) => handleChange("data_retention_days", e.target.value)}
            className="mt-1 w-full md:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Connect requests and contact messages are deleted; leads are anonymized after this period.
          </p>
        </label>
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
