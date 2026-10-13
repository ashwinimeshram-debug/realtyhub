import PropertiesClient from "./PropertiesClient";
import { getProperties, getLocationCounts } from "@/lib/serverData";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const query = new URLSearchParams();
  Object.entries(sp).forEach(([key, value]) => {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value) && value[0] != null) query.set(key, value[0]);
  });
  const queryString = query.toString();

  const [{ items }, allAreas] = await Promise.all([
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
    />
  );
}
