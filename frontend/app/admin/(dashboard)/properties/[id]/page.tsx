"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import API, { decodePropertyId, encodePropertyId } from "@/lib/api";
import { useToast } from "@/components/Toast";
import DynamicField, { type FieldDef } from "@/components/post-property/DynamicField";
import { isPriceRequestOnly } from "@/lib/priceFormat";

import ImageUploader from "@/components/ImageUploader";
import PriceInput from "@/components/post-property/PriceInput";
import KeyFeaturesSelect from "@/components/post-property/KeyFeaturesSelect";

type TemplateMap = Record<string, Array<{ id: number; template_text: string }>>;

const TXN_LABELS: Record<string, string> = { buy: "Buy", sell: "Sell", rent: "Rent", resale: "Resale" };

function fillTemplate(text: string, vars: Record<string, string>, typeNames: Record<string, string>, useTransactionLabel = true): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    if (key === "property_type") return vars[key] ? (typeNames[vars[key]] || vars[key]) : "[...]";
    if (key === "transaction_type") {
      const val = vars[key];
      if (!val) return "[...]";
      return useTransactionLabel ? (TXN_LABELS[val] || val) : val;
    }
    return vars[key] || "[...]";
  });
}

function SectionHeader({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-gray-100">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--primary-light)" }}>{icon}</div>
      <h3 className="text-lg font-bold" style={{ color: "var(--text-dark)" }}>{title}</h3>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

