import ContactClient from "./ContactClient";
import { fetchJson } from "@/lib/serverData";

export default async function ContactPage() {
  const sections = await fetchJson("/pages/contact/sections");

  return <ContactClient sections={Array.isArray(sections) ? sections : []} />;
}
