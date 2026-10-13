"use client";

import { useEffect, useState } from "react";
import API, { decodePropertyId, encodePropertyId } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useParams } from "next/navigation";
import ImageSlider from "@/components/ImageSlider";
import Link from "next/link";
import { formatPriceDisplay } from "@/lib/priceFormat";
import { sortProperties } from "@/lib/propertySort";

export default function PropertyDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const slug = id as string;
  const propertyId = decodePropertyId(slug);

  const [property, setProperty] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [allIds, setAllIds] = useState<number[]>([]);
  const [navCtx, setNavCtx] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", mobile: "" });

  useEffect(() => {
    const search =
      typeof window !== "undefined" && window.location.search
        ? window.location.search.slice(1)
        : "";
    setNavCtx(search);

    const sp = new URLSearchParams(search);
    const filters = new URLSearchParams();
    ["location", "type", "category", "min_price", "max_price", "featured"].forEach((key) => {
      const value = sp.get(key);
      if (value) filters.set(key, value);
    });
    const sortBy = sp.get("sort") || "newest";
    const filterStr = filters.toString();

    const loadNav = async () => {
      try {
        const qs = filterStr ? `${filterStr}&per_page=200` : "per_page=200";
        const res = await API.get(`/properties?${qs}`);
        const items = Array.isArray(res.data) ? res.data : res.data?.items || [];
        let ids = sortProperties(items, sortBy).map((p: any) => p.id);
        if (propertyId && !ids.includes(propertyId)) {
          const all = await API.get("/properties?per_page=200");
          const allItems = Array.isArray(all.data) ? all.data : all.data?.items || [];
          ids = sortProperties(allItems, "newest").map((p: any) => p.id);
        }
        setAllIds(ids);
      } catch {
        /* ignore navigation errors */
      }
    };
    loadNav();
  }, [propertyId]);

  useEffect(() => {
    if (propertyId) {
      API.get(`/property/${propertyId}`)
        .then((res) => setProperty(res.data))
        .catch(() => setNotFound(true));
    } else {
      setNotFound(true);
    }
  }, [propertyId]);

  if (notFound || !propertyId) {
    return (
      <div className="p-10 text-center min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-4xl font-bold text-gray-300 mb-4">404</h1>
        <p className="text-gray-500 mb-6">Property not found or invalid link.</p>
        <a href="/properties" className="hover:underline font-medium" style={{ color: "var(--primary)" }}>Browse Properties →</a>
      </div>
    );
  }

  const currentIndex = allIds.indexOf(propertyId);
  const prevId = currentIndex > 0 ? allIds[currentIndex - 1] : null;
  const nextId = currentIndex < allIds.length - 1 ? allIds[currentIndex + 1] : null;

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

    setSubmitting(true);
    try {
      const res = await API.post(`/property/${propertyId}/contact`, form);
      setSubmitMsg(res.data?.message || "Thank you! Our team will contact you shortly.");
      setSubmitted(true);
    } catch (err: any) {
      toast(err.response?.data?.error || "Something went wrong", "error");
    }
    setSubmitting(false);
  };

  const closeModal = () => {
    setShowModal(false);
    setSubmitted(false);
    setSubmitMsg("");
    setForm({ name: "", email: "", mobile: "" });
  };

  if (!property) {
    return <div className="p-10">Loading...</div>;
  }

  return (
    <div className="p-6 md:p-10 bg-gray-50 min-h-screen">

      {/* TOP SECTION: IMAGE + DETAILS */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* IMAGE */}
        <div className="bg-white p-4 rounded-xl shadow">
          <ImageSlider images={property.images} />
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

      {/* PREV / NEXT NAVIGATION */}
      {allIds.length > 1 && (
        <div className="flex justify-between items-center mt-8">
          {prevId ? (
            <Link
              href={`/property/${encodePropertyId(prevId)}${navCtx ? `?${navCtx}` : ""}`}
              className="flex items-center gap-2 btn btn-ghost !px-5 !py-2.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </Link>
          ) : (
            <div />
          )}

          <span className="text-sm text-gray-400">
            {currentIndex + 1} / {allIds.length}
          </span>

          {nextId ? (
            <Link
              href={`/property/${encodePropertyId(nextId)}${navCtx ? `?${navCtx}` : ""}`}
              className="flex items-center gap-2 btn btn-ghost !px-5 !py-2.5"
            >
              Next
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ) : (
            <div />
          )}
        </div>
      )}

    </div>
  );
}
