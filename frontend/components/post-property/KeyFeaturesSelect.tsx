"use client";

import { useState } from "react";
import API from "@/lib/api";
import { useToast } from "@/components/Toast";

export interface PresetFeatureLite {
  id: number;
  label: string;
  sentence: string;
}

export default function KeyFeaturesSelect({
  features,
  selected,
  onToggle,
  onFeatureAdded,
  createEndpoint,
  disabled = false,
}: {
  features: PresetFeatureLite[];
  selected: string[];
  onToggle: (label: string) => void;
  onFeatureAdded: (feature: PresetFeatureLite) => void;
  createEndpoint: "owner" | "admin";
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const value = label.trim();
    if (!value) return;
    setSaving(true);
    try {
      const url = createEndpoint === "admin" ? "/admin/preset-features" : "/owner/preset-features";
      const res = await API.post(url, { label: value });
      const feat: PresetFeatureLite = {
        id: res.data.id,
        label: res.data.label,
        sentence: res.data.sentence,
      };
      if (!features.some((f) => f.label === feat.label)) {
        onFeatureAdded(feat);
      }
      if (!selected.includes(feat.label)) {
        onToggle(feat.label);
      }
      toast(res.data.existing ? "Feature already exists — added to this listing" : "Feature added", "success");
      setLabel("");
      setAdding(false);
    } catch (err: any) {
      toast(err?.response?.data?.error || "Could not add feature", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <label className="block text-sm font-semibold" style={{ color: "var(--text-dark)" }}>Key Features</label>
        {!disabled && (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="text-xs font-semibold inline-flex items-center gap-1 text-[var(--primary)] hover:underline"
          >
            <span className="text-base leading-none">+</span> Add new feature
          </button>
        )}
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Select features — they will be added as descriptive sentences in your listing.</p>

      {adding && !disabled && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input
            autoFocus
            className="form-input flex-1 min-w-[180px]"
            placeholder="e.g. Terrace Garden"
            value={label}
            maxLength={100}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); submit(); }
              if (e.key === "Escape") { setAdding(false); setLabel(""); }
            }}
          />
          <button type="button" onClick={submit} disabled={saving || !label.trim()} className="btn btn-primary btn-sm">
            {saving ? "Adding..." : "Add"}
          </button>
          <button type="button" onClick={() => { setAdding(false); setLabel(""); }} className="btn btn-ghost btn-sm">
            Cancel
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {features.map((feat) => {
          const active = selected.includes(feat.label);
          return (
            <button
              key={feat.label}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(feat.label)}
              className={`w-full px-3 py-1.5 rounded-full text-sm font-medium border transition truncate ${active ? "text-white border-transparent" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
              style={active ? { backgroundColor: "var(--primary)" } : {}}
              title={feat.label}
            >
              {active ? "✓ " : "+ "}{feat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
