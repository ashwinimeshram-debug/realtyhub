"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import API from "@/lib/api";
import { backendAssetUrl } from "@/lib/api";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/hooks/useConfirm";
import { encodePropertyId } from "@/lib/api";
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
}

function StatusBadge({ status, isClosed }: { status: string; isClosed: boolean }) {
  if (isClosed) {
    return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Closed</span>;
  }
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-600",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${map[status] || "bg-gray-100 text-gray-500"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
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

  const [tab, setTab] = useState<"properties" | "leads">("properties");
  const [properties, setProperties] = useState<MyProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

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
  }, [owner, tab, loadProperties]);

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
          <div className="flex gap-2">
            {!owner.is_verified && (
              <button onClick={handleResendVerification} disabled={resending} className="btn btn-sm border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100">
                {resending ? "Sending..." : "Verify Email"}
              </button>
            )}
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
                      <img src={backendAssetUrl(p.image)} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 flex gap-1.5">
                      <StatusBadge status={p.status} isClosed={p.is_closed} />
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
                    {p.status === "pending" && (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
                        Waiting for admin review.
                      </p>
                    )}
                    {p.status === "rejected" && (
                      <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
                        Not approved. Edit and resubmit.
                      </p>
                    )}
                    <div className="mt-auto pt-3 flex gap-2 border-t border-gray-50">
                      <Link href={`/property/${encodePropertyId(p.id)}`} className="btn btn-sm btn-ghost flex-1 text-center">
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
        ) : (
          <OwnerLeadsBoard />
        )}
      </div>
    </div>
  );
}