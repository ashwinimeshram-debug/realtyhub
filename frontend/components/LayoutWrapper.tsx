"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import API from "@/lib/api";
import { useSettings } from "@/hooks/useSettings";

function hexToHSL(hex: string): string {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function darkenHex(hex: string, amount: number = 0.15): string {
  hex = hex.replace("#", "");
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  r = Math.max(0, Math.round(r * (1 - amount)));
  g = Math.max(0, Math.round(g * (1 - amount)));
  b = Math.max(0, Math.round(b * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function isValidHex(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

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
  const { settings } = useSettings();

  // Apply brand colors from settings
  useEffect(() => {
    if (isAdminRoute) return;

    const primary = settings.primary_color;
    const secondary = settings.secondary_color;
    const root = document.documentElement;
    if (primary && isValidHex(primary)) {
      root.style.setProperty("--primary", primary);
      root.style.setProperty("--primary-hover", darkenHex(primary));
      root.style.setProperty("--primary-light", `color-mix(in srgb, ${primary} 10%, transparent)`);
      root.style.setProperty("--primary-ring", `color-mix(in srgb, ${primary} 12%, transparent)`);
    }
    if (secondary && isValidHex(secondary)) {
      root.style.setProperty("--secondary", secondary);
      root.style.setProperty("--secondary-hover", darkenHex(secondary));
    }
  }, [isAdminRoute, settings]);

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
