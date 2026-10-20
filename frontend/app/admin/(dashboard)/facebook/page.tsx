"use client";

import { useCallback, useEffect, useState } from "react";
import API from "@/lib/api";
import { useToast } from "@/components/Toast";

interface FbSettings {
  enabled: boolean;
  app_id: string;
  app_secret_set: boolean;
  app_secret_preview: string;
  verify_token: string;
  default_source: string;
  auto_assign: boolean;
  webhook_url: string;
}

interface FbPage {
  id: number;
  page_id: string;
  page_name: string | null;
  source_label: string;
  is_active: boolean;
  last_lead_at: string | null;
  created_at: string | null;
  has_token: boolean;
  token_preview: string;
}

interface FbEvent {
  id: number;
  leadgen_id: string;
  page_id: string | null;
  form_id: string | null;
  status: string;
  detail: string | null;
  lead_id: number | null;
  created_at: string | null;
}

const STATUS_CLS: Record<string, string> = {
  imported: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-600",
  pending: "bg-amber-100 text-amber-700",
};

export default function AdminFacebookPage() {
  const { toast } = useToast();

  const [settings, setSettings] = useState<FbSettings | null>(null);
  const [pages, setPages] = useState<FbPage[]>([]);
  const [events, setEvents] = useState<FbEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const [appSecret, setAppSecret] = useState("");

  const [showPageForm, setShowPageForm] = useState(false);
  const [editingPage, setEditingPage] = useState<FbPage | null>(null);
  const [pageForm, setPageForm] = useState({
    page_id: "", access_token: "", page_name: "", source_label: "facebook", is_active: true,
  });
  const [savingPage, setSavingPage] = useState(false);
  const [testing, setTesting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, e] = await Promise.all([
        API.get("/admin/facebook/settings"),
        API.get("/admin/facebook/pages"),
        API.get("/admin/facebook/events"),
      ]);
      setSettings(s.data);
      setPages(p.data.items || []);
      setEvents(e.data.items || []);
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to load Facebook settings", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async (patch: Partial<FbSettings> & { app_secret?: string; regenerate_verify_token?: boolean }) => {
    setSavingSettings(true);
    try {
      await API.put("/admin/facebook/settings", patch);
      toast("Settings saved", "success");
      setAppSecret("");
      load();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to save settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const openAddPage = () => {
    setEditingPage(null);
    setPageForm({ page_id: "", access_token: "", page_name: "", source_label: "facebook", is_active: true });
    setShowPageForm(true);
  };

  const openEditPage = (p: FbPage) => {
    setEditingPage(p);
    setPageForm({
      page_id: p.page_id, access_token: "", page_name: p.page_name || "",
      source_label: p.source_label, is_active: p.is_active,
    });
    setShowPageForm(true);
  };

  const savePage = async () => {
    if (!pageForm.page_id.trim()) {
      toast("Page ID is required", "warning");
      return;
    }
    if (!editingPage && !pageForm.access_token.trim()) {
      toast("Access token is required", "warning");
      return;
    }
    setSavingPage(true);
    try {
      if (editingPage) {
        const payload: any = {
          page_name: pageForm.page_name, source_label: pageForm.source_label,
          is_active: pageForm.is_active,
        };
        if (pageForm.access_token.trim()) payload.access_token = pageForm.access_token.trim();
        await API.put(`/admin/facebook/pages/${editingPage.id}`, payload);
        toast("Page updated", "success");
      } else {
        await API.post("/admin/facebook/pages", {
          page_id: pageForm.page_id.trim(),
          access_token: pageForm.access_token.trim(),
          page_name: pageForm.page_name,
          source_label: pageForm.source_label,
          is_active: pageForm.is_active,
        });
        toast("Page connected", "success");
      }
      setShowPageForm(false);
      load();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Could not save page", "error");
    } finally {
      setSavingPage(false);
    }
  };

  const testPage = async (p: FbPage) => {
    setTesting(p.id);
    try {
      const res = await API.post(`/admin/facebook/pages/${p.id}/test`);
      toast(res.data?.ok ? `Connected: ${res.data.page_name || p.page_id}` : "Test failed", res.data?.ok ? "success" : "error");
      load();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Test failed", "error");
    } finally {
      setTesting(null);
    }
  };

  const deletePage = async (p: FbPage) => {
    if (!confirm(`Disconnect page ${p.page_name || p.page_id}?`)) return;
    try {
      await API.delete(`/admin/facebook/pages/${p.id}`);
      toast("Page disconnected", "success");
      load();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to disconnect", "error");
    }
  };

  const copyWebhook = () => {
    if (settings?.webhook_url) {
      navigator.clipboard?.writeText(settings.webhook_url);
      toast("Webhook URL copied", "success");
    }
  };

  if (loading) return <p className="text-gray-400 py-10 text-center">Loading…</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-dark)" }}>Facebook Lead Ads</h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect Facebook Pages and ingest ad leads automatically as CRM leads.
        </p>
      </div>

      {/* Webhook + credentials */}
      <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg" style={{ color: "var(--text-dark)" }}>Configuration</h2>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Enabled</span>
            <input
              type="checkbox"
              checked={!!settings?.enabled}
              disabled={savingSettings}
              onChange={(e) => saveSettings({ enabled: e.target.checked })}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">App ID</label>
            <input
              defaultValue={settings?.app_id || ""}
              onBlur={(e) => { if (e.target.value !== (settings?.app_id || "")) saveSettings({ app_id: e.target.value }); }}
              placeholder="Facebook App ID"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">App Secret</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder={settings?.app_secret_set ? settings.app_secret_preview : "Enter app secret"}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <button
                onClick={() => appSecret.trim() && saveSettings({ app_secret: appSecret.trim() })}
                disabled={savingSettings || !appSecret.trim()}
                className="btn btn-ghost px-4 disabled:opacity-50"
              >
                Save
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Encrypted at rest. Leave blank to keep the current secret.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default lead source</label>
            <input
              defaultValue={settings?.default_source || "facebook"}
              onBlur={(e) => { if (e.target.value !== (settings?.default_source || "")) saveSettings({ default_source: e.target.value }); }}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={!!settings?.auto_assign}
                disabled={savingSettings}
                onChange={(e) => saveSettings({ auto_assign: e.target.checked })}
              />
              Auto-assign new Facebook leads
            </label>
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Webhook URL (paste into Meta App &rarr; Webhooks)</label>
            <div className="flex gap-2">
              <input readOnly value={settings?.webhook_url || ""} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs bg-white font-mono" />
              <button onClick={copyWebhook} className="btn btn-ghost px-4">Copy</button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Verify Token</label>
            <div className="flex gap-2">
              <input readOnly value={settings?.verify_token || ""} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs bg-white font-mono" />
              <button
                onClick={() => saveSettings({ regenerate_verify_token: true })}
                disabled={savingSettings}
                className="btn btn-ghost px-4"
              >
                Regenerate
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Subscribe to the <span className="font-mono">page</span> object and <span className="font-mono">leadgen</span> field.
            </p>
          </div>
        </div>
      </section>

      {/* Pages */}
      <section className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg" style={{ color: "var(--text-dark)" }}>Connected Pages</h2>
          <button onClick={openAddPage} className="btn btn-primary px-4">+ Connect Page</button>
        </div>

        {pages.length === 0 ? (
          <p className="text-gray-400 text-sm py-6 text-center">No pages connected yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Page</th>
                  <th className="px-3 py-2 font-medium">Source label</th>
                  <th className="px-3 py-2 font-medium">Token</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <span className="font-medium text-gray-800">{p.page_name || "—"}</span>
                      <p className="text-xs text-gray-400 font-mono">{p.page_id}</p>
                    </td>
                    <td className="px-3 py-2 text-gray-600 font-mono text-xs">{p.source_label}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs font-mono">{p.token_preview}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {p.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => testPage(p)} disabled={testing === p.id} className="text-blue-600 hover:underline mr-3">Test</button>
                      <button onClick={() => openEditPage(p)} className="text-gray-600 hover:underline mr-3">Edit</button>
                      <button onClick={() => deletePage(p)} className="text-red-600 hover:underline">Disconnect</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent events */}
      <section className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="font-bold text-lg mb-4" style={{ color: "var(--text-dark)" }}>Recent Webhook Events</h2>
        {events.length === 0 ? (
          <p className="text-gray-400 text-sm py-6 text-center">No events received yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Leadgen ID</th>
                  <th className="px-3 py-2 font-medium">Page</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Lead</th>
                  <th className="px-3 py-2 font-medium">Detail</th>
                  <th className="px-3 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">{ev.leadgen_id}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs font-mono">{ev.page_id || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLS[ev.status] || "bg-gray-100 text-gray-500"}`}>
                        {ev.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{ev.lead_id ? `#${ev.lead_id}` : "—"}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{ev.detail || "—"}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{ev.created_at ? new Date(ev.created_at).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Page form modal */}
      {showPageForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-8">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: "var(--text-dark)" }}>
                {editingPage ? "Edit Page" : "Connect Page"}
              </h2>
              <button onClick={() => setShowPageForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Page ID</label>
                <input
                  value={pageForm.page_id}
                  disabled={!!editingPage}
                  onChange={(e) => setPageForm({ ...pageForm, page_id: e.target.value })}
                  placeholder="e.g. 1029384756"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editingPage ? "New Page Access Token (leave blank to keep)" : "Page Access Token"}
                </label>
                <input
                  type="password"
                  value={pageForm.access_token}
                  onChange={(e) => setPageForm({ ...pageForm, access_token: e.target.value })}
                  placeholder="Long-lived page token"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Encrypted at rest. Needs leads_retrieval and pages_manage_ads.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Page Name (optional)</label>
                <input
                  value={pageForm.page_name}
                  onChange={(e) => setPageForm({ ...pageForm, page_name: e.target.value })}
                  placeholder="Auto-detected when the token is valid"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source label</label>
                <input
                  value={pageForm.source_label}
                  onChange={(e) => setPageForm({ ...pageForm, source_label: e.target.value })}
                  placeholder="facebook"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Leads from this page get this source value (default “facebook”).</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={pageForm.is_active}
                  onChange={(e) => setPageForm({ ...pageForm, is_active: e.target.checked })}
                />
                Active
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowPageForm(false)} className="btn btn-ghost px-5">Cancel</button>
              <button onClick={savePage} disabled={savingPage} className="btn btn-primary px-6 disabled:opacity-50">
                {savingPage ? "Saving…" : editingPage ? "Save Changes" : "Connect Page"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
