"use client";

import React from "react";
import ChipCheckbox from "./ChipCheckbox";
import InlineUnitInput from "./InlineUnitInput";

export interface FieldDef {
  field_key: string;
  field_label: string;
  field_type: "chip" | "select" | "unit_input" | "text";
  options?: string[] | null;
  unit_options?: string[] | null;
  placeholder?: string;
  is_required: boolean;
}

interface DynamicFieldProps {
  field: FieldDef;
  value: string;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}

export default function DynamicField({ field, value, onChange, disabled }: DynamicFieldProps) {
  const inputClass = `form-input${disabled ? " bg-gray-50 text-gray-500 opacity-70 cursor-not-allowed" : ""}`;

  if (field.field_type === "chip") {
    return (
      <div>
        <label className="block text-sm font-semibold mb-2" style={{ color: "var(--text-dark)" }}>
          {field.field_label} {field.is_required && <span className="text-red-500">*</span>}
        </label>
        <ChipCheckbox
          options={field.options || []}
          value={value || null}
          onChange={(v) => onChange(field.field_key, v || "")}
          disabled={disabled}
        />
      </div>
    );
  }

  if (field.field_type === "text") {
    return (
      <div>
        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>
          {field.field_label} {field.is_required && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          className={inputClass}
          value={value || ""}
          onChange={(e) => onChange(field.field_key, e.target.value)}
          placeholder={field.placeholder || `Enter ${field.field_label}`}
          disabled={disabled}
        />
      </div>
    );
  }

  if (field.field_type === "select") {
    return (
      <div>
        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>
          {field.field_label} {field.is_required && <span className="text-red-500">*</span>}
        </label>
        <select
          className={inputClass}
          value={value || ""}
          onChange={(e) => onChange(field.field_key, e.target.value)}
          disabled={disabled}
        >
          <option value="">Select {field.field_label}</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.field_type === "unit_input") {
    const units = field.unit_options || [];
    const parts = value ? value.split(",") : [""];
    const numValue = parts[0] || "";
    const unitValue = parts[1] || units[0] || "";

    return (
      <div>
        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-dark)" }}>
          {field.field_label} {field.is_required && <span className="text-red-500">*</span>}
        </label>
        <InlineUnitInput
          value={numValue}
          unit={unitValue}
          units={units}
          onChange={(v) => onChange(field.field_key, v ? `${v},${unitValue}` : "")}
          onUnitChange={(u) => onChange(field.field_key, numValue ? `${numValue},${u}` : "")}
          placeholder={field.placeholder}
          disabled={disabled}
        />
      </div>
    );
  }

  return null;
}
