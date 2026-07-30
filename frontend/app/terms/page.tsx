"use client";

import { useEffect, useMemo, useState } from "react";
import API from "@/lib/api";
import SectionContent from "@/components/SectionContent";

interface Section {
  id: string;
  label: string;
  content: string;
  type?: "section" | "description";
}

export default function TermsPage() {
  const [rawSections, setRawSections] = useState<Section[]>([]);
  const [siteName, setSiteName] = useState("Nagpur Realty Hub");
  const [activeId, setActiveId] = useState<string>("");

  const replaceName = (secs: Section[]) =>
    secs.map((s) => ({ ...s, content: s.content.replace(/__SITE_NAME__/g, siteName) }));

  const sections = useMemo(() => replaceName(rawSections), [rawSections, siteName]);

  useEffect(() => {
    API.get("/settings")
      .then((r) => { if (r.data.site_name) setSiteName(r.data.site_name); })
      .catch(() => {});

    API.get("/pages/terms/sections")
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) setRawSections(res.data);
      })
      .catch(() => {});
  }, []);

  const introSection = sections.find((s) => s.type === "description");
  const effectiveDate = sections.find((s) => s.label.toLowerCase() === "effective date")?.content || "July 20, 2026";
  const numberedSections = sections.filter((s) => s.type !== "description" && s.label.toLowerCase() !== "effective date");

  const scrollTo = (id: string) => {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* Hero */}
      <div className="page-header">
        <div className="max-w-6xl mx-auto px-6">
          <h1>Terms of Service</h1>
          <p>Effective Date: {effectiveDate}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 flex gap-8 items-start">
        {/* Sidebar */}
        <aside className="hidden md:block w-64 shrink-0 sticky top-24">
          <nav className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
              Contents
            </p>
            <ul className="space-y-1">
              {numberedSections.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => scrollTo(s.id)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                      activeId === s.id
                        ? "font-semibold"
                        : "hover:bg-gray-50"
                    }`}
                    style={{
                      color: activeId === s.id ? "var(--primary)" : "var(--text-body)",
                      backgroundColor: activeId === s.id ? "var(--primary-light)" : undefined,
                    }}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-10">
            {introSection && (
              <div className="mb-8 pb-6 border-b border-gray-100">
                <SectionContent content={introSection.content} className="text-gray-600 text-base leading-relaxed" />
              </div>
            )}

            <div className="space-y-8">
              {numberedSections.map((section) => (
                <section key={section.id} id={section.id}>
                  <h2 className="text-lg font-bold mb-3" style={{ color: "var(--text-dark)" }}>
                    {section.label}
                  </h2>
                  <SectionContent content={section.content} className="text-gray-600 text-sm leading-relaxed" />
                </section>
              ))}
            </div>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="btn btn-ghost btn-sm"
            >
              Back to Top
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
