import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PropertiesClient from "../PropertiesClient";
import JsonLd from "@/components/seo/JsonLd";
import DirectAnswer from "@/components/seo/DirectAnswer";
import LocalityFacts from "@/components/seo/LocalityFacts";
import { getProperties, getLocationCounts, getSettings } from "@/lib/serverData";
import { SITE_URL } from "@/lib/assets";
import {
  slugifyLocality,
  getLocalityBySlug,
  type LocalityInfo,
} from "@/lib/seo/nagpur-geo";
import { buildSiteInfo, buildLocationHubGraph } from "@/lib/seo/schema";
import { BUYER_FAQ } from "@/lib/seo/answers";

interface LocationParams {
  params: Promise<{ location: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function resolveLocation(slug: string): Promise<{ name: string; locality?: LocalityInfo } | null> {
  const counts = await getLocationCounts();
  const match = counts.find((l) => slugifyLocality(l.name) === slug);
  if (match) {
    return { name: match.name, locality: getLocalityBySlug(slug) };
  }
  const locality = getLocalityBySlug(slug);
  if (locality) return { name: locality.name, locality };
  return null;
}

export async function generateMetadata({ params }: LocationParams): Promise<Metadata> {
  const { location } = await params;
  const resolved = await resolveLocation(location);
  if (!resolved) {
    return { title: "Location not found", robots: { index: false, follow: false } };
  }

  const { name, locality } = resolved;
  const description =
    locality?.description ||
    `Explore verified properties for sale and rent in ${name}, Nagpur with prices, photos and direct owner contact.`;
  const canonical = `${SITE_URL}/properties/${location}`;

  return {
    title: `Properties in ${name}, Nagpur`,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: `Properties in ${name}, Nagpur`,
      description,
      url: canonical,
      type: "website",
    },
    twitter: { card: "summary_large_image", title: `Properties in ${name}, Nagpur`, description },
  };
}

export default async function LocationHubPage({ params, searchParams }: LocationParams) {
  const { location } = await params;
  const sp = await searchParams;
  const page = typeof sp.page === "string" ? Math.max(1, parseInt(sp.page, 10) || 1) : 1;

  const resolved = await resolveLocation(location);
  if (!resolved) notFound();

  const { name, locality } = resolved;

  const query = new URLSearchParams();
  query.set("location", name);
  if (page > 1) query.set("page", String(page));

  const [{ items, total, page: currentPage, perPage }, allAreas, settings] = await Promise.all([
    getProperties(query.toString()),
    getLocationCounts(),
    getSettings(),
  ]);

  const site = buildSiteInfo(settings, SITE_URL);
  const url = `${SITE_URL}/properties/${location}`;
  const graph = buildLocationHubGraph(name, site, {
    url,
    listings: items,
    faqs: BUYER_FAQ,
    locality,
  });

  return (
    <>
      <JsonLd data={graph} />
      <PropertiesClient
        properties={items}
        areas={allAreas.slice(0, 14)}
        activeLocation={name}
        listQuery={`location=${encodeURIComponent(name)}`}
        total={total}
        page={currentPage}
        perPage={perPage}
        basePath={`/properties/${location}`}
      />
      <LocalityFacts locationName={name} locality={locality} />
      <DirectAnswer
        items={BUYER_FAQ}
        title={`Buying a Property in ${name} — FAQs`}
        subtitle={`Quick answers for buyers and tenants in ${name}, Nagpur`}
      />
    </>
  );
}
