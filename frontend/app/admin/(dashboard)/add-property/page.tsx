"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import API from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";
import ImageUploader from "@/components/ImageUploader";
import DynamicField, { type FieldDef } from "@/components/post-property/DynamicField";
import PriceInput from "@/components/post-property/PriceInput";
import KeyFeaturesSelect from "@/components/post-property/KeyFeaturesSelect";
import GeoPicker from "@/components/GeoPicker";
import { isPriceRequestOnly } from "@/lib/priceFormat";

function SectionHeader({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-gray-100">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--primary-light)" }}>{icon}</div>
      <h3 className="text-lg font-bold" style={{ color: "var(--text-dark)" }}>{title}</h3>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

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

export default function AddPropertyPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [form, setForm] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(true);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [existingImages, setExistingImages] = useState<Array<{ id: number; image_url: string; order: number }>>([]);
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
  }, []);

  useEffect(() => {
    const params = form.property_type ? `?property_type=${form.property_type}` : "";
    API.get(`/description-templates${params}`).then((r) => setTemplates(r.data)).catch(() => {});
  }, [form.property_type]);

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

  useEffect(() => {
    if (form.property_type && dynamicFields.length > 0 && !propertyId) {
      setFieldValue({});
      setSelectedTitleTmplId(null);
      setSelectedOverviewId(null);
      setSelectedClosingId(null);
      setSelectedChips([]);
    }
  }, [form.property_type, dynamicFields, propertyId]);

  const fetchExistingImages = async (pid: number) => {
    try {
      const res = await API.get(`/admin/property/${pid}`);
      setExistingImages((res.data.images || []).map((img: any) => ({ id: img.id, image_url: img.image_url, order: img.order })));
    } catch {}
  };

  const fetchExistingProperty = async (pid: number) => {
    try {
      const res = await API.get(`/admin/property/${pid}`);
      const p = res.data;
      setForm({
        title: p.title || "",
        description: p.description || "",
        transaction_type: p.transaction_type || "",
        property_type: p.property_type || "",
        listed_by: p.listed_by || "owner",
        location: p.location || "",
        latitude: p.latitude != null ? String(p.latitude) : "",
        longitude: p.longitude != null ? String(p.longitude) : "",
        price: p.price != null && Number(p.price) > 0 ? String(p.price) : "",
        price_text: p.price_text || "*",
        name: "",
        mobile: "",
        email: "",
        owner_name: p.owner_name || "",
        owner_mobile: p.owner_mobile || "",
        owner_email: p.owner_email || "",
      });
      if (p.field_values && Array.isArray(p.field_values)) {
        const fv: Record<string, string> = {};
        p.field_values.forEach((fvItem: any) => { fv[fvItem.field_key] = fvItem.field_value; });
        setFieldValue(fv);
      }
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

  const handleSubmit = async () => {
    if (form.owner_mobile?.trim()) {
      const nums = form.owner_mobile.split(",").map(s => s.trim()).filter(Boolean);
      const invalid = nums.find(n => n.replace(/\D/g, "").length < 10);
      if (invalid) { toast("Each mobile number must have at least 10 digits", "warning"); return; }
    }
    if (form.owner_email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.owner_email.trim())) {
      toast("Please enter a valid email address", "warning"); return;
    }
    if (!form.title?.trim()) { toast("Please enter a property title", "warning"); return; }
    const priceRequestOnly = isPriceRequestOnly(form.price_text || "*");
    if (!priceRequestOnly && !form.price?.trim()) { toast("Please enter a price", "warning"); return; }
    if (!priceRequestOnly && form.price?.trim() && isNaN(Number(form.price.replace(/[₹$,\s]/g, "")))) { toast("Please enter a valid price", "warning"); return; }
    if (!form.location?.trim()) { toast("Please enter a location", "warning"); return; }
    if (!form.transaction_type) { toast("Please select a listing intent", "warning"); return; }
    if (!form.property_type) { toast("Please select a property type", "warning"); return; }
    if (!form.listed_by) { toast("Please select Listed By", "warning"); return; }

    for (const field of dynamicFields) {
      if (field.is_required && (!fieldValues[field.field_key] || fieldValues[field.field_key] === "")) {
        toast(`Please select ${field.field_label}`, "warning");
        return;
      }
    }

    if (fieldValues.floor_level && fieldValues.total_floors) {
      const fl = parseFloor(fieldValues.floor_level);
      const tf = parseFloor(fieldValues.total_floors);
      if (fl !== null && tf !== null && tf < fl) {
        toast("Total Floors cannot be less than Floor Level", "warning");
        return;
      }
    }

    setLoading(true);
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

      if (selectedChips.length > 0) {
        const featureIds = presetFeatures.filter((f) => selectedChips.includes(f.label)).map((f) => f.id);
        formData.append("feature_ids", JSON.stringify(featureIds));
      }
      if (selectedOverviewId) formData.append("overview_template_id", String(selectedOverviewId));
      if (selectedClosingId) formData.append("closing_template_id", String(selectedClosingId));
      if (selectedTitleTmplId) formData.append("title_template_id", String(selectedTitleTmplId));

      files.forEach((file) => { formData.append("images", file); });

      if (propertyId) {
        await API.put(`/admin/property/${propertyId}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast("Property updated successfully", "success");
        setFiles([]);
        await fetchExistingImages(propertyId);
        if (galleryUrls.length > 0) {
          await API.post(`/admin/property/${propertyId}/gallery-images`, { urls: galleryUrls });
          setGalleryUrls([]);
          await fetchExistingImages(propertyId);
        }
      } else {
        const res = await API.post("/admin/property", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast(res.data.message, "success");
        setPropertyId(res.data.id);
        setFiles([]);
        if (galleryUrls.length > 0) {
          await API.post(`/admin/property/${res.data.id}/gallery-images`, { urls: galleryUrls });
          setGalleryUrls([]);
        }
        await fetchExistingImages(res.data.id);
      }
      setEditing(false);
    } catch (err: any) {
      toast(err.response?.data?.error || "Something went wrong", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    setEditing(true);
    if (propertyId) {
      await fetchExistingImages(propertyId);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setGalleryUrls([]);
    if (propertyId) {
      fetchExistingImages(propertyId);
      fetchExistingProperty(propertyId);
    }
  };

  const handleNew = () => {
    setForm({});
    setFiles([]);
    setGalleryUrls([]);
    setExistingImages([]);
    setEditing(true);
    setPropertyId(null);
    setFieldValue({});
    setDynamicFields([]);
    setSelectedTitleTmplId(null);
    setSelectedOverviewId(null);
    setSelectedClosingId(null);
    setSelectedChips([]);
  };

  const isDisabled = !editing;
  const inputClass = `form-input${isDisabled ? " bg-gray-50 text-gray-500 opacity-70 cursor-not-allowed" : ""}`;

  return (
    <div className="min-h-screen py-10 md:py-14 px-4 md:px-6 lg:px-10" style={{ backgroundColor: "var(--bg-page)" }}>

      <div className="max-w-7xl mx-auto mb-6 text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-2" style={{ color: "var(--text-dark)" }}>
          {propertyId ? "Edit Property" : "Add New Property"}
        </h1>
        <p className="text-sm md:text-base" style={{ color: "var(--text-muted)" }}>
          {propertyId ? "Update the property details below" : "Fill in the details to list a new property"}
        </p>
        {currentUser?.user_id && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-xs text-gray-600">
            <span className="font-semibold">Your User ID:</span>
            <span className="font-mono font-bold">{currentUser.user_id}</span>
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="rounded-2xl bg-white shadow-lg border border-gray-100" style={{ borderRadius: "16px" }}>
          <div className="p-6 md:p-8">

            {/* ──── Section 1: Listing Intent & Property Type ──── */}
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

            {/* ──── Section 2: Property Details (Dynamic) ──── */}
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

            {/* ──── Section 3: Features, Amenities & Highlights ──── */}
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

            {/* ──── Section 4: Location & Pricing ──── */}
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

            <div className="mb-6">
              <GeoPicker
                latitude={form.latitude || ""}
                longitude={form.longitude || ""}
                onChange={({ latitude, longitude }) => setForm({ ...form, latitude, longitude })}
                disabled={isDisabled}
                inputClass={inputClass}
              />
            </div>

            {/* ──── Section 5: Property Title & Description ──── */}
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
                      const id = Number(e.target.value) || null;
                      setSelectedTitleTmplId(id);
                      if (id) setForm((prev) => ({ ...prev, title: fillTemplate(((templates.title || []).find((t) => t.id === id)?.template_text) || "", templateVars, typeNames) }));
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
                <input
                  className={inputClass}
                  disabled={isDisabled}
                  placeholder="e.g. 2 BHK Apartment in Sadar"
                  value={form.title || ""}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Description</label>
                <textarea
                  className={`${inputClass} resize-none`}
                  disabled={isDisabled}
                  placeholder="Property description will appear here based on your selections above..."
                  rows={4}
                  value={form.description || composedDescription}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
                {!isDisabled && composedDescription && !form.description && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Auto-generated from your overview, selected features, and closing. Edit the field to customize.
                  </p>
                )}
              </div>
            </div>

            {/* ──── Section 6: Property Owner Contact ──── */}
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

            {/* ──── Section 7: Property Images ──── */}
            <SectionHeader
              icon={<svg className="w-5 h-5" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
              title="Property Images"
            />

            <ImageUploader
              existingImages={existingImages}
              files={files}
              onFilesChange={setFiles}
              galleryUrls={galleryUrls}
              onGalleryUrlsChange={setGalleryUrls}
              onReorderExisting={async (reordered) => {
                setExistingImages(reordered);
                if (propertyId) {
                  const payload = reordered.map((img, i) => ({ id: img.id, order: i + 1 }));
                  await API.post("/admin/reorder-images", payload);
                }
              }}
              onDeleteExisting={async (imageId) => {
                if (propertyId) {
                  try {
                    await API.delete(`/admin/delete-image/${imageId}`);
                    setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
                  } catch {}
                } else {
                  setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
                }
              }}
              disabled={isDisabled}
            />

          </div>
        </div>

      </div>

      {/* ──── Action Buttons ──── */}
      <div className="max-w-7xl mx-auto mt-6 flex items-center justify-end gap-3 pt-5 border-t border-gray-200">
        {editing ? (
          <>
            {propertyId && <button onClick={handleCancel} className="btn btn-ghost">Cancel</button>}
            <button onClick={handleNew} className="btn btn-ghost">New Property</button>
            <button onClick={handleSubmit} disabled={loading} className="btn btn-primary">
              {loading ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving...</>
              ) : propertyId ? "Save Changes" : "Submit Property"}
            </button>
          </>
        ) : (
          <>
            <button onClick={handleNew} className="btn btn-ghost">New Property</button>
            <button onClick={handleEdit} className="btn btn-primary" style={{ backgroundColor: "#eab308", borderColor: "#eab308" }}>Edit</button>
          </>
        )}
      </div>
    </div>
  );
}
