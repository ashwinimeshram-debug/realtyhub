import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import PropertyDetailClient from "./PropertyDetailClient";
import JsonLd from "@/components/seo/JsonLd";
import DirectAnswer from "@/components/seo/DirectAnswer";
import LocalityFacts from "@/components/seo/LocalityFacts";
import { getProperty, getSettings } from "@/lib/serverData";
import { buildPropertySlug, parsePropertySlug } from "@/lib/propertySlug";
import { SITE_URL } from "@/lib/assets";
import { formatPriceDisplay } from "@/lib/priceFormat";
import { buildSiteInfo, buildListingGraph, propertyUrl } from "@/lib/seo/schema";
import { buildListingAnswers } from "@/lib/seo/answers";
import { getLocality } from "@/lib/seo/nagpur-geo";

interface PropertyParams {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PropertyParams): Promise<Metadata> {
  const { id } = await params;
  const numericId = parsePropertySlug(id);
  if (!numericId) {
    return { title: "Property not found", robots: { index: false, follow: false } };
  }

  const property = await getProperty(numericId);
  if (!property) {
    return { title: "Property not found", robots: { index: false, follow: false } };
  }

  const site = buildSiteInfo(await getSettings(), SITE_URL);
  const priceText = formatPriceDisplay(property.price, property.price_text);
  const description = [
    priceText,
    property.location,
    property.property_type,
    property.transaction_type === "rent" ? "for rent" : "for sale",
  ]
    .filter(Boolean)
    .join(" · ");
  const canonical = propertyUrl(property, site);

  return {
    title: property.title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: property.title,
      description,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: property.title,
      description,
    },
  };
}

export default async function PropertyPage({ params }: PropertyParams) {
  const { id } = await params;
  const numericId = parsePropertySlug(id);
  if (!numericId) notFound();

  const property = await getProperty(numericId);
  if (!property) notFound();

  const canonicalSlug = buildPropertySlug(property.id, property.title);
  if (id !== canonicalSlug) {
    permanentRedirect(`/property/${canonicalSlug}`);
  }

  const site = buildSiteInfo(await getSettings(), SITE_URL);
  const answers = buildListingAnswers(property, site);
  const graph = buildListingGraph(property, site, { faqs: answers });

  return (
    <>
      <JsonLd data={graph} />
      <PropertyDetailClient initialProperty={property} />
      <DirectAnswer
        items={answers}
        title={`Questions about this ${property.property_type || "property"}`}
        subtitle={`Prices, location and contact details for ${property.location}`}
      />
      <LocalityFacts locationName={property.location} locality={getLocality(property.location)} />
    </>
  );
}