export default function PropertyDetail() {
  const { toast } = useToast();
  const { id } = useParams();
  const slug = id as string;
  const propertyId = decodePropertyId(slug);
  const router = useRouter();

  const [property, setProperty] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [nav, setNav] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [propertyTypes, setPropertyTypes] = useState<Array<{ name: string; value: string }>>([]);
  const [transactionTypes, setTransactionTypes] = useState<Array<{ name: string; value: string }>>([]);

  const [dynamicFields, setDynamicFields] = useState<FieldDef[]>([]);
  const [fieldValues, setFieldValue] = useState<Record<string, string>>({});
  const [fieldsLoading, setFieldsLoading] = useState(false);

  const [templates, setTemplates] = useState<TemplateMap>({});
  const [selectedTitleTmplId, setSelectedTitleTmplId] = useState<number | null>(null);
  const [selectedOverviewId, setSelectedOverviewId] = useState<number | null>(null);
  const [selectedClosingId, setSelectedClosingId] = useState<number | null>(null);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [presetFeatures, setPresetFeatures] = useState<Array<{ id: number; label: string; sentence: string }>>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);

  const typeNames = useMemo(() => Object.fromEntries(propertyTypes.map((t) => [t.value, t.name])), [propertyTypes]);

  const templateVars = useMemo(() => ({
    ...fieldValues, ...form,
  }), [form, fieldValues]);

  const previewTitle = useMemo(() => {
    if (!selectedTitleTmplId) return "";
    const tmpl = (templates.title || []).find((t) => t.id === selectedTitleTmplId);
    if (!tmpl) return "";
    return fillTemplate(tmpl.template_text, templateVars, typeNames);
  }, [selectedTitleTmplId, templates, templateVars, typeNames]);

  const composedDescription = useMemo(() => {
    const parts: string[] = [];
    if (selectedOverviewId) {
      const t = (templates.overview || []).find((tmpl) => tmpl.id === selectedOverviewId);
      if (t) parts.push(fillTemplate(t.template_text, templateVars, typeNames, false));
    }
    if (selectedChips.length > 0) {
      selectedChips.forEach((label) => {
        const feat = presetFeatures.find((f) => f.label === label);
        if (feat) parts.push(feat.sentence);
      });
    }
    if (selectedClosingId) {
      const t = (templates.closing || []).find((tmpl) => tmpl.id === selectedClosingId);
      if (t) parts.push(fillTemplate(t.template_text, templateVars, typeNames, false));
    }
    return parts.join(" ");
  }, [selectedOverviewId, selectedClosingId, selectedChips, templates, templateVars, typeNames]);

  useEffect(() => {
    API.get("/types?category=property").then((r) => setPropertyTypes(r.data)).catch(() => {});
    API.get("/types?category=transaction").then((r) => setTransactionTypes(r.data)).catch(() => {});
    API.get("/preset-features").then((r) => setPresetFeatures(r.data)).catch(() => {});
    if (!propertyId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        await Promise.all([fetchProperty(), fetchNav()]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  useEffect(() => {
    const params = form.property_type ? `?property_type=${form.property_type}` : "";
    API.get(`/description-templates${params}`).then((r) => setTemplates(r.data)).catch(() => {});
  }, [form.property_type]);

  useEffect(() => {
    if (!property || Object.keys(templates).length === 0) return;

    if (property.selected_features && property.selected_features.length > 0) {
      setSelectedChips(property.selected_features.map((f: { label: string }) => f.label));
    }
    if (property.overview_template_id) setSelectedOverviewId(property.overview_template_id);
    if (property.closing_template_id) setSelectedClosingId(property.closing_template_id);
    if (property.title_template_id) setSelectedTitleTmplId(property.title_template_id);

    if ((!property.selected_features || property.selected_features.length === 0) && !property.overview_template_id && form.description) {
      const desc = form.description;
      const matchedChips: string[] = [];
      presetFeatures.forEach((feat) => {
        if (desc.includes(feat.sentence)) matchedChips.push(feat.label);
      });
      if (matchedChips.length > 0) setSelectedChips(matchedChips);

      for (const t of (templates.overview || [])) {
        const filled = fillTemplate(t.template_text, templateVars, typeNames, false);
        if (filled && !filled.includes("[...]") && desc.includes(filled)) { setSelectedOverviewId(t.id); break; }
      }
      for (const t of (templates.closing || [])) {
        const filled = fillTemplate(t.template_text, templateVars, typeNames, false);
        if (filled && !filled.includes("[...]") && desc.includes(filled)) { setSelectedClosingId(t.id); break; }
      }
      for (const t of (templates.title || [])) {
        const filled = fillTemplate(t.template_text, templateVars, typeNames);
        if (filled && !filled.includes("[...]") && form.title === filled) { setSelectedTitleTmplId(t.id); break; }
      }
    }
  }, [property, templates, fieldValues, form.description, form.title, presetFeatures, typeNames]);

  useEffect(() => {
    if (form.property_type) {
      setFieldsLoading(true);
      API.get(`/property-type-fields/${form.property_type}`)
        .then((r) => setDynamicFields(r.data))
        .catch(() => setDynamicFields([]))
        .finally(() => setFieldsLoading(false));
    } else {
      setDynamicFields([]);
    }
  }, [form.property_type]);

  const fetchProperty = async () => {
    try {
      const res = await API.get(`/admin/property/${propertyId}`);
      const p = res.data;
      setProperty(p);
      setForm({
        title: p.title || "",
        description: p.description || "",
        transaction_type: p.transaction_type || "",
        property_type: p.property_type || "",
        listed_by: p.listed_by || "owner",
        rera_details: p.rera_details || "",
        location: p.location || "",
        price: p.price != null && Number(p.price) > 0 ? String(p.price) : "",
        price_text: p.price_text || "*",
        owner_name: p.owner_name || "",
        owner_mobile: p.owner_mobile || "",
        owner_email: p.owner_email || "",
      });
      if (p.field_values && Array.isArray(p.field_values)) {
        const fv: Record<string, string> = {};
        p.field_values.forEach((fvItem: any) => { fv[fvItem.field_key] = fvItem.field_value; });
        setFieldValue(fv);
      }
    } catch (err: any) {
      if (err?.response?.status === 401) router.replace("/admin");
    }
  };

  const fetchNav = async () => {
    try {
      const res = await API.get(`/admin/property-nav/${propertyId}`);
      setNav(res.data);
    } catch (err: any) {
      if (err?.response?.status === 401) router.replace("/admin");
    }
  };

  const handleDelete = async () => {
    try {
      await API.delete(`/admin/property/${propertyId}`);
      toast("Property deleted successfully", "success");
      setShowDeleteModal(false);
      router.push("/admin/dashboard");
    } catch {}
  };

  const parseFloor = (v: string) => {
    const m = v.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : v === "Ground" ? 0 : null;
  };

  const handleFieldValueChange = useCallback((key: string, value: string) => {
    if (key === "total_floors" && value) {
      const prevFl = fieldValues.floor_level;
      if (prevFl) {
        const fl = parseFloor(prevFl);
        const tf = parseFloor(value);
        if (fl !== null && tf !== null && tf < fl) {
          toast("Total Floors cannot be less than Floor Level", "warning");
          return;
        }
      }
    }
    if (key === "floor_level" && value) {
      const prevTf = fieldValues.total_floors;
      if (prevTf) {
        const fl = parseFloor(value);
        const tf = parseFloor(prevTf);
        if (fl !== null && tf !== null && tf < fl) {
          toast("Floor Level cannot exceed Total Floors", "warning");
          return;
        }
      }
    }
    setFieldValue((prev) => ({ ...prev, [key]: value }));
  }, [fieldValues, toast]);

  const handleSave = async () => {
    if (form.owner_mobile?.trim()) {
      const nums = form.owner_mobile.split(",").map(s => s.trim()).filter(Boolean);
      const invalid = nums.find(n => n.replace(/\D/g, "").length < 10);
      if (invalid) { toast("Each mobile number must have at least 10 digits", "warning"); return; }
    }
    if (form.owner_email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.owner_email.trim())) {
      toast("Please enter a valid email address", "warning"); return;
    }
    if (!form.title?.trim()) { toast("Title is required", "warning"); return; }
    const priceRequestOnly = isPriceRequestOnly(form.price_text || "*");
    if (!priceRequestOnly && !String(form.price).trim()) { toast("Price is required", "warning"); return; }
    if (!priceRequestOnly && String(form.price).trim() && isNaN(Number(form.price.replace(/[₹$,\s]/g, "")))) { toast("Please enter a valid price", "warning"); return; }
    if (!form.location?.trim()) { toast("Location is required", "warning"); return; }
    if (!form.listed_by) { toast("Please select Listed By", "warning"); return; }

    for (const field of dynamicFields) {
      if (field.is_required && (!fieldValues[field.field_key] || fieldValues[field.field_key] === "")) {
        toast(`Please select ${field.field_label}`, "warning");
        return;
      }
    }

    setSaving(true);
    try {
      const formData = new FormData();
      Object.keys(form).forEach((key) => {
        if (form[key] !== undefined && form[key] !== null) {
          formData.append(key, form[key]);
        }
      });

      if (!form.description && composedDescription) {
        formData.set("description", composedDescription);
      }

      const fvArray = Object.entries(fieldValues)
        .filter(([_, v]) => v !== "" && v != null)
        .map(([field_key, field_value]) => ({ field_key, field_value }));

      if (fvArray.length > 0) {
        formData.append("field_values", JSON.stringify(fvArray));
      }

      const featureIds = presetFeatures.filter((f) => selectedChips.includes(f.label)).map((f) => f.id);
      formData.append("feature_ids", JSON.stringify(featureIds));
      if (selectedOverviewId) formData.append("overview_template_id", String(selectedOverviewId));
      else formData.append("overview_template_id", "");
      if (selectedClosingId) formData.append("closing_template_id", String(selectedClosingId));
      else formData.append("closing_template_id", "");
      if (selectedTitleTmplId) formData.append("title_template_id", String(selectedTitleTmplId));
      else formData.append("title_template_id", "");

      await API.put(`/admin/property/${propertyId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (newFiles.length > 0) {
        const imgFormData = new FormData();
        for (const f of newFiles) imgFormData.append("images", f);
        await API.post(`/admin/upload-images/${propertyId}`, imgFormData);
        setNewFiles([]);
      }
      if (galleryUrls.length > 0) {
        await API.post(`/admin/property/${propertyId}/gallery-images`, { urls: galleryUrls });
        setGalleryUrls([]);
      }
      toast("Property updated successfully", "success");
      await fetchProperty();
      setEditing(false);
    } catch (err: any) {
      if (err?.response?.status === 401) router.replace("/admin");
      else toast(err.response?.data?.error || "Save failed", "error");
    }
    setSaving(false);
  };

  const handleAction = async (action: string) => {
    try {
      await API.post(`/admin/${action}/${propertyId}`);
      await fetchProperty();
      if (action === "close") setEditing(false);
    } catch (err: any) {
      if (err?.response?.status === 401) router.replace("/admin");
      else toast(err.response?.data?.error || `Failed to ${action}`, "error");
    }
  };

  const lifecycleAction = async (path: string, body: Record<string, any> = {}) => {
    setLifecycleBusy(true);
    try {
      await API.post(path, body);
      toast("Listing updated", "success");
      await fetchProperty();
    } catch (err: any) {
      if (err?.response?.status === 401) router.replace("/admin");
      else toast(err?.response?.data?.error || "Action failed", "error");
    } finally {
      setLifecycleBusy(false);
    }
  };

  if (loading) return <div className="p-3 md:p-6">Loading...</div>;
  if (!propertyId) return (
    <div className="p-3 md:p-6 text-center">
      <p className="text-red-500 text-lg mb-4">Invalid property link.</p>
      <button onClick={() => router.push("/admin/properties")} className="bg-gray-600 text-white px-4 py-2 rounded text-sm">Back to Properties</button>
    </div>
  );
  if (!property) return <div className="p-3 md:p-6 text-red-500">Property not found</div>;

  const isDisabled = !editing;
  const inputClass = `form-input${isDisabled ? " bg-gray-50 text-gray-500 opacity-70 cursor-not-allowed" : ""}`;

  return (
    <div className="max-w-6xl mx-auto p-3 md:p-6">

      {/* STATUS BADGE */}
      <div className="mb-3">
        <span className={`inline-block px-3 py-1 rounded text-white text-sm font-medium ${
          property.is_closed ? "bg-gray-600" :
          property.status === "approved" ? "bg-green-500" :
          property.status === "rejected" ? "bg-red-500" : "bg-yellow-500"
        }`}>
          {property.is_closed ? "Closed" : property.status ? property.status.charAt(0).toUpperCase() + property.status.slice(1) : "Pending"}
        </span>
      </div>

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 md:mb-6">
        <h1 className="text-lg md:text-2xl font-bold truncate">{form.title || "Property Detail"}</h1>
        <div className="flex gap-2 flex-wrap">
          {nav?.prev_id && (
            <button onClick={() => router.push(`/admin/properties/${encodePropertyId(nav.prev_id)}`)} className="bg-gray-300 px-3 py-2 rounded text-sm">← Prev</button>
          )}
          {nav?.next_id && (
            <button onClick={() => router.push(`/admin/properties/${encodePropertyId(nav.next_id)}`)} className="bg-gray-300 px-3 py-2 rounded text-sm">Next →</button>
          )}
          <button onClick={() => router.push("/admin/properties")} className="bg-gray-600 text-white px-4 py-2 rounded text-sm">Back</button>
        </div>
      </div>

      {property.owner_id != null && (() => {
        const expMs = property.expires_at ? new Date(property.expires_at).getTime() : null;
        const expired = expMs != null && expMs < Date.now();
        const paidCls = property.payment_status === "paid" ? "bg-emerald-100 text-emerald-700"
          : property.payment_status === "waived" ? "bg-blue-100 text-blue-700"
          : "bg-orange-100 text-orange-700";
        const featured = property.featured_until && new Date(property.featured_until) > new Date();
        return (
          <div className="max-w-4xl mx-auto mb-4 rounded-xl bg-white shadow border border-gray-100 p-4">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h2 className="font-semibold text-gray-800">Listing Status</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${paidCls}`}>
                Payment: {property.payment_status}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                expired ? "bg-red-100 text-red-600" : expMs ? "bg-gray-100 text-gray-600" : "bg-gray-100 text-gray-500"
              }`}>
                {expMs ? (expired ? "Expired " : "Expires ") + new Date(property.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No expiry"}
              </span>
              {featured && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                  ★ Featured until {new Date(property.featured_until).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {property.payment_status !== "paid" && (
                <button disabled={lifecycleBusy} onClick={() => lifecycleAction(`/admin/payments/properties/${propertyId}/waive`)}
                  className="px-3 py-1.5 rounded text-sm bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
                  Waive Payment & Publish
                </button>
              )}
              <button disabled={lifecycleBusy} onClick={() => lifecycleAction(`/admin/payments/properties/${propertyId}/grant-days`, { duration_days: 30 })}
                className="px-3 py-1.5 rounded text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50">
                Grant +30 days
              </button>
              <button disabled={lifecycleBusy} onClick={() => lifecycleAction(`/admin/payments/properties/${propertyId}/grant-days`, { duration_days: 90 })}
                className="px-3 py-1.5 rounded text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50">
                Grant +90 days
              </button>
              <button disabled={lifecycleBusy} onClick={() => lifecycleAction(`/admin/payments/properties/${propertyId}/feature`, { featured_days: 30 })}
                className="px-3 py-1.5 rounded text-sm border border-yellow-300 text-yellow-700 hover:bg-yellow-50 disabled:opacity-50">
                ★ Feature 30 days
              </button>
            </div>
          </div>
        );
      })()}

      <div className="max-w-4xl mx-auto">
        {property?.uploader?.user_id && (
          <div className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-xs text-gray-600">
            <span className="font-semibold">Uploaded by:</span>
            <span className="font-mono font-bold">{property.uploader.user_id}</span>
            {property.uploader.display_name && (
              <span className="text-gray-400">({property.uploader.display_name})</span>
            )}
          </div>
        )}
        <div className="rounded-2xl bg-white shadow-lg border border-gray-100" style={{ borderRadius: "16px" }}>
          <div className="p-6 md:p-8">

            {/* Section 1: Listing Intent & Property Type */}
            <SectionHeader
              icon={<svg className="w-5 h-5" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></svg>}
              title="Listing Intent & Property Type"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Listing Intent <span className="text-red-500">*</span></label>
                <select className={inputClass} disabled={isDisabled} value={form.transaction_type || ""} onChange={(e) => setForm({ ...form, transaction_type: e.target.value })}>
                  <option value="">Select Intent</option>
                  {transactionTypes.map((t) => (<option key={t.value} value={t.value}>{t.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Property Type <span className="text-red-500">*</span></label>
                <select className={inputClass} disabled={isDisabled} value={form.property_type || ""} onChange={(e) => setForm({ ...form, property_type: e.target.value })}>
                  <option value="">Select Type</option>
                  {propertyTypes.map((t) => (<option key={t.value} value={t.value}>{t.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Listed By <span className="text-red-500">*</span></label>
                <select className={inputClass} disabled={isDisabled} value={form.listed_by || ""} onChange={(e) => setForm({ ...form, listed_by: e.target.value })}>
                  <option value="">Select</option>
                  <option value="owner">Owner</option>
                  <option value="agent">Agent</option>
                  <option value="broker">Broker</option>
                </select>
              </div>
            </div>

            {/* Section 2: Property Details (Dynamic) */}
            {form.property_type && dynamicFields.length > 0 && (
              <>
                <SectionHeader
                  icon={<svg className="w-5 h-5" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                  title="Property Details"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {dynamicFields.map((field) => (
                    <div key={field.field_key}>
                      <DynamicField field={field} value={fieldValues[field.field_key] || ""} onChange={handleFieldValueChange} disabled={isDisabled} />
                    </div>
                  ))}
                </div>
              </>
            )}
            {form.property_type && fieldsLoading && (<div className="text-sm text-gray-400 mb-4">Loading property fields...</div>)}

            {/* Section 3: Features, Amenities & Highlights */}
            {form.property_type && (
              <>
                <SectionHeader
                  icon={<svg className="w-5 h-5" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>}
                  title="Features, Amenities & Highlights"
                />
                <KeyFeaturesSelect
                  features={presetFeatures}
                  selected={selectedChips}
                  onToggle={(lbl) => setSelectedChips((prev) => prev.includes(lbl) ? prev.filter((c) => c !== lbl) : [...prev, lbl])}
                  onFeatureAdded={(feat) => setPresetFeatures((prev) => prev.some((f) => f.label === feat.label) ? prev : [...prev, feat])}
                  createEndpoint="admin"
                  disabled={isDisabled}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Overview</label>
                    <select className={inputClass} disabled={isDisabled} value={selectedOverviewId || ""} onChange={(e) => setSelectedOverviewId(Number(e.target.value) || null)}>
                      <option value="">Select overview...</option>
                      {(templates.overview || []).map((t) => (
                        <option key={t.id} value={t.id}>{fillTemplate(t.template_text, templateVars, typeNames, false)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Closing</label>
                    <select className={inputClass} disabled={isDisabled} value={selectedClosingId || ""} onChange={(e) => setSelectedClosingId(Number(e.target.value) || null)}>
                      <option value="">Select closing...</option>
                      {(templates.closing || []).map((t) => (
                        <option key={t.id} value={t.id}>{fillTemplate(t.template_text, templateVars, typeNames, false)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Section 4: Location & Pricing */}
            <SectionHeader
              icon={<svg className="w-5 h-5" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
              title="Location & Pricing"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Location <span className="text-red-500">*</span></label>
                <input className={inputClass} disabled={isDisabled} placeholder="e.g. Dharampeth, Nagpur" value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Price <span className="text-red-500">*</span></label>
                <PriceInput
                  value={form.price || ""}
                  priceText={form.price_text || "*"}
                  onChange={(val) => setForm({ ...form, price: val })}
                  onPriceTextChange={(text) => setForm({ ...form, price_text: text })}
                  inputClass={inputClass}
                  disabled={isDisabled}
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>
                RERA Details <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
              </label>
              <input
                className={inputClass}
                disabled={isDisabled}
                placeholder="e.g. RERA Reg. No. P50500012345"
                value={form.rera_details || ""}
                onChange={(e) => setForm({ ...form, rera_details: e.target.value })}
              />
            </div>

            {/* Section 5: Property Owner Contact */}
            <SectionHeader
              icon={<svg className="w-5 h-5" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}
              title="Property Owner Contact"
              right={<span className="text-xs font-normal px-2 py-1 rounded-full bg-amber-50 text-amber-600">Optional</span>}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Owner Name</label>
                <input className={inputClass} disabled={isDisabled} placeholder="Property owner's full name" value={form.owner_name || ""} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Owner Mobile</label>
                <input className={inputClass} disabled={isDisabled} placeholder="10-digit mobile number" value={form.owner_mobile || ""} onChange={(e) => setForm({ ...form, owner_mobile: e.target.value })} />
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>For multiple numbers, separate with comma</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Owner Email <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span></label>
                <input className={inputClass} disabled={isDisabled} placeholder="owner@example.com" value={form.owner_email || ""} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} />
              </div>
            </div>

            {/* Section 6: Property Title & Description */}
            <SectionHeader
              icon={<svg className="w-5 h-5" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
              title="Property Title & Description"
            />
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Property Title <span className="text-red-500">*</span></label>
                {!isDisabled && (templates.title || []).length > 0 && (
                  <select
                    className="form-input mb-2"
                    value={selectedTitleTmplId || ""}
                    onChange={(e) => {
                      const tid = Number(e.target.value) || null;
                      setSelectedTitleTmplId(tid);
                      if (tid) setForm((prev) => ({ ...prev, title: fillTemplate((templates.title || []).find((t) => t.id === tid)!.template_text, templateVars, typeNames) }));
                    }}
                  >
                    <option value="">Choose a title template...</option>
                    {(templates.title || []).map((t) => (
                      <option key={t.id} value={t.id}>{fillTemplate(t.template_text, templateVars, typeNames)}</option>
                    ))}
                  </select>
                )}
                {!isDisabled && previewTitle && !form.title && (
                  <p className="text-sm mb-2 px-3 py-2 rounded-lg" style={{ color: "var(--text-muted)", backgroundColor: "var(--primary-light)" }}>
                    Preview: {previewTitle}
                  </p>
                )}
                <input className={inputClass} disabled={isDisabled} placeholder="e.g. 2 BHK Apartment in Sadar" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Description</label>
                <textarea className={`${inputClass} resize-none`} disabled={isDisabled} placeholder="Property description..." rows={4} value={form.description || composedDescription} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                {!isDisabled && composedDescription && !form.description && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Auto-generated from your overview, selected features, and closing. Edit the field to customize.
                  </p>
                )}
              </div>
            </div>

            {/* Section 7: Property Images */}
            <SectionHeader
              icon={<svg className="w-5 h-5" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
              title="Property Images"
            />

            <ImageUploader
              existingImages={property.images || []}
              files={newFiles}
              onFilesChange={setNewFiles}
              galleryUrls={galleryUrls}
              onGalleryUrlsChange={setGalleryUrls}
              onReorderExisting={async (reordered) => {
                setProperty({ ...property, images: reordered });
                const payload = reordered.map((img, i) => ({ id: img.id, order: i + 1 }));
                await API.post("/admin/reorder-images", payload);
              }}
              onDeleteExisting={async (imageId) => {
                try {
                  await API.delete(`/admin/delete-image/${imageId}`);
                  fetchProperty();
                } catch {}
              }}
              disabled={!editing}
            />

          </div>
        </div>

      </div>

      {/* ACTION BUTTONS */}
      <div className="flex flex-wrap justify-center gap-2 mt-6">
        {editing ? (
          <>
            <button onClick={() => { setEditing(false); setGalleryUrls([]); setNewFiles([]); fetchProperty(); }} className="btn btn-ghost">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            disabled={property.is_closed || property.status === "rejected"}
            className={`px-4 py-2 rounded text-sm font-medium ${
              property.is_closed || property.status === "rejected" ? "bg-blue-300 text-white cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            Edit
          </button>
        )}
        <button onClick={() => handleAction("approve")} disabled={property.status !== "pending"} className={`px-4 py-2 rounded text-sm text-white ${property.status !== "pending" ? "bg-green-300 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"}`}>Approve</button>
        <button onClick={() => handleAction("reject")} disabled={property.status !== "pending"} className={`px-4 py-2 rounded text-sm text-white ${property.status !== "pending" ? "bg-red-300 cursor-not-allowed" : "bg-red-500 hover:bg-red-600"}`}>Reject</button>
        {property.is_closed ? (
          <button onClick={() => handleAction("reopen")} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm">Reopen</button>
        ) : (
          <button onClick={() => handleAction("close")} className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded text-sm">Close</button>
        )}
        <button onClick={() => setShowDeleteModal(true)} disabled={!property.is_closed} className={`px-4 py-2 rounded text-sm text-white ${!property.is_closed ? "bg-red-300 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"}`}>Delete</button>
      </div>

      {!property.is_closed && (
        <p className="text-xs text-gray-400 mt-2">Property must be closed before it can be deleted.</p>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-4 md:p-6 w-full max-w-[400px] mx-4 shadow-lg">
            <h2 className="text-lg font-semibold mb-3">Confirm Delete</h2>
            <p className="text-gray-600 mb-3">Are you sure you want to delete this property? This action cannot be undone.</p>
            {!property.is_closed && <p className="text-red-500 text-sm mb-4">This property is not closed yet. Please close it first before deleting.</p>}
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={handleDelete} disabled={!property.is_closed} className={`px-4 py-2 rounded text-white ${property.is_closed ? "bg-red-600 hover:bg-red-700" : "bg-red-300 cursor-not-allowed"}`}>Delete</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
