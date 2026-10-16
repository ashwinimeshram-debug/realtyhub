"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import API from "@/lib/api";
import SmartImage from "@/components/SmartImage";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/hooks/useConfirm";
import { propertyHref } from "@/lib/api";
import OwnerLeadsBoard from "@/components/owner/OwnerLeadsBoard";

interface MyProperty {
  id: number;
  listing_id: string | null;
  title: string;
  status: string;
  is_active: boolean;
  is_closed: boolean;
  price: number | null;
  price_text: string | null;
  location: string;
  transaction_type: string | null;
  property_type: string | null;
  image: string | null;
  lead_count: number;
  created_at: string | null;
  payment_status: string;
  expires_at: string | null;
  featured_until: string | null;
  renewal_count: number;
  listing_state: string;
  days_until_expiry: number | null;
  is_featured: boolean;
}

interface SavedSearchRow {
  id: number;
  name: string | null;
  params: Record<string, string>;
  notify: boolean;
  is_active: boolean;
  last_notified_at: string | null;
  created_at: string | null;
}

const SEARCH_LABELS: Record<string, string> = {
  q: "Keyword",
  location: "Locality",
  type: "Listing",
  category: "Type",
  min_price: "Min price",
  max_price: "Max price",
  featured: "Featured",
  near: "Near",
  radius_km: "Radius (km)",
  timeline: "Timeline",
};

function describeSearch(params: Record<string, string>) {
  const parts = Object.entries(params).map(
    ([k, v]) => `${SEARCH_LABELS[k] || k}: ${v}`
  );
  return parts.length ? parts.join(" · ") : "All properties";
}

// Builds a /properties query string, dropping non-filter keys (e.g. `timeline`).
function searchQuery(params: Record<string, string>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (k === "timeline") return;
    if (v) sp.set(k, v);
  });
  return sp.toString();
}

const STATE_META: Record<string, { label: string; cls: string }> = {
  active: { label: "Live", cls: "bg-green-100 text-green-700" },
  grace: { label: "Expiring", cls: "bg-amber-100 text-amber-700" },
  expired: { label: "Expired", cls: "bg-red-100 text-red-600" },
  payment_pending: { label: "Payment Pending", cls: "bg-amber-100 text-amber-700" },
  pending: { label: "Pending Review", cls: "bg-amber-100 text-amber-700" },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-600" },
  closed: { label: "Closed", cls: "bg-gray-100 text-gray-500" },
};

