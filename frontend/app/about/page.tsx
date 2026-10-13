import AboutClient from "./AboutClient";
import { fetchJson, getSettings } from "@/lib/serverData";

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
      siteName={settings.site_name || "Nagpur Realty Hub"}
      galleryTransition={settings.about_gallery_transition || "fade"}
    />
  );
}
