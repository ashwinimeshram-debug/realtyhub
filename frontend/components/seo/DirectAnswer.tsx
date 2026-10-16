"use client";

import { useState } from "react";
import SectionContent from "@/components/SectionContent";
import type { FaqItem } from "@/lib/seo/types";

export default function DirectAnswer({
  items,
  title,
  subtitle,
}: {
  items: FaqItem[];
  title?: string;
  subtitle?: string;
}) {
  const [openId, setOpenId] = useState<number | string | null>(null);
  const faqs = items.filter((f) => f.question && f.answer);
  if (faqs.length === 0) return null;

  return (
    <section className="py-8 px-4 md:px-10" aria-labelledby="direct-answers-heading">
      <div className="max-w-3xl mx-auto">
        <h2
          id="direct-answers-heading"
          className="text-2xl md:text-3xl font-bold text-center mb-2"
          style={{ color: "var(--primary)" }}
        >
          {title || "Frequently Asked Questions"}
        </h2>
        <p className="text-center text-sm text-gray-500 mb-6">
          {subtitle || "Quick answers to common buyer questions"}
        </p>
        <div className="space-y-3">
          {faqs.map((item, index) => {
            const key = item.id ?? `${item.question}-${index}`;
            const isOpen = openId === key;
            return (
              <div
                key={key}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenId(isOpen ? null : key)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-gray-50 transition-colors duration-200"
                >
                  <h3 className="font-semibold text-gray-800 text-sm md:text-base">{item.question}</h3>
                  <svg
                    className={`w-5 h-5 shrink-0 text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div
                  className="overflow-hidden transition-all duration-300"
                  style={{ maxHeight: isOpen ? "500px" : "0px", opacity: isOpen ? 1 : 0 }}
                >
                  <div className="px-5 pb-5 text-sm text-gray-600 border-t border-gray-100 pt-3">
                    <SectionContent content={item.answer} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
