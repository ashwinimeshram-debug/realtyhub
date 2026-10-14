import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/assets";
import { getSettings } from "@/lib/serverData";
import { buildSiteInfo } from "@/lib/seo/schema";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSettings();
  const site = buildSiteInfo(settings, SITE_URL);

  return {
    name: site.siteName,
    short_name: site.siteName.split(" ")[0] || site.siteName,
    description:
      site.description ||
      `Verified properties for sale and rent in Nagpur with direct owner contact.`,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: settings.primary_color || "#1f6f5c",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
