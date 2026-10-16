import type { Metadata } from "next";
import AboutClient from "./AboutClient";
import { fetchJson, getSettings } from "@/lib/serverData";
import { SITE_URL } from "@/lib/assets";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about our Nagpur real estate team — how we verify listings, help owners post properties and connect buyers and tenants directly.",
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: { title: "About Us", url: `${SITE_URL}/about`, type: "website" },
};

export default async function AboutPage() {
  const [settings, sectionsRes, teamRes, layoutRes, galleryRes] = await Promise.all([
    getSettings(),
    fetchJson("/pages/about/sections"),
    fetchJson("/team"),
    fetchJson("/pages/about/team-layout"),
    fetchJson("/about-gallery"),
  ]);

  return (
    <AboutClient
      rawSections={Array.isArray(sectionsRes) ? sectionsRes : []}
      members={Array.isArray(teamRes) ? teamRes : []}
      layout={
        layoutRes && typeof layoutRes === "object" && layoutRes.layout
          ? String(layoutRes.layout)
          : "carousel"
      }
      galleryImages={Array.isArray(galleryRes) ? galleryRes : []}
      siteName={settings.site_name || "Realty Hub"}
      galleryTransition={settings.about_gallery_transition || "fade"}
    />
  );
}
