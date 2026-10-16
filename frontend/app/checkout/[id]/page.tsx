"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import API from "@/lib/api";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";
import { useToast } from "@/components/Toast";

interface Plan {
  transaction_type?: string;
  purpose?: string;
  price: number;
  duration_days: number;
}

interface Plans {
  currency: string;
  payment_required: boolean;
  grace_days: number;
  sell: Plan;
  rent: Plan;
  featured: Plan;
  featured_bundle_discount_percent?: number;
  featured_capacity?: number;
  featured_slots_used?: number;
  featured_slots_available?: number;
  reminder_days: number[];
}

interface OwnerProp {
  id: number;
  title: string;
  listing_id: string | null;
  transaction_type: string | null;
  listing_state: string;
  payment_status: string;
  expires_at: string | null;
  is_featured?: boolean;
  featured_until: string | null;
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function CheckoutInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { owner, loading: authLoading } = useOwnerAuth();
  const { toast } = useToast();

  const id = Number(Array.isArray(params?.id) ? params?.id[0] : params?.id);
  const purpose = (searchParams.get("purpose") || "listing").toLowerCase() === "featured" ? "featured" : "listing";

  const [plans, setPlans] = useState<Plans | null>(null);
  const [prop, setProp] = useState<OwnerProp | null>(null);
  const [siteName, setSiteName] = useState("Realty Hub");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const [includeFeatured, setIncludeFeatured] = useState(false);

  const fmt = (n: number) =>
    `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [plansRes, propRes, settingsRes] = await Promise.all([
        API.get("/owner/plans"),
        API.get(`/owner/properties/${id}`),
        API.get("/settings").catch(() => null),
      ]);
      setPlans(plansRes.data);
      setProp(propRes.data);
      const name = (settingsRes?.data?.site_name || "").trim();
      if (name) setSiteName(name);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not load checkout details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!owner || !id) return;
    load();
  }, [owner, id, load]);

  const plan: Plan | null = plans
    ? purpose === "featured"
      ? plans.featured
      : prop?.transaction_type === "rent"
        ? plans.rent
        : plans.sell
    : null;

  // Already featured (active boost) → hide the add-on; extend via the Feature action.
  const alreadyFeatured = !!prop?.is_featured &&
    (!prop?.featured_until || new Date(prop.featured_until).getTime() > Date.now());
  const showCombo = purpose !== "featured" && !!plans && !alreadyFeatured;
  const discountPct = plans?.featured_bundle_discount_percent ?? 0;
  const featuredListed = plans?.featured?.price ?? 0;
  const featuredDiscounted = Math.round(featuredListed * (100 - discountPct)) / 100;
  const comboActive = showCombo && includeFeatured;
  const comboTotal = ((plan?.price ?? 0) + featuredDiscounted);
  const comboSavings = featuredListed - featuredDiscounted;
  const payable = comboActive ? comboTotal : (plan?.price ?? 0);

  const finishSuccess = () => {
    setDone(true);
    toast("Payment successful — your listing is being updated", "success");
    setTimeout(() => router.push("/my-account"), 1400);
  };

  const handlePay = async () => {
    if (!plan) return;
    const payPurpose = comboActive ? "combo" : purpose;
    setPaying(true);
    try {
      const res = await API.post(`/owner/properties/${id}/checkout`, { purpose: payPurpose });
      const data = res.data;

      if (data.provider === "mock" || !data.uses_client_js) {
        await API.post("/payments/mock/complete", { transaction_id: data.transaction_id });
        finishSuccess();
        return;
      }

      const loaded = await loadRazorpay();
      if (!loaded) {
        toast("Could not load the payment gateway. Please try again.", "error");
        return;
      }
      const rzp = new (window as any).Razorpay({
        key: data.public_key,
        amount: data.order.amount,
        currency: data.order.currency,
        order_id: data.order.order_id,
        name: siteName,
        description: payPurpose === "featured"
          ? "Featured listing"
          : payPurpose === "combo"
            ? "Listing + Featured bundle"
            : "Listing publication",
        handler: () => {
          finishSuccess();
        },
        theme: { color: "#c0392b" },
      });
      rzp.on("payment.failed", () => toast("Payment failed. Please try again.", "error"));
      rzp.open();
    } catch (err: any) {
      toast(err?.response?.data?.error || "Could not start checkout", "error");
    } finally {
      setPaying(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-[50vh] text-center py-20 text-gray-400">Loading...</div>;
  }

  if (!owner) {
    return (
      <div className="max-w-md mx-auto min-h-[50vh] flex flex-col items-center justify-center px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-dark)" }}>Checkout</h1>
        <p className="text-gray-500 text-sm mb-6">Sign in to complete your payment.</p>
        <Link href={`/login?next=/checkout/${id}?purpose=${purpose}`} className="btn btn-primary px-8">Sign In</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--bg-page)" }}>
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-green-700 mb-2">Payment Successful</h2>
          <p className="text-gray-600 mb-4">Your listing has been updated. Redirecting to your account…</p>
          <Link href="/my-account" className="btn btn-primary w-full">Go to My Account</Link>
        </div>
      </div>
    );
  }

  const isFeatured = purpose === "featured";
  const slotsFull = (isFeatured || comboActive) && (plans?.featured_slots_available ?? 1) <= 0;
  const title = isFeatured ? "Feature Your Listing" : prop?.listing_state === "payment_pending" ? "Publish Your Listing" : "Renew Your Listing";

  return (
    <div className="min-h-screen py-10 md:py-14 px-4 md:px-6 lg:px-10" style={{ backgroundColor: "var(--bg-page)" }}>
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl md:text-3xl font-extrabold mb-2 text-center" style={{ color: "var(--text-dark)" }}>{title}</h1>
        <p className="text-sm text-center mb-8" style={{ color: "var(--text-muted)" }}>
          {isFeatured
            ? "Boost visibility by placing your property at the top of listings."
            : "A one-time payment keeps your property live and receiving enquiries."}
        </p>

        {loading && <p className="text-center text-gray-400 py-8">Loading…</p>}
        {error && <p className="text-center text-red-600 bg-red-50 border border-red-100 rounded-lg p-4">{error}</p>}

        {!loading && !error && plans && prop && plan && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="mb-5 pb-5 border-b border-gray-100">
              <p className="font-semibold" style={{ color: "var(--text-dark)" }}>{prop.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{prop.listing_id || `#${prop.id}`}</p>
            </div>

