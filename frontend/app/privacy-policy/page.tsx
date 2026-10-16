import type { Metadata } from "next";
import LegalSections from "@/components/legal/LegalSections";
import { getPageSections, getSettings } from "@/lib/serverData";
import { SITE_URL } from "@/lib/assets";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy policy covering how we collect, use and protect personal and property information submitted on our Nagpur real estate portal.",
  alternates: { canonical: `${SITE_URL}/privacy-policy` },
};

export default async function PrivacyPolicyPage() {
  const [sections, settings] = await Promise.all([
    getPageSections("privacy"),
    getSettings(),
  ]);
  const siteName = (settings.site_name || "").trim() || "Realty Hub";
  const replaced = sections.map((s) => ({
    ...s,
    content: s.content.replace(/__SITE_NAME__/g, siteName),
  }));

  return <LegalSections title="Privacy Policy" sections={replaced} />;
}
