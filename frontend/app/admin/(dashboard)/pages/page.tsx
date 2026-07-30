"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import API from "@/lib/api";

interface PageInfo {
  slug: string;
  title: string;
}

const PAGE_ICONS: Record<string, string> = {
  home: "🏠",
  about: "ℹ️",
  privacy: "🔒",
  terms: "📋",
  contact: "✉️",
};

export default function AdminPagesPage() {
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get("/admin/pages")
      .then((res) => setPages(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-gray-400 text-sm">Loading pages...</div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-800">Pages</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Edit the content of your public-facing pages. Changes are saved instantly.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/cms"
          className="flex items-center gap-4 p-5 bg-white border rounded-xl hover:shadow-md transition group"
        >
          <span className="text-3xl">🏠</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-800 group-hover:text-[var(--primary)] transition">
              Home page
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Hero, Services, Advantages, Testimonials, Featured, FAQ
            </p>
          </div>
          <svg
            className="w-5 h-5 text-gray-300 group-hover:text-[var(--primary)] transition shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
        {pages.map((page) => (
          <Link
            key={page.slug}
            href={`/admin/pages/${page.slug}`}
            className="flex items-center gap-4 p-5 bg-white border rounded-xl hover:shadow-md transition group"
          >
            <span className="text-3xl">{PAGE_ICONS[page.slug] || "📄"}</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-800 group-hover:text-[var(--primary)] transition">
                {page.title}
              </h3>
              <p className="text-xs text-gray-400 mt-1 capitalize">
                /{page.slug}
              </p>
            </div>
            <svg
              className="w-5 h-5 text-gray-300 group-hover:text-[var(--primary)] transition shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
