"use client";

import React from "react";

interface InlineUnitInputProps {
  value: string;
  unit: string;
  units: string[];
  onChange: (val: string) => void;
  onUnitChange: (unit: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function InlineUnitInput({
  value,
  unit,
  units,
  onChange,
  onUnitChange,
  placeholder,
  disabled,
}: InlineUnitInputProps) {
  return (
    <div className="inline-unit-group">
      <input
        type="number"
        min="0"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Enter value"}
        disabled={disabled}
        className={disabled ? "bg-gray-50 text-gray-500 opacity-70 cursor-not-allowed" : ""}
      />
      {units.length === 0 ? null : units.length === 1 ? (
        <span className="flex items-center px-3 text-sm text-[var(--text-body)] bg-[var(--bg-page)]">
          {units[0]}
        </span>
      ) : (
        <select value={unit} onChange={(e) => onUnitChange(e.target.value)} disabled={disabled}>
          {units.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      )}
    </div>
  );
}
