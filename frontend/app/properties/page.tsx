import type { Metadata } from "next";
import PropertiesClient from "./PropertiesClient";
import { getProperties, getLocationCounts } from "@/lib/serverData";
import { SITE_URL } from "@/lib/assets";

export const metadata: Metadata = {
  title: "Properties for Sale, Resale and Rent in Nagpur",
  description:
    "Browse verified properties for sale, resale and rent in Nagpur. Filter by locality, type and budget and connect directly with owners.",
  alternates: { canonical: `${SITE_URL}/properties` },
};

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const query = new URLSearchParams();
  Object.entries(sp).forEach(([key, value]) => {
    if (key === "page") return;
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value) && value[0] != null) query.set(key, value[0]);
  });

  if (typeof sp.page === "string") query.set("page", sp.page);
  else if (Array.isArray(sp.page) && sp.page[0] != null) query.set("page", sp.page[0]);

  const queryString = query.toString();

  const [{ items, total, page, perPage }, allAreas] = await Promise.all([
    getProperties(queryString),
    getLocationCounts(),
  ]);

  const areas = allAreas.slice(0, 14);
  const activeLocation = typeof sp.location === "string" ? sp.location : "";

  return (
    <PropertiesClient
      properties={items}
      areas={areas}
      activeLocation={activeLocation}
      listQuery={queryString}
      total={total}
      page={page}
      perPage={perPage}
    />
  );
}
