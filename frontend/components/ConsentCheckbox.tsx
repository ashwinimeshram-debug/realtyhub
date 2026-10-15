"use client";

import Link from "next/link";

export default function ConsentCheckbox({
  checked,
  onChange,
  disabled,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={`flex items-start gap-2 text-xs text-gray-500 ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
      />
      <span>
        I agree to the collection and use of my personal data as described in the{" "}
        <Link href="/privacy-policy" target="_blank" className="text-[var(--primary)] hover:underline">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link href="/terms" target="_blank" className="text-[var(--primary)] hover:underline">
          Terms
        </Link>
        .
      </span>
    </label>
  );
}
