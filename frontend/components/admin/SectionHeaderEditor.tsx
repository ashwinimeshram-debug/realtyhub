"use client";

import { useRef } from "react";
import API from "@/lib/api";

const HEADER_DEFAULTS: Record<string, string> = {
  hero: "",
  services: "Our Comprehensive Services",
  advantages: "Key Advantages",
  testimonials: "What Our Customers Say",
  featured: "Featured Properties",
  new: "New Properties",
  faq: "Frequently Asked Questions",
};

const SUBTITLE_DEFAULTS: Record<string, string> = {
  services: "End-to-end real estate solutions tailored to your needs",
  advantages: "Why homebuyers and investors trust us with their most important decisions",
  testimonials: "Real experiences from clients who found their dream homes with us",
  featured: "Handpicked premium properties in prime locations across Nagpur",
  new: "Freshly listed properties across Nagpur",
  faq: "Find answers to common questions about our services and processes",
};

export default function SectionHeaderEditor({
  sectionKey,
  sectionName,
  settings,
  onUpdate,
}: {
  sectionKey: string;
  sectionName: string;
  settings: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const titleKey = `section_${sectionKey}_title`;
  const subtitleKey = `section_${sectionKey}_subtitle`;
  const alignKey = `section_${sectionKey}_align`;

  const currentTitle = settings[titleKey] || "";
  const currentSubtitle = settings[subtitleKey] || "";
  const currentAlign = settings[alignKey] || (sectionKey === "testimonials" || sectionKey === "faq" ? "center" : "left");

  const handleFormat = (tag: "b" | "i") => {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const selected = currentTitle.substring(start, end);

    let newTitle: string;
    if (selected) {
      const before = currentTitle.substring(0, start);
      const after = currentTitle.substring(end);
      newTitle = `${before}<${tag}>${selected}</${tag}>${after}`;
    } else {
      const before = currentTitle.substring(0, start);
      const after = currentTitle.substring(end);
      newTitle = `${before}<${tag}></${tag}>${after}`;
    }
    onUpdate(titleKey, newTitle);
    requestAnimationFrame(() => {
      input.focus();
      const pos = selected
        ? start + `<${tag}>`.length + selected.length + `</${tag}>`.length
        : start + `<${tag}>`.length;
      input.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 mb-4 md:mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Section Header</h3>

      {/* Title */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-gray-600">Title</label>
          <div className="flex items-center gap-1">
            <button onClick={() => handleFormat("b")} className="px-1.5 py-0.5 text-xs font-bold border border-gray-200 rounded hover:bg-gray-100 text-gray-600" title="Bold">B</button>
            <button onClick={() => handleFormat("i")} className="px-1.5 py-0.5 text-xs font-bold border border-gray-200 rounded hover:bg-gray-100 text-gray-600 italic" title="Italic">I</button>
            <span className="mx-1 text-gray-300">|</span>
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                onClick={() => onUpdate(alignKey, a)}
                className={`px-2 py-1 text-xs rounded border transition ${
                  currentAlign === a
                    ? "bg-blue-100 border-blue-300 text-blue-700"
                    : "border-gray-200 text-gray-500 hover:bg-gray-100"
                }`}
              >
                {a.charAt(0).toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={currentTitle}
          onChange={(e) => onUpdate(titleKey, e.target.value)}
          placeholder={HEADER_DEFAULTS[sectionKey] || "Section title"}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] outline-none transition"
        />
        {!currentTitle && HEADER_DEFAULTS[sectionKey] && (
          <p className="text-[10px] text-gray-400 mt-1">Default: {HEADER_DEFAULTS[sectionKey]}</p>
        )}
      </div>

      {/* Subtitle */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1.5">Subtitle</label>
        <input
          type="text"
          value={currentSubtitle}
          onChange={(e) => onUpdate(subtitleKey, e.target.value)}
          placeholder={SUBTITLE_DEFAULTS[sectionKey] || "Short description for this section"}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] outline-none transition"
        />
        {!currentSubtitle && SUBTITLE_DEFAULTS[sectionKey] && (
          <p className="text-[10px] text-gray-400 mt-1">Default: {SUBTITLE_DEFAULTS[sectionKey]}</p>
        )}
      </div>
    </div>
  );
}
