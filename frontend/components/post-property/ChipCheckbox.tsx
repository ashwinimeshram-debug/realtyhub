"use client";

import React, { useMemo } from "react";

interface ChipCheckboxProps {
  options: string[];
  value: string | null;
  onChange: (val: string | null) => void;
  multi?: boolean;
  disabled?: boolean;
}

export default function ChipCheckbox({ options, value, onChange, multi = false, disabled }: ChipCheckboxProps) {
  const selectedSet = useMemo(
    () => new Set(value ? value.split(",").map((v) => v.trim()).filter(Boolean) : []),
    [value]
  );

  const handleClick = (opt: string) => {
    if (multi) {
      if (selectedSet.has(opt)) {
        selectedSet.delete(opt);
      } else {
        selectedSet.add(opt);
      }
      const result = Array.from(selectedSet).join(",");
      onChange(result || null);
    } else {
      if (selectedSet.has(opt)) {
        onChange(null);
      } else {
        onChange(opt);
      }
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => handleClick(opt)}
          disabled={disabled}
          className={`chip ${selectedSet.has(opt) ? "chip-selected" : ""} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
