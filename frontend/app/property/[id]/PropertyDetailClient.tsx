"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import API, { parsePropertySlug, propertyHref } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { SITE_URL } from "@/lib/assets";
import { useToast } from "@/components/Toast";
import { useSettings } from "@/hooks/useSettings";
import ShareButtons from "@/components/ShareButtons";
import ImageSlider from "@/components/ImageSlider";
import ConsentCheckbox from "@/components/ConsentCheckbox";
import Link from "next/link";
import { formatPriceDisplay } from "@/lib/priceFormat";
import { TIMEFRAME_OPTIONS, BUDGET_OPTIONS } from "@/lib/leadOptions";

export default function PropertyDetailClient({
  initialProperty,
}: {
  initialProperty: any;
}) {
  const { toast } = useToast();
  const { settings } = useSettings();
  const params = useParams<{ id: string }>();
  const propertyId = parsePropertySlug(params?.id || "");

  const [property, setProperty] = useState<any>(initialProperty || null);
  const [allIds, setAllIds] = useState<number[]>([]);
  const [navTitles, setNavTitles] = useState<Record<number, string>>({});
  const [prevNav, setPrevNav] = useState<{ id: number; title: string } | null>(null);
  const [nextNav, setNextNav] = useState<{ id: number; title: string } | null>(null);
  const [navCtx, setNavCtx] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", mobile: "", consent: false, timeframe: "", preferred_location: "", budget: "" });

  useEffect(() => {
    if (initialProperty) setProperty(initialProperty);
  }, [initialProperty]);

  useEffect(() => {
    const search =
      typeof window !== "undefined" && window.location.search
        ? window.location.search.slice(1)
        : "";
    setNavCtx(search);

    if (!propertyId) return;
    const sp = new URLSearchParams(search);
    const filters = new URLSearchParams();
    ["location", "type", "category", "min_price", "max_price", "featured"].forEach((key) => {
      const value = sp.get(key);
      if (value) filters.set(key, value);
    });
    const sortBy = sp.get("sort") || "newest";
    filters.set("sort", sortBy);
    filters.set("id", String(propertyId));

    // Only the immediate neighbours are fetched (id + title), instead of the
    // previous approach which pulled up to 400 full listings.
    API.get(`/property/${propertyId}/neighbors?${filters.toString()}`)
      .then((res) => {
        const prev = res.data?.prev;
        const next = res.data?.next;
        const ids: number[] = [];
        const titles: Record<number, string> = {};
        if (prev) { ids.push(prev.id); titles[prev.id] = prev.title; }
        if (next) { ids.push(next.id); titles[next.id] = next.title; }
        setAllIds(ids);
        setNavTitles(titles);
        setPrevNav(prev || null);
        setNextNav(next || null);
      })
      .catch(() => {
        /* ignore navigation errors */
      });
  }, [propertyId]);

  useEffect(() => {
    if (propertyId && !initialProperty) {
      API.get(`/property/${propertyId}`)
        .then((res) => setProperty(res.data))
        .catch(() => {});
    }
  }, [propertyId, initialProperty]);

  const currentIndex = propertyId ? allIds.indexOf(propertyId) : -1;
  const prevId = prevNav?.id ?? (currentIndex > 0 ? allIds[currentIndex - 1] : null);
  const nextId = nextNav?.id ?? (currentIndex >= 0 && currentIndex < allIds.length - 1 ? allIds[currentIndex + 1] : null);

  const handleContact = async () => {
    if (!form.name.trim() || !form.mobile.trim()) {
      toast("Name and mobile are required", "warning");
      return;
    }
    const nums = form.mobile.split(",").map(s => s.trim()).filter(Boolean);
    const invalid = nums.find(n => n.replace(/\D/g, "").length < 10);
    if (invalid) { toast("Each mobile number must have at least 10 digits", "warning"); return; }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast("Please enter a valid email address", "warning"); return;
    }
    if (!form.consent) {
      toast("Please accept the privacy notice to continue", "warning"); return;
    }

    setSubmitting(true);
    try {
      const res = await API.post(`/property/${propertyId}/contact`, form);
      setSubmitMsg(res.data?.message || "Thank you! Our team will contact you shortly.");
      setSubmitted(true);
      trackEvent("generate_lead", {
        content_type: "property",
        item_id: propertyId,
        content_name: property?.title,
        item_location: property?.location,
      });
    } catch (err: any) {
      toast(err.response?.data?.error || "Something went wrong", "error");
    }
    setSubmitting(false);
  };

  const closeModal = () => {
    setShowModal(false);
    setSubmitted(false);
    setSubmitMsg("");
    setForm({ name: "", email: "", mobile: "", consent: false, timeframe: "", preferred_location: "", budget: "" });
  };

  if (!property) {
    return <div className="p-10">Loading...</div>;
  }

  const shareUrl = propertyId
    ? `${SITE_URL}${propertyHref(propertyId, property.title)}`
    : SITE_URL;

  return (
    <div className="p-6 md:p-10 bg-gray-50 min-h-screen">

      {/* TOP SECTION: IMAGE + DETAILS */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* IMAGE */}
        <div className="bg-white p-4 rounded-xl shadow">
          <ImageSlider images={property.images} alt={property.title} />
        </div>

        {/* PROPERTY DETAILS */}
        <div className="bg-white p-6 rounded-xl shadow flex flex-col justify-between">
          <div>
            <h1 className="text-2xl font-bold">{property.title}</h1>

            <p className="text-xl font-semibold mt-2" style={{ color: "var(--primary)" }}>
              {formatPriceDisplay(property.price, property.price_text)}
            </p>

            <p className="text-gray-500 mt-2">
              📍 {property.location}
            </p>

            <div className="flex flex-wrap gap-2 mt-3">
              {property.transaction_type && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                  {property.transaction_type === "rent" ? "For Rent" : property.transaction_type === "resale" ? "Resale" : property.transaction_type === "buy" ? "Buy" : "For Sale"}
                </span>
              )}
              {property.property_type && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium capitalize">{property.property_type}</span>
              )}
              {property.listed_by && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium capitalize">Listed by {property.listed_by}</span>
              )}
              {property.rera_details && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">RERA: {property.rera_details}</span>
              )}
            </div>

            <ShareButtons
              className="mt-4"
              url={shareUrl}
              title={property.title}
              price={formatPriceDisplay(property.price, property.price_text)}
              location={property.location}
              captionTemplate={settings.share_caption_template}
            />

            <hr className="my-4" />

            <h3 className="font-semibold text-lg mb-2">Description</h3>
            <p className="text-gray-700">
              {property.description || "No description available"}
            </p>

            {property.field_values && property.field_values.length > 0 && (
              <>
                <hr className="my-4" />
                <h3 className="font-semibold text-lg mb-3">Property Features</h3>
                <div className="grid grid-cols-2 gap-3">
                  {property.field_values.map((fv: any) => (
                    <div key={fv.field_key} className="bg-gray-50 rounded-lg p-3">
                      <span className="text-xs block" style={{ color: "var(--text-muted)" }}>{fv.field_label}</span>
                      <span className="font-semibold text-sm" style={{ color: "var(--text-dark)" }}>{fv.field_value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* CONNECT BUTTON */}
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary w-full mt-6"
          >
            Connect
          </button>
        </div>

      </div>

      {/* CONTACT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">

            {/* CLOSE */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl"
            >
              ✕
            </button>

            {submitted ? (
              /* SUCCESS STATE */
              <div className="text-center py-8">
                <div className="text-5xl mb-4">✓</div>
                <h3 className="text-xl font-bold text-green-600 mb-2">Thank You!</h3>
                <p className="text-gray-500 mb-6">
                  {submitMsg}
                </p>
                <button
                  onClick={closeModal}
                  className="btn btn-ghost"
                >
                  Close
                </button>
              </div>
            ) : (
              /* FORM STATE */
              <>
                <h3 className="text-xl font-bold mb-1">Interested in this property?</h3>
                <p className="text-gray-500 text-sm mb-5">
                  {property.title} — {formatPriceDisplay(property.price, property.price_text)}
                </p>

                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Your Name *"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    disabled={submitting}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />

                  <input
                    type="email"
                    placeholder="Email (optional)"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    disabled={submitting}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />

                  <input
                    type="tel"
                    placeholder="Mobile Number *"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    disabled={submitting}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                  <p className="text-xs text-gray-400 mt-1">For multiple numbers, separate with comma</p>

                  <select
                    value={form.timeframe}
                    onChange={(e) => setForm({ ...form, timeframe: e.target.value })}
                    disabled={submitting}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-gray-700"
                  >
                    <option value="">When are you planning to buy? (optional)</option>
                    {TIMEFRAME_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder="Preferred location (optional)"
                    value={form.preferred_location}
                    onChange={(e) => setForm({ ...form, preferred_location: e.target.value })}
                    disabled={submitting}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />

                  <select
                    value={form.budget}
                    onChange={(e) => setForm({ ...form, budget: e.target.value })}
                    disabled={submitting}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-gray-700"
                  >
                    <option value="">Budget (optional)</option>
                    {BUDGET_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>

                  <ConsentCheckbox
                    checked={form.consent}
                    onChange={(v) => setForm({ ...form, consent: v })}
                    disabled={submitting}
                    className="pt-1"
                  />

                  <button
                    onClick={handleContact}
                    disabled={submitting}
                    className="btn btn-primary w-full"
                  >
                    {submitting ? "Sending..." : "Submit"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* PREV / NEXT NAVIGATION (floating circular buttons) */}
      {allIds.length > 1 && (
        <>
          {prevId && (
            <Link
              href={propertyHref(prevId, navTitles[prevId], navCtx)}
              aria-label="Previous property"
              className="fixed left-2 md:left-4 top-1/2 -translate-y-1/2 z-40 w-10 h-10 md:w-12 md:h-12 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:bg-white transition"
            >
              <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </Link>
          )}

          {nextId && (
            <Link
              href={propertyHref(nextId, navTitles[nextId], navCtx)}
              aria-label="Next property"
              className="fixed right-2 md:right-4 top-1/2 -translate-y-1/2 z-40 w-10 h-10 md:w-12 md:h-12 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:bg-white transition"
            >
              <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          )}

          <span className="fixed left-1/2 -translate-x-1/2 bottom-4 z-40 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
            {currentIndex + 1} / {allIds.length}
          </span>
        </>
      )}

    </div>
  );
}
