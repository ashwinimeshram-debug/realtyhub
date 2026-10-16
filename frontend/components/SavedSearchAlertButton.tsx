"use client";

import { useEffect, useMemo, useState } from "react";
import API from "@/lib/api";
import { getLocationCounts, getTypes } from "@/lib/lookups";
import { PRICE_OPTIONS, TIMELINE_OPTIONS } from "@/lib/priceOptions";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";

const FILTER_KEYS = [
  "q", "location", "type", "category", "min_price", "max_price",
] as const;

type FilterKey = (typeof FILTER_KEYS)[number];
type FilterState = Record<FilterKey, string> & { timeline: string };

const EMPTY: FilterState = {
  q: "", location: "", type: "", category: "",
  min_price: "", max_price: "", timeline: "",
};

function formatPrice(value: string): string {
  const opt = PRICE_OPTIONS.find((p) => p.value === value);
  if (!opt || !opt.value) return "";
  return `\u20b9${opt.label}`;
}

export default function SavedSearchAlertButton({ query }: { query: string }) {
  const { owner } = useOwnerAuth();

  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY);
  const [showOtherArea, setShowOtherArea] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const [propertyTypes, setPropertyTypes] = useState<Array<{ name: string; value: string }>>([]);
  const [transactionTypes, setTransactionTypes] = useState<Array<{ name: string; value: string }>>([]);
  const [locations, setLocations] = useState<Array<{ name: string; count: number }>>([]);

  useEffect(() => {
    getTypes("property").then(setPropertyTypes);
    getTypes("transaction").then(setTransactionTypes);
    getLocationCounts().then(setLocations);
  }, []);

  // Seed the form from the current search URL whenever the dialog is opened.
  useEffect(() => {
    if (!open) return;
    const sp = new URLSearchParams(query);
    const next: FilterState = { ...EMPTY };
    FILTER_KEYS.forEach((k) => { next[k] = sp.get(k) || ""; });
    next.timeline = sp.get("timeline") || "";
    setFilters(next);
    setEmail((prev) => prev || owner?.email || "");
    setPhone((prev) => prev || owner?.mobile || "");
    setDone(false);
    setError("");
    setShowOtherArea(false);
  }, [open, query, owner]);

  const hasAnyFilter = useMemo(
    () => FILTER_KEYS.some((k) => filters[k]?.trim()),
    [filters]
  );

  const set = (key: keyof FilterState, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  // The "Other" area mode is active when explicitly chosen, or when the seeded
  // location isn't one of the known areas.
  const locationInList = locations.some((l) => l.name === filters.location);
  const isOtherArea = showOtherArea || (!!filters.location.trim() && !locationInList);
  const onAreaChange = (value: string) => {
    if (value === "__other__") {
      setShowOtherArea(true);
      set("location", "");
    } else {
      setShowOtherArea(false);
      set("location", value);
    }
  };

  const buildName = () => {
    const parts: string[] = [];
    const tx = transactionTypes.find((t) => t.value === filters.type);
    if (tx) parts.push(tx.name);
    const pt = propertyTypes.find((t) => t.value === filters.category);
    if (pt) parts.push(pt.name);
    if (filters.location) parts.push(filters.location);
    const min = formatPrice(filters.min_price);
    const max = formatPrice(filters.max_price);
    if (min && max) parts.push(`${min}\u2013${max}`);
    else if (max) parts.push(`under ${max}`);
    else if (min) parts.push(`above ${min}`);
    if (filters.timeline) parts.push(filters.timeline);
    return parts.join(" \u00b7 ").slice(0, 120) || null;
  };

  const submit = async () => {
    setError("");
    if (showOtherArea && !filters.location.trim()) {
      setError("Please type the area name you're looking for.");
      return;
    }
    if (!hasAnyFilter) {
      setError("Please set at least one filter (area, type or budget).");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError("Enter an email or mobile number.");
      return;
    }
    setSaving(true);
    try {
      const params: Record<string, string> = {};
      FILTER_KEYS.forEach((k) => {
        if (filters[k]?.trim()) params[k] = filters[k].trim();
      });
      if (filters.timeline.trim()) params.timeline = filters.timeline.trim();

      await API.post("/saved-searches", {
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        name: buildName() || undefined,
        params,
      });
      setDone(true);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Could not save your alert. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-md border border-gray-200 text-sm bg-white hover:bg-gray-50 flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        Get alerts
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-full overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold" style={{ color: "var(--primary)" }}>
                Get alerts for matching properties
              </h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">
                &times;
              </button>
            </div>

            {done ? (
              <div className="mt-4">
                <p className="text-sm text-gray-700 mb-4">
                  You&apos;re all set. We&apos;ll email or WhatsApp you when new matching
                  properties are listed.
                </p>
                <button
                  onClick={() => { setOpen(false); setDone(false); }}
                  className="w-full text-white rounded-lg py-2.5 font-medium"
                  style={{ backgroundColor: "var(--primary)" }}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-4">
                  Tell us what you&apos;re looking for and we&apos;ll notify you when new
                  properties match.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>I&apos;m looking to</label>
                    <select className={inputCls} value={filters.type} onChange={(e) => set("type", e.target.value)}>
                      <option value="">Buy, Sell, Rent or Resale</option>
                      {transactionTypes.map((t) => (
                        <option key={t.value} value={t.value}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Property type</label>
                    <select className={inputCls} value={filters.category} onChange={(e) => set("category", e.target.value)}>
                      <option value="">Any type</option>
                      {propertyTypes.map((t) => (
                        <option key={t.value} value={t.value}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Area / locality</label>
                    <select className={inputCls} value={isOtherArea ? "__other__" : filters.location} onChange={(e) => onAreaChange(e.target.value)}>
                      <option value="">Any area</option>
                      {locations.map((loc) => (
                        <option key={loc.name} value={loc.name}>{loc.name}{loc.count > 0 ? ` (${loc.count})` : ""}</option>
                      ))}
                      <option value="__other__">Other (type your area)</option>
                    </select>
                    {isOtherArea && (
                      <input
                        type="text"
                        className={`${inputCls} mt-2`}
                        placeholder="Type the area / locality name"
                        maxLength={80}
                        value={filters.location}
                        onChange={(e) => set("location", e.target.value)}
                      />
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Min budget</label>
                    <select className={inputCls} value={filters.min_price} onChange={(e) => set("min_price", e.target.value)}>
                      {PRICE_OPTIONS.map((p) => (
                        <option key={p.value || "min"} value={p.value}>{p.value ? `${p.label}` : "No min"}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Max budget</label>
                    <select className={inputCls} value={filters.max_price} onChange={(e) => set("max_price", e.target.value)}>
                      {PRICE_OPTIONS.map((p) => (
                        <option key={p.value || "max"} value={p.value}>{p.value ? `${p.label}` : "No max"}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>When are you planning to buy?</label>
                    <select className={inputCls} value={filters.timeline} onChange={(e) => set("timeline", e.target.value)}>
                      {TIMELINE_OPTIONS.map((t) => (
                        <option key={t.value || "anytime"} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Keyword <span className="text-gray-400">(optional)</span></label>
                    <input
                      type="text"
                      className={inputCls}
                      value={filters.q}
                      onChange={(e) => set("q", e.target.value)}
                      placeholder="e.g. garden, furnished, corner plot"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-100 mt-4 pt-4">
                  <p className="text-xs text-gray-500 mb-3">
                    {owner
                      ? "We\u2019ll send alerts to your account email below."
                      : "We\u2019ll notify you by email or WhatsApp."}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Email</label>
                      <input
                        type="email"
                        className={inputCls}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>WhatsApp number <span className="text-gray-400">(optional)</span></label>
                      <input
                        type="tel"
                        className={inputCls}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>
                </div>

                {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

                <button
                  onClick={submit}
                  disabled={saving}
                  className="w-full mt-4 text-white rounded-lg py-2.5 font-medium disabled:opacity-60"
                  style={{ backgroundColor: "var(--primary)" }}
                >
                  {saving ? "Saving..." : "Notify me"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
