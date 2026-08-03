"use client";

import React from "react";
import { formatIndianPrice, parseNumericPrice, priceInWords, PRICE_TEXT_OPTIONS, isPriceRequestOnly } from "@/lib/priceFormat";

interface PriceInputProps {
  value: string;
  priceText: string;
  onChange: (val: string) => void;
  onPriceTextChange: (text: string) => void;
  inputClass?: string;
  disabled?: boolean;
}

export default function PriceInput({
  value,
  priceText,
  onChange,
  onPriceTextChange,
  inputClass = "form-input",
  disabled,
}: PriceInputProps) {
  const requestOnly = isPriceRequestOnly(priceText);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          className={`${inputClass} flex-1 ${requestOnly ? "bg-gray-100 text-gray-400" : ""}`}
          disabled={disabled || requestOnly}
          placeholder={requestOnly ? priceText : "e.g. 500000"}
          value={requestOnly ? priceText : formatIndianPrice(value || "")}
          onChange={(e) => onChange(parseNumericPrice(e.target.value))}
          inputMode="numeric"
        />
        <select
          className={inputClass}
          value={priceText || "*"}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value;
            if (isPriceRequestOnly(next)) onChange("");
            onPriceTextChange(next);
          }}
        >
          {PRICE_TEXT_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
      {value && !requestOnly && (
        <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {priceInWords(value)}
        </p>
      )}
    </div>
  );
}
