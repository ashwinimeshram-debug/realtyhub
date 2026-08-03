"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import API from "@/lib/api";

function ScrollToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 300);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 pb-[env(safe-area-inset-bottom)] z-[60] w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white transition hover:scale-110"
      style={{ backgroundColor: "var(--primary)" }}
      aria-label="Scroll to top"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isAdminRoute = pathname.startsWith("/admin");

  // Track public page visits with traffic source
  useEffect(() => {
    if (isAdminRoute) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      API.post("/analytics/visit", {
        page_url: pathname,
        referrer: document.referrer || null,
        utm_source: params.get("utm_source") || null,
        utm_medium: params.get("utm_medium") || null,
        utm_campaign: params.get("utm_campaign") || null,
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [pathname, isAdminRoute]);

  return (
    <>
      {!isAdminRoute && (
        <div className="sticky top-0 z-50">
          <Navbar />
        </div>
      )}

      {children}

      {!isAdminRoute && <ScrollToTop />}
    </>
  );
}
