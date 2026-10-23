import type { Metadata } from "next";
import ContactClient from "./ContactClient";
import { SITE_URL } from "@/lib/assets";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact Plot and Roof for buying, renting or listing a property. Get phone, email and office address details.",
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: { title: "Contact Us", url: `${SITE_URL}/contact`, type: "website" },
};

const contactSections: Array<{
  id: string;
  label: string;
  content: string;
  type?: "section" | "description";
}> = [
  { id: "c1", label: "Hero Title", content: "Get In Touch" },
  {
    id: "c2",
    label: "Hero Subtitle",
    content: "Reach out to us — our dedicated real estate team is here to guide you every step of the way.",
  },
  { id: "c3", label: "Hero Card Title", content: "We'd Love to Hear From You" },
  { id: "c4", label: "Hero Card Subtitle", content: "Typically responds within 24 hours" },
  { id: "c5", label: "Hero Tags", content: "Mon - Sat\n10 AM- 7 PM" },
  { id: "c6", label: "Details Title", content: "Our Contact Details" },
  { id: "c7", label: "Address", type: "section", content: "New Narsala\nNagpur – 440034" },
  { id: "c8", label: "Phone", type: "section", content: "+91 9284799079" },
  { id: "c9", label: "Email", type: "section", content: "info@plotandroof.com" },
  { id: "c10", label: "Website", type: "section", content: "www.plotandroof.com" },
  { id: "c11", label: "Hours Title", content: "Business Hours" },
  { id: "c12", label: "Hours Weekday", content: "Monday - Saturday|10:00 AM - 7:00 PM" },
  { id: "c13", label: "Hours Sunday", content: "Sunday|Closed" },
  { id: "c14", label: "Form Title", content: "Send a Message" },
  { id: "c15", label: "Form Subtitle", content: "Fill out the form below and we'll get back to you shortly." },
  { id: "c16", label: "Form Button", content: "Send Message" },
  { id: "c17", label: "Form Terms", content: "By submitting, you agree to our Terms &amp; Privacy Policy." },
  { id: "c18", label: "Success Title", content: "Message Sent!" },
  { id: "c19", label: "Success Text", content: "Thank you for reaching out. We'll reply soon." },
];

export default function ContactPage() {
  return <ContactClient sections={contactSections} />;
}
