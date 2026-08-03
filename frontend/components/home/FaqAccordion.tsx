"use client";

import { useState } from "react";
import SectionContent from "@/components/SectionContent";
import SectionHeader from "./SectionHeader";

export default function FaqAccordion({
  faqs,
  title,
  subtitle,
  align,
}: {
  faqs: any[];
  title?: string;
  subtitle?: string;
  align?: string;
}) {
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <section className="py-10 md:py-14 px-4 md:px-10">
      <SectionHeader
        title={title || "Frequently Asked Questions"}
        subtitle={subtitle || "Find answers to common questions about our services and processes"}
        align={align}
      />
      {faqs.length > 0 ? (
        <div className="space-y-3 max-w-3xl mx-auto">
          {faqs.map((f: any) => (
            <div key={f.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setOpenId(openId === f.id ? null : f.id)}
                className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-gray-50 transition-colors duration-200"
              >
                <span className="font-semibold text-gray-800 text-sm md:text-base">{f.question}</span>
                <svg
                  className={`w-5 h-5 shrink-0 text-gray-400 transition-transform duration-300 ${openId === f.id ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div
                className="overflow-hidden transition-all duration-300"
                style={{ maxHeight: openId === f.id ? "500px" : "0px", opacity: openId === f.id ? 1 : 0 }}
              >
                <div className="px-5 pb-5 text-sm text-gray-600 border-t border-gray-100 pt-3" style={{ lineHeight: "1.6" }}>
                  <SectionContent content={f.answer} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-center">No FAQs yet</p>
      )}
    </section>
  );
}
