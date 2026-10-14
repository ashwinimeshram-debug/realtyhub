import type { Metadata } from "next";
import LegalSections from "@/components/legal/LegalSections";
import { getPageSections, getSettings } from "@/lib/serverData";
import { SITE_URL } from "@/lib/assets";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of service for using our Nagpur real estate portal, including listing rules, user responsibilities and RERA disclaimer.",
  alternates: { canonical: `${SITE_URL}/terms` },
};

export default async function TermsPage() {
  const [sections, settings] = await Promise.all([
    getPageSections("terms"),
    getSettings(),
  ]);
  const siteName = (settings.site_name || "").trim() || "Nagpur Realty Hub";
  const replaced = sections.map((s) => ({
    ...s,
    content: s.content.replace(/__SITE_NAME__/g, siteName),
  }));

  return <LegalSections title="Terms of Service" sections={replaced} />;
}