            <div className="flex items-end justify-between mb-1">
              <span className="text-sm text-gray-500">Amount payable</span>
              <span className="text-3xl font-extrabold" style={{ color: "var(--primary)" }}>
                {fmt(payable)}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-5">
              Valid for {plan.duration_days} days · {plans.currency}
              {!isFeatured && plans.grace_days > 0 ? ` · ${plans.grace_days}-day grace` : ""}
            </p>

            {comboActive && (
              <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 space-y-1">
                <div className="flex justify-between">
                  <span>Listing ({plan.duration_days} days)</span>
                  <span>{fmt(plan.price)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Featured add-on ({plans.featured.duration_days} days)</span>
                  <span className="flex items-center gap-2">
                    {discountPct > 0 && <s className="text-gray-400">{fmt(featuredListed)}</s>}
                    <span className="font-semibold">{fmt(featuredDiscounted)}</span>
                  </span>
                </div>
                {discountPct > 0 && (
                  <div className="flex justify-between font-semibold border-t border-emerald-200 pt-1">
                    <span>Bundle discount ({discountPct}% off Featured)</span>
                    <span>−{fmt(comboSavings)}</span>
                  </div>
                )}
              </div>
            )}

            {showCombo && (
              <label className="flex items-start gap-3 mb-5 p-4 rounded-xl border border-gray-200 cursor-pointer hover:border-blue-300 transition">
                <input
                  type="checkbox"
                  checked={includeFeatured}
                  onChange={(e) => setIncludeFeatured(e.target.checked)}
                  disabled={slotsFull}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span className="flex-1 text-left">
                  <span className="block text-sm font-semibold text-gray-800">
                    Feature this listing too
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Appear at the top of search results for {plans.featured.duration_days} days.
                    {comboSavings > 0 && ` Save ${fmt(comboSavings)} when bundled (${discountPct}% off the Featured add-on).`}
                  </span>
                </span>
              </label>
            )}

            {slotsFull && (
              <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                All featured slots are currently full. Featured placement is temporarily
                unavailable — please try again once a slot frees up.
              </div>
            )}

            <ul className="text-sm text-gray-600 space-y-2 mb-6">
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                {isFeatured ? "Appears at the top of search and category listings" : "Live on the public property listings"}
              </li>
              {comboActive && (
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  Featured placement at the top of search and category listings
                </li>
              )}
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                Receive enquiries by email and WhatsApp
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                Manage everything from your account dashboard
              </li>
            </ul>

            <button onClick={handlePay} disabled={paying || slotsFull} className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
              {paying ? "Processing…" : slotsFull ? "Featured slots full" : `Pay ${fmt(payable)}`}
            </button>
            <Link href="/my-account" className="btn btn-ghost w-full text-center mt-3">Cancel</Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] text-center py-20 text-gray-400">Loading…</div>}>
      <CheckoutInner />
    </Suspense>
  );
}