function StatusBadge({ state }: { state: string }) {
  const meta = STATE_META[state] || { label: state, cls: "bg-gray-100 text-gray-500" };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${meta.cls}`}>{meta.label}</span>
  );
}

function ExpiryNote({ p }: { p: MyProperty }) {
  if (p.is_closed || p.listing_state === "payment_pending") return null;
  if (p.listing_state === "expired") {
    return (
      <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
        This listing has expired and is hidden. Renew to go live again.
      </p>
    );
  }
  if (p.listing_state === "grace") {
    return (
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
        Expired — within the grace period. Renew now to keep it live.
      </p>
    );
  }
  if (p.days_until_expiry != null && p.days_until_expiry <= 15) {
    return (
      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
        Expires in {p.days_until_expiry} day{p.days_until_expiry === 1 ? "" : "s"}.
      </p>
    );
  }
  return null;
}

function formatPrice(p: MyProperty) {
  if (p.price != null) return `₹${Number(p.price).toLocaleString("en-IN")}`;
  if (p.price_text && p.price_text !== "*") return p.price_text;
  return "Connect for Price";
}

export default function MyAccountPage() {
  const { owner, loading: authLoading, logout } = useOwnerAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [tab, setTab] = useState<"properties" | "leads" | "searches">("properties");
  const [properties, setProperties] = useState<MyProperty[]>([]);
  const [searches, setSearches] = useState<SavedSearchRow[]>([]);
  const [searchesLoading, setSearchesLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const loadSearches = useCallback(async () => {
    setSearchesLoading(true);
    try {
      const res = await API.get("/saved-searches");
      setSearches(res.data.items || []);
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to load saved searches", "error");
    } finally {
      setSearchesLoading(false);
    }
  }, [toast]);

  const handleDeleteSearch = async (s: SavedSearchRow) => {
    const ok = await confirm({
      title: "Delete this saved search?",
      message: "You will stop receiving alerts for these filters.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await API.delete(`/saved-searches/${s.id}`);
      toast("Saved search deleted", "success");
      loadSearches();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to delete", "error");
    }
  };

  const loadProperties = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/owner/properties");
      setProperties(res.data);
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to load properties", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!owner) return;
    if (tab === "properties") loadProperties();
    if (tab === "searches") loadSearches();
  }, [owner, tab, loadProperties, loadSearches]);

  const handleClose = async (p: MyProperty) => {
    const ok = await confirm({
      title: `Close "${p.title}"?`,
      message: "The property will be hidden from listings. This can be undone by reopening it.",
      confirmLabel: "Close Property",
      danger: true,
    });
    if (!ok) return;
    try {
      await API.post(`/owner/properties/${p.id}/close`);
      toast("Property closed", "success");
      loadProperties();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to close property", "error");
    }
  };

  const handleReopen = async (p: MyProperty) => {
    try {
      await API.post(`/owner/properties/${p.id}/reopen`);
      toast("Property reopened", "success");
      loadProperties();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to reopen property", "error");
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    try {
      await API.post("/owner/resend-verification");
      toast("Verification email sent", "success");
    } catch (err: any) {
      toast(err?.response?.data?.error || "Could not resend verification email", "error");
    } finally {
      setResending(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast("Logged out", "info");
  };

  const handleExportData = async () => {
    try {
      const res = await API.get("/owner/data-export?format=csv", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-realtyhub-data-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Your data export is downloading", "success");
    } catch (err: any) {
      toast("Failed to export data", "error");
    }
  };

  const handleDeleteAccount = async () => {
    const ok = await confirm({
      title: "Delete your account and personal data?",
      message:
        "This permanently removes your personal information, hides your listings and deletes your saved searches. This cannot be undone.",
      confirmLabel: "Delete Account",
      danger: true,
    });
    if (!ok) return;
    try {
      await API.post("/owner/delete-account");
      toast("Your account has been deleted", "success");
      await logout();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Failed to delete account", "error");
    }
  };

  if (authLoading) {
    return <div className="min-h-[50vh] text-center py-20 text-gray-400">Loading...</div>;
  }

  if (!owner) {
    return (
      <div className="max-w-md mx-auto min-h-[50vh] flex flex-col items-center justify-center px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-dark)" }}>My Account</h1>
        <p className="text-gray-500 text-sm mb-6">Sign in to manage your properties and connect requests.</p>
        <Link href="/login?next=/my-account" className="btn btn-primary px-8">Sign In</Link>
        <p className="mt-3 text-sm text-gray-400">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-[var(--primary)] hover:underline">Register</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 md:py-12 px-4 md:px-6 lg:px-10" style={{ backgroundColor: "var(--bg-page)" }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold" style={{ color: "var(--text-dark)" }}>My Account</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {owner.name} · {owner.email}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!owner.is_verified && (
              <button onClick={handleResendVerification} disabled={resending} className="btn btn-sm border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100">
                {resending ? "Sending..." : "Verify Email"}
              </button>
            )}
            <button onClick={handleExportData} className="btn btn-sm btn-ghost">Download My Data (CSV)</button>
            <button onClick={handleDeleteAccount} className="btn btn-sm border border-red-200 text-red-600 hover:bg-red-50">Delete Account</button>
            <button onClick={handleLogout} className="btn btn-sm btn-ghost">Logout</button>
          </div>
        </div>

        {!owner.is_verified && (
          <div className="mb-6 text-amber-700 text-sm bg-amber-50 border border-amber-200 p-4 rounded-lg">
            Your email address is not verified yet. Please check your inbox and click the verification link to start posting properties.
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1.5 border border-gray-100 shadow-sm w-fit">
          <button
            onClick={() => setTab("properties")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "properties" ? "text-white" : "text-gray-600 hover:bg-gray-50"}`}
            style={tab === "properties" ? { backgroundColor: "var(--primary)" } : {}}
          >
            My Properties {properties.length > 0 && `(${properties.length})`}
          </button>
          <button
            onClick={() => setTab("leads")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "leads" ? "text-white" : "text-gray-600 hover:bg-gray-50"}`}
            style={tab === "leads" ? { backgroundColor: "var(--primary)" } : {}}
          >
            Leads
          </button>
          <button
            onClick={() => setTab("searches")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "searches" ? "text-white" : "text-gray-600 hover:bg-gray-50"}`}
            style={tab === "searches" ? { backgroundColor: "var(--primary)" } : {}}
          >
            Saved Searches {searches.length > 0 && `(${searches.length})`}
          </button>
        </div>

        {tab === "properties" ? (
          <>
            <div className="flex justify-end mb-4">
              <Link href="/post" className="btn btn-primary btn-sm">+ Post New Property</Link>
            </div>
            {loading && <p className="text-gray-400 text-sm py-6">Loading properties...</p>}
            {!loading && properties.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center shadow-sm">
                <p className="text-gray-500 text-sm">You haven&apos;t posted any properties yet.</p>
                <Link href="/post" className="btn btn-primary mt-4">Post Your First Property</Link>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {properties.map((p) => (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="h-40 bg-gray-100 overflow-hidden relative">
                    {p.image ? (
                      <SmartImage src={p.image} alt={p.title} sizes="(max-width: 768px) 100vw, 50vw" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 flex gap-1.5">
                      <StatusBadge state={p.is_closed ? "closed" : p.listing_state} />
                      {p.is_featured && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Featured</span>
                      )}
                    </div>
                    {p.price != null && (
                      <div className="absolute bottom-2 right-2 bg-white/95 rounded-lg px-2.5 py-1 text-sm font-bold shadow" style={{ color: "var(--primary)" }}>
                        {formatPrice(p)}
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-base mb-1" style={{ color: "var(--text-dark)" }}>{p.title}</h3>
                    <p className="text-sm text-gray-500 mb-1">{p.location}</p>
                    <p className="text-xs text-gray-400 mb-3">
                      {p.listing_id || "-"} · {p.is_closed ? "Closed" : p.is_active ? "Live" : "Not visible"}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                        {p.lead_count} enquiry{p.lead_count === 1 ? "" : "ies"}
                      </span>
                    </div>
                    {p.listing_state === "payment_pending" && !p.is_closed && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
                        Payment pending. Complete payment to publish this listing.
                      </p>
                    )}
                    <ExpiryNote p={p} />
                    {p.is_featured && p.featured_until && !p.is_closed && (
                      <p className="text-xs text-purple-700 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 mb-3">
                        Featured until {new Date(p.featured_until).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.
                      </p>
                    )}
                    {p.status === "pending" && p.payment_status !== "unpaid" && (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
                        Waiting for admin review.
                      </p>
                    )}
                    {p.status === "rejected" && (
                      <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
                        Not approved. Edit and resubmit.
                      </p>
                    )}
                    {(p.listing_state === "payment_pending" ||
                      p.listing_state === "grace" ||
                      p.listing_state === "expired" ||
                      (p.listing_state === "active" && !p.is_featured)) && (
                      <div className="flex gap-2 mb-3">
                        {p.listing_state === "payment_pending" && (
                          <Link href={`/checkout/${p.id}?purpose=listing`} className="btn btn-sm btn-primary flex-1 text-center">
                            Pay &amp; Publish
                          </Link>
                        )}
                        {(p.listing_state === "grace" || p.listing_state === "expired") && (
                          <Link href={`/checkout/${p.id}?purpose=listing`} className="btn btn-sm btn-primary flex-1 text-center">
                            Renew
                          </Link>
                        )}
                        {p.listing_state === "active" && !p.is_featured && (
                          <Link href={`/checkout/${p.id}?purpose=featured`} className="btn btn-sm border border-purple-200 text-purple-700 hover:bg-purple-50 flex-1 text-center">
                            Feature Listing
                          </Link>
                        )}
                      </div>
                    )}
                    <div className="mt-auto pt-3 flex gap-2 border-t border-gray-50">
                      <Link href={propertyHref(p.id, p.title)} className="btn btn-sm btn-ghost flex-1 text-center">
                        View
                      </Link>
                      <Link href={`/post?edit=${p.id}`} className="btn btn-sm btn-primary flex-1 text-center">
                        Edit
                      </Link>
                      {p.is_closed ? (
                        <button onClick={() => handleReopen(p)} className="btn btn-sm btn-ghost flex-1">Reopen</button>
                      ) : (
                        <button onClick={() => handleClose(p)} className="btn btn-sm btn-ghost flex-1">Close</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : tab === "leads" ? (
          <OwnerLeadsBoard />
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Get notified when new properties match a search you saved from the{" "}
              <Link href="/properties" className="text-[var(--primary)] hover:underline">properties page</Link>.
            </p>
            {searchesLoading && <p className="text-gray-400 text-sm py-6">Loading saved searches...</p>}
            {!searchesLoading && searches.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center shadow-sm">
                <p className="text-gray-500 text-sm">You have no saved searches yet.</p>
                <Link href="/properties" className="btn btn-primary mt-4">Browse Properties</Link>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searches.map((s) => (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-sm" style={{ color: "var(--text-dark)" }}>
                      {s.name || "Saved search"}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      s.is_active && s.notify ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {s.is_active && s.notify ? "Active" : "Paused"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 mb-3">{describeSearch(s.params)}</p>
                  <div className="mt-auto pt-3 border-t border-gray-50 flex justify-between items-center">
                    <Link
                      href={`/properties?${searchQuery(s.params)}`}
                      className="text-sm font-medium text-[var(--primary)] hover:underline"
                    >
                      View matches
                    </Link>
                    <button
                      onClick={() => handleDeleteSearch(s)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}