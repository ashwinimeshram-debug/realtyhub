"use client";

import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import API from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";
import { processImages } from "@/lib/imageProcessor";
import ImageUploader from "@/components/ImageUploader";
import DynamicField, { type FieldDef } from "@/components/post-property/DynamicField";
import PriceInput from "@/components/post-property/PriceInput";
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

const TXN_BUYER_LABEL: Record<string, string> = { sell: "Buy", rent: "Rent" };

function fillTemplate(text: string, vars: Record<string, string>, typeNames: Record<string, string>, useTransactionLabel = true): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    if (key === "property_type") return vars[key] ? (typeNames[vars[key]] || vars[key]) : "[...]";
    if (key === "transaction_type") {
      const val = vars[key];
      if (!val) return "[...]";
      return useTransactionLabel ? (TXN_BUYER_LABEL[val] || val) : val;
    }
    return vars[key] || "[...]";
  });
}

interface ExistingImage {
  id: number;
  image_url: string;
  order: number;
}

function PostPropertyForm() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { owner, loading: authLoading } = useOwnerAuth();

  const editParam = searchParams.get("edit");
  const editId = editParam && /^\d+$/.test(editParam) ? Number(editParam) : null;
  const isEdit = !!editId;

  const [form, setForm] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [propertyTypes, setPropertyTypes] = useState<Array<{ name: string; value: string }>>([]);
  const [transactionTypes, setTransactionTypes] = useState<Array<{ name: string; value: string }>>([]);
  const [siteName, setSiteName] = useState("Nagpur Realty Hub");

  const [dynamicFields, setDynamicFields] = useState<FieldDef[]>([]);
  const [fieldValues, setFieldValue] = useState<Record<string, string>>({});
  const [lang, setLang] = useState<"en" | "mr" | "hi">("en");
  const [fieldsLoading, setFieldsLoading] = useState(false);

  const [templates, setTemplates] = useState<TemplateMap>({});
  const [selectedTitleTmplId, setSelectedTitleTmplId] = useState<number | null>(null);
  const [selectedOverviewId, setSelectedOverviewId] = useState<number | null>(null);
  const [selectedClosingId, setSelectedClosingId] = useState<number | null>(null);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [presetFeatures, setPresetFeatures] = useState<Array<{ id: number; label: string; sentence: string }>>([]);

  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [removeImageIds, setRemoveImageIds] = useState<number[]>([]);
  const [detailLoading, setDetailLoading] = useState(isEdit);
  const [detailError, setDetailError] = useState("");

  const [editPreload, setEditPreload] = useState<{
    fieldValues: Record<string, string>;
    featureIds: number[];
    titleId: number | null;
    overviewId: number | null;
    closingId: number | null;
  } | null>(null);

  const typeNames = useMemo(() => Object.fromEntries(propertyTypes.map((t) => [t.value, t.name])), [propertyTypes]);

  const templateVars = useMemo(() => ({
    ...fieldValues, ...form,
  }), [form, fieldValues]);

  const previewTitle = useMemo(() => {
    if (!selectedTitleTmplId) return "";
    const all = [...(templates.title || [])];
    const tmpl = all.find((t) => t.id === selectedTitleTmplId);
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
    API.get("/settings").then((r) => { if (r.data.site_name) setSiteName(r.data.site_name); }).catch(() => {});
  }, []);

  useEffect(() => {
    const params = form.property_type ? `?property_type=${form.property_type}` : "";
    API.get(`/description-templates${params}`).then((r) => setTemplates(r.data)).catch(() => {});
  }, [form.property_type]);

  useEffect(() => {
    if (form.property_type) {
      setFieldsLoading(true);
      API.get(`/property-type-fields/${form.property_type}?lang=${lang}`)
        .then((r) => setDynamicFields(r.data))
        .catch(() => setDynamicFields([]))
        .finally(() => setFieldsLoading(false));
    } else {
      setDynamicFields([]);
    }
  }, [form.property_type, lang]);

  useEffect(() => {
    if (form.property_type && dynamicFields.length > 0 && !editPreload) {
      setFieldValue({});
      setSelectedTitleTmplId(null);
      setSelectedOverviewId(null);
      setSelectedClosingId(null);
      setSelectedChips([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.property_type]);

  // Apply edit-mode prefill once dynamic fields + features have loaded
  useEffect(() => {
    if (!editPreload) return;
    if (dynamicFields.length === 0 || presetFeatures.length === 0) return;
    const chips = editPreload.featureIds
      .map((id) => presetFeatures.find((f) => f.id === id)?.label)
      .filter((l): l is string => !!l);
    setFieldValue(editPreload.fieldValues);
    setSelectedChips(chips);
    setSelectedTitleTmplId(editPreload.titleId);
    setSelectedOverviewId(editPreload.overviewId);
    setSelectedClosingId(editPreload.closingId);
    setEditPreload(null);
  }, [editPreload, dynamicFields, presetFeatures]);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await API.get(`/owner/properties/${editId}`);
        const d = res.data;
        setExistingImages((d.images || []).map((img: ExistingImage) => ({ id: img.id, image_url: img.image_url, order: img.order })));
        setForm({
          title: d.title || "",
          description: d.description || "",
          price: d.price != null ? String(d.price) : "",
          price_text: d.price_text || "*",
          location: d.location || "",
          transaction_type: d.transaction_type || "",
          property_type: d.property_type || "",
          name: d.contact?.name || owner?.name || "",
          email: d.contact?.email || owner?.email || "",
          mobile: d.contact?.mobile || owner?.mobile || "",
        });
        setEditPreload({
          fieldValues: Object.fromEntries((d.field_values || []).map((fv: any) => [fv.field_key, fv.field_value])),
          featureIds: d.feature_ids || [],
          titleId: d.title_template_id ?? null,
          overviewId: d.overview_template_id ?? null,
          closingId: d.closing_template_id ?? null,
        });
      } catch (err: any) {
        setDetailError(err?.response?.data?.error || "Could not load property details");
      } finally {
        setDetailLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, editId]);

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

  const handleDeleteExisting = (imageId: number) => {
    setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
    setRemoveImageIds((prev) => [...prev, imageId]);
  };

  const handleClear = () => {
    setForm({});
    setFiles([]);
    setSubmitted(false);
    setResult(null);
    setFieldValue({});
    setDynamicFields([]);
    setSelectedTitleTmplId(null);
    setSelectedOverviewId(null);
    setSelectedClosingId(null);
    setSelectedChips([]);
    setExistingImages([]);
    setRemoveImageIds([]);
  };

  const handleSubmit = async () => {
    if (owner && !owner.is_verified) {
      toast("Please verify your email before posting a property", "warning");
      return;
    }
    if (!form.name?.trim()) { toast("Please enter your name", "warning"); return; }
    if (form.mobile?.trim()) {
      const nums = form.mobile.split(",").map(s => s.trim()).filter(Boolean);
      const invalid = nums.find(n => n.replace(/\D/g, "").length < 10);
      if (invalid) { toast("Each mobile number must have at least 10 digits", "warning"); return; }
    }
    if (form.email?.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { toast("Please enter a valid email address", "warning"); return; }
    }
    if (!form.mobile?.trim() && !form.email?.trim()) { toast("Please provide Mobile or Email", "warning"); return; }
    if (!form.title?.trim()) { toast("Please enter a property title", "warning"); return; }
    const priceRequestOnly = isPriceRequestOnly(form.price_text || "*");
    if (!priceRequestOnly && !form.price?.trim()) { toast("Please enter a price", "warning"); return; }
    if (!priceRequestOnly && form.price?.trim() && isNaN(Number(form.price.replace(/[₹$,\s]/g, "")))) { toast("Please enter a valid price", "warning"); return; }
    if (!form.location?.trim()) { toast("Please enter a location", "warning"); return; }
    if (!form.transaction_type) { toast("Please select Buy or Rent", "warning"); return; }
    if (!form.property_type) { toast("Please select a property type", "warning"); return; }

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

      const fvArray = Object.entries(fieldValues)
        .filter(([_, v]) => v !== "" && v != null)
        .map(([field_key, field_value]) => ({ field_key, field_value }));

      if (!form.description && composedDescription) {
        formData.set("description", composedDescription);
      }

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

      if (isEdit) {
        if (removeImageIds.length > 0) {
          formData.append("remove_image_ids", JSON.stringify(removeImageIds));
        }
        const res = await API.put(`/owner/properties/${editId}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast(res.data.status === "pending" ? "Property updated. It is pending review again." : "Property updated", "success");
        router.push("/my-account");
      } else {
        const res = await API.post("/submit-property", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setResult(res.data);
        setSubmitted(true);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Something went wrong. Please try again.";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-[50vh] text-center py-20 text-gray-400">Loading...</div>;
  }

  if (!owner) {
    return (
      <div className="max-w-md mx-auto min-h-[50vh] flex flex-col items-center justify-center px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-dark)" }}>Post Your Property</h1>
        <p className="text-gray-500 text-sm mb-6">
          {isEdit
            ? "Sign in to edit this property."
            : "You need an owner account to list your property on the site."}
        </p>
        <div className="flex gap-3">
          <Link href={`/login?next=${encodeURIComponent(isEdit ? `/post?edit=${editId}` : "/post")}`} className="btn btn-primary px-8">Sign In</Link>
          <Link href="/register" className="btn btn-ghost px-6">Register</Link>
        </div>
      </div>
    );
  }

  if (detailLoading) {
    return <div className="min-h-[50vh] text-center py-20 text-gray-400">Loading property...</div>;
  }

  if (detailError) {
    return (
      <div className="max-w-md mx-auto min-h-[50vh] flex flex-col items-center justify-center px-4 py-12 text-center">
        <h1 className="text-xl font-bold mb-2 text-red-600">Could not load property</h1>
        <p className="text-gray-500 text-sm mb-6">{detailError}</p>
        <Link href="/my-account" className="btn btn-primary">Back to My Account</Link>
      </div>
    );
  }

  if (submitted && result) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-page)" }}>
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-green-700 mb-2">Property Submitted!</h2>
          <p className="text-gray-600 mb-4">Your property has been submitted successfully and is now pending admin approval. Once approved, it will appear on the property listings.</p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm text-left space-y-1">
            <p><span className="font-medium">Listing ID:</span> {result.listing_id}</p>
            <p><span className="font-medium">Status:</span> <span className="text-yellow-600 font-medium">Pending Approval</span></p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleClear} className="btn btn-primary flex-1">Post Another Property</button>
            <a href="/" className="btn btn-ghost flex-1 text-center">Back to Home</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 md:py-14 px-4 md:px-6 lg:px-10" style={{ backgroundColor: "var(--bg-page)" }}>

      <div className="max-w-6xl mx-auto mb-6 text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-2" style={{ color: "var(--text-dark)" }}>
          {isEdit ? "Edit Property" : "Post Your Property"}
        </h1>
        <p className="text-sm md:text-base" style={{ color: "var(--text-muted)" }}>
          {isEdit
            ? "Update your listing below. Approved properties go back to pending review after an edit."
            : `Fill in the details below to list your property on ${siteName}`}
        </p>
      </div>

      {!owner.is_verified && (
        <div className="max-w-4xl mx-auto mb-5 text-amber-700 text-sm bg-amber-50 border border-amber-200 p-4 rounded-xl">
          Please verify your email address to {isEdit ? "save changes" : "post properties"}.{" "}
          <Link href="/login" className="font-medium underline">Verify from your account</Link>
        </div>
      )}

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
                <select className="form-input" value={form.transaction_type || ""} onChange={(e) => setForm({ ...form, transaction_type: e.target.value })}>
                  <option value="">Select Intent</option>
                  {transactionTypes.map((t) => (<option key={t.value} value={t.value}>{t.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Property Type <span className="text-red-500">*</span></label>
                <select className="form-input" value={form.property_type || ""} onChange={(e) => setForm({ ...form, property_type: e.target.value })}>
                  <option value="">Select Type</option>
                  {propertyTypes.map((t) => (<option key={t.value} value={t.value}>{t.name}</option>))}
                </select>
              </div>
            </div>

            {/* ──── Section 2: Property Details (Dynamic) ──── */}
            {form.property_type && dynamicFields.length > 0 && (
              <>
                <SectionHeader
                  icon={<svg className="w-5 h-5" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                  title="Property Details"
                  right={<div className="flex gap-1">{(["en", "mr", "hi"] as const).map((l) => (<button key={l} type="button" onClick={() => setLang(l)} className={`lang-btn ${lang === l ? "lang-btn-active" : ""}`}>{l === "en" ? "EN" : l === "mr" ? "म" : "हि"}</button>))}</div>}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {dynamicFields.map((field) => (
                    <div key={field.field_key}>
                      <DynamicField field={field} value={fieldValues[field.field_key] || ""} onChange={handleFieldValueChange} />
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

                <div className="mb-5">
                  <label className="block text-sm font-semibold mb-2" style={{ color: "var(--text-dark)" }}>Key Features</label>
                  <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Select features — they will be added as descriptive sentences in your listing.</p>
                  <div className="flex flex-wrap gap-2">
                    {presetFeatures.map((feat) => {
                      const active = selectedChips.includes(feat.label);
                      return (
                        <button
                          key={feat.label}
                          type="button"
                          onClick={() => setSelectedChips((prev) => active ? prev.filter((c) => c !== feat.label) : [...prev, feat.label])}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${active ? "text-white border-transparent" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"}`}
                          style={active ? { backgroundColor: "var(--primary)" } : {}}
                        >
                          {active ? "✓ " : "+ "}{feat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Overview</label>
                    <select className="form-input" value={selectedOverviewId || ""} onChange={(e) => setSelectedOverviewId(Number(e.target.value) || null)}>
                      <option value="">Select overview...</option>
                      {(templates.overview || []).map((t) => (
                        <option key={t.id} value={t.id}>{fillTemplate(t.template_text, templateVars, typeNames, false)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Closing</label>
                    <select className="form-input" value={selectedClosingId || ""} onChange={(e) => setSelectedClosingId(Number(e.target.value) || null)}>
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
                <input className="form-input" placeholder="e.g. Dharampeth, Nagpur" value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Price <span className="text-red-500">*</span></label>
                <PriceInput
                  value={form.price || ""}
                  priceText={form.price_text || "*"}
                  onChange={(val) => setForm({ ...form, price: val })}
                  onPriceTextChange={(text) => setForm({ ...form, price_text: text })}
                />
              </div>
            </div>

            {/* ──── Section 5: Contact Information ──── */}
            <SectionHeader
              icon={<svg className="w-5 h-5" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
              title="Contact Information"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Full Name <span className="text-red-500">*</span></label>
                <input className="form-input" placeholder="Your full name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Mobile Number <span className="text-red-500">*</span></label>
                <input className="form-input" placeholder="10-digit mobile number" value={form.mobile || ""} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>For multiple numbers, separate with comma</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Email Address <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--text-muted)" }}>(optional — notifies you of enquiries)</span></label>
                <input className="form-input" placeholder="you@example.com" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>

            {/* ──── Section 6: Property Title & Description ──── */}
            <SectionHeader
              icon={<svg className="w-5 h-5" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
              title="Property Title & Description"
            />
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Property Title <span className="text-red-500">*</span></label>
                {(templates.title || []).length > 0 && (
                  <select
                    className="form-input mb-2"
                    value={selectedTitleTmplId || ""}
                    onChange={(e) => {
                      const id = Number(e.target.value) || null;
                      setSelectedTitleTmplId(id);
                      if (id) setForm((prev) => ({ ...prev, title: fillTemplate((templates.title || []).find((t) => t.id === id)!.template_text, templateVars, typeNames) }));
                    }}
                  >
                    <option value="">Choose a title template...</option>
                    {(templates.title || []).map((t) => (
                      <option key={t.id} value={t.id}>{fillTemplate(t.template_text, templateVars, typeNames)}</option>
                    ))}
                  </select>
                )}
                {previewTitle && !form.title && (
                  <p className="text-sm mb-2 px-3 py-2 rounded-lg" style={{ color: "var(--text-muted)", backgroundColor: "var(--primary-light)" }}>
                    Preview: {previewTitle}
                  </p>
                )}
                <input
                  className="form-input"
                  placeholder="e.g. 2 BHK Apartment in Sadar"
                  value={form.title || ""}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>Description</label>
                <textarea
                  className="form-input resize-none"
                  placeholder="Property description will appear here based on your selections above..."
                  rows={4}
                  value={form.description || composedDescription}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
                {composedDescription && !form.description && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Auto-generated from your overview, selected features, and closing. Edit the field to customize.
                  </p>
                )}
              </div>
            </div>

            {/* ──── Section 7: Property Images ──── */}
            <SectionHeader
              icon={<svg className="w-5 h-5" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
              title="Property Images"
            />
            <ImageUploader
              files={files}
              onFilesChange={setFiles}
              existingImages={existingImages}
              onDeleteExisting={handleDeleteExisting}
              disabled={false}
            />

          </div>
        </div>

      </div>

      {/* ──── Action Buttons ──── */}
      <div className="max-w-7xl mx-auto mt-6 flex items-center justify-end gap-3 pt-5 border-t border-gray-200">
        {isEdit ? (
          <>
            <Link href="/my-account" className="btn btn-ghost">Cancel</Link>
            <button onClick={handleSubmit} disabled={loading || !owner.is_verified} className="btn btn-primary">
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </>
        ) : (
          <>
            <button onClick={handleClear} className="btn btn-ghost">Clear Form</button>
            <button onClick={handleSubmit} disabled={loading || submitted || !owner.is_verified} className="btn btn-primary">
              {loading ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Submitting...</>
              ) : "Submit Property"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PostProperty() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] text-center py-20 text-gray-400">Loading...</div>}>
      <PostPropertyForm />
    </Suspense>
  );
}