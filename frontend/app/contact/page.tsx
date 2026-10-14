import type { Metadata } from "next";
import ContactClient from "./ContactClient";
import { fetchJson } from "@/lib/serverData";
import { SITE_URL } from "@/lib/assets";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact our Nagpur real estate team for buying, renting or listing a property. Get phone, email and office address details.",
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: { title: "Contact Us", url: `${SITE_URL}/contact`, type: "website" },
};

export default async function ContactPage() {
  const sections = await fetchJson("/pages/contact/sections");

  return <ContactClient sections={Array.isArray(sections) ? sections : []} />;
}
