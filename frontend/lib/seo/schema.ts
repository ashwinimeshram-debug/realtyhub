import { SITE_URL, backendAssetUrl } from "@/lib/assets";
import { buildPropertySlug } from "@/lib/propertySlug";
import { localityGeo, type LocalityInfo } from "./nagpur-geo";
import { stripHtml, BUYER_FAQ } from "./answers";
import type {
  FaqItem,
  JsonLdGraph,
  JsonLdNode,
  SeoProperty,
  SiteInfo,
} from "./types";

const CURRENCY = "INR";
const REGION = "Maharashtra";
const COUNTRY = "IN";

/** Prefer a property's exact coordinates; fall back to its locality centroid. */
export function propertyGeo(property: SeoProperty) {
  if (
    typeof property.latitude === "number" &&
    typeof property.longitude === "number" &&
    Number.isFinite(property.latitude) &&
    Number.isFinite(property.longitude)
  ) {
    return { latitude: property.latitude, longitude: property.longitude };
  }
  return localityGeo(property.location);
}

export function absoluteUrl(path: string, siteUrl: string = SITE_URL): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildSiteInfo(
  settings: Record<string, string>,
  siteUrl: string = SITE_URL,
): SiteInfo {
  const siteName = (settings.site_name || "").trim() || "Nagpur Realty Hub";
  const socials = [
    settings.social_facebook,
    settings.social_instagram,
    settings.social_twitter,
    settings.social_youtube,
    settings.social_linkedin,
  ].filter((v): v is string => Boolean(v && v.trim()));

  return {
    siteName,
    siteUrl: siteUrl.replace(/\/+$/, ""),
    logoUrl: settings.site_logo ? backendAssetUrl(settings.site_logo) : undefined,
    description:
      settings.site_description?.trim() ||
      settings.seo_default_description?.trim() ||
      undefined,
    phone: settings.contact_phone?.trim() || undefined,
    email: settings.contact_email?.trim() || undefined,
    address: settings.contact_address?.trim() || undefined,
    socials,
    reraLicense: settings.rera_license?.trim() || undefined,
  };
}

export function organizationId(site: SiteInfo): string {
  return `${site.siteUrl}/#organization`;
}

function organizationNode(site: SiteInfo): JsonLdNode {
  const node: JsonLdNode = {
    "@type": ["RealEstateAgent", "Organization"],
    "@id": organizationId(site),
    name: site.siteName,
    url: site.siteUrl,
    areaServed: { "@type": "City", name: "Nagpur" },
  };
  if (site.logoUrl) {
    node.logo = { "@type": "ImageObject", url: site.logoUrl };
    node.image = site.logoUrl;
  }
  if (site.description) node.description = site.description;
  if (site.phone) node.telephone = site.phone;
  if (site.email) node.email = site.email;
  if (site.address) {
    node.address = {
      "@type": "PostalAddress",
      streetAddress: site.address,
      addressLocality: "Nagpur",
      addressRegion: REGION,
      addressCountry: COUNTRY,
    };
  }
  if (site.socials.length) node.sameAs = site.socials;
  if (site.reraLicense) {
    node.identifier = { "@type": "PropertyValue", propertyID: "RERA", value: site.reraLicense };
  }
  return node;
}

function websiteNode(site: SiteInfo): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": `${site.siteUrl}/#website`,
    url: site.siteUrl,
    name: site.siteName,
    publisher: { "@id": organizationId(site) },
    inLanguage: "en-IN",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${site.siteUrl}/properties?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildSiteGraph(site: SiteInfo): JsonLdGraph {
  return {
    "@context": "https://schema.org",
    "@graph": [organizationNode(site), websiteNode(site)],
  };
}

/* ───────── Property helpers ───────── */

export function parseAreaSqft(raw?: string | null): number | null {
  if (!raw) return null;
  const match = String(raw).match(/([\d.]+)\s*(?:,\s*([a-zA-Z.\s]+))?/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = (match[2] || "sq ft").toLowerCase();
  let factor = 1;
  if (unit.includes("yard")) factor = 9;
  else if (unit.includes("acre")) factor = 43560;
  else if (unit.includes("meter") || unit.includes("sqm") || unit.includes("m2")) factor = 10.7639;
  return Math.round(value * factor);
}

function fieldValue(property: SeoProperty, key: string): string | undefined {
  return property.field_values?.find((f) => f.field_key === key)?.field_value;
}

function numberField(property: SeoProperty, key: string): number | null {
  const value = fieldValue(property, key);
  if (!value) return null;
  const parsed = parseInt(String(value).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function residenceType(propertyType?: string | null): string {
  const t = (propertyType || "").toLowerCase();
  if (/(plot|land|na[_ -]?plot|open plot)/.test(t)) return "Place";
  if (/(bungalow|villa|house|row|independent|duplex|tenement)/.test(t)) return "SingleFamilyResidence";
  if (/(shop|office|commercial|showroom|warehouse)/.test(t)) return "LocalBusiness";
  return "Apartment";
}

export function propertyUrl(property: SeoProperty, site: SiteInfo): string {
  return `${site.siteUrl}/property/${buildPropertySlug(property.id, property.title)}`;
}

function postalAddress(location: string): JsonLdNode {
  return {
    "@type": "PostalAddress",
    addressLocality: location,
    addressRegion: REGION,
    addressCountry: COUNTRY,
  };
}

function offerNode(property: SeoProperty, site: SiteInfo, url: string): JsonLdNode | null {
  if (!property.price || property.price <= 0) return null;
  const isRent = (property.transaction_type || "").toLowerCase() === "rent";
  const offer: JsonLdNode = {
    "@type": "Offer",
    "@id": `${url}#offer`,
    url,
    price: property.price,
    priceCurrency: CURRENCY,
    availability: "https://schema.org/InStock",
    businessFunction: isRent
      ? "http://purl.org/goodrelations/v1#LeaseOut"
      : "http://purl.org/goodrelations/v1#Sell",
    seller: { "@id": organizationId(site) },
  };
  if (isRent) {
    offer.priceSpecification = {
      "@type": "UnitPriceSpecification",
      price: property.price,
      priceCurrency: CURRENCY,
      unitCode: "MON",
      unitText: "per month",
    };
  }
  return offer;
}

function breadcrumbNode(
  url: string,
  items: { name: string; path: string }[],
  site: SiteInfo,
): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path, site.siteUrl),
    })),
  };
}

export interface ListingGraphOptions {
  url?: string;
  breadcrumbs?: { name: string; path: string }[];
  faqs?: FaqItem[];
}

export function buildListingGraph(
  property: SeoProperty,
  site: SiteInfo,
  options: ListingGraphOptions = {},
): JsonLdGraph {
  const url = options.url || propertyUrl(property, site);
  const description =
    stripHtml(property.description).slice(0, 320) ||
    `${property.title} in ${property.location}, Nagpur.`;

  const images = (property.images || []).map((img) => backendAssetUrl(img)).filter(Boolean);
  const areaSqft = parseAreaSqft(fieldValue(property, "area_size"));
  const bedrooms = numberField(property, "bedrooms");
  const bathrooms = numberField(property, "bathrooms");
  const rera = fieldValue(property, "rera_number") || fieldValue(property, "rera");

  const floorSize: JsonLdNode | undefined = areaSqft
    ? { "@type": "QuantitativeValue", value: areaSqft, unitCode: "FTK", unitText: "sq ft" }
    : undefined;

  const amenities = (property.selected_features || []).map((f) => ({
    "@type": "LocationFeatureSpecification",
    name: f.label,
    value: true,
  }));

  const residence: JsonLdNode = {
    "@type": residenceType(property.property_type),
    "@id": `${url}#residence`,
    name: property.title,
    address: postalAddress(property.location),
    geo: {
      "@type": "GeoCoordinates",
      latitude: propertyGeo(property).latitude,
      longitude: propertyGeo(property).longitude,
    },
  };
  if (floorSize) residence.floorSize = floorSize;
  if (bedrooms) {
    residence.numberOfRooms = bedrooms;
    residence.numberOfBedrooms = bedrooms;
  }
  if (bathrooms) residence.numberOfBathroomsTotal = bathrooms;

  const listing: JsonLdNode = {
    "@type": "RealEstateListing",
    "@id": `${url}#listing`,
    name: property.title,
    description,
    url,
    about: { "@id": `${url}#residence` },
    address: postalAddress(property.location),
    geo: {
      "@type": "GeoCoordinates",
      latitude: propertyGeo(property).latitude,
      longitude: propertyGeo(property).longitude,
    },
    inLanguage: "en-IN",
  };
  if (images.length) residence.image = images;
  if (images.length) residence.photo = images.map((u) => ({ "@type": "ImageObject", url: u }));
  if (property.created_at) residence.datePosted = property.created_at;
  if (property.updated_at) residence.dateModified = property.updated_at;

  const identifiers: JsonLdNode[] = [];
  if (property.listing_id) {
    identifiers.push({ "@type": "PropertyValue", propertyID: "MLS", value: property.listing_id });
  }
  if (rera) {
    identifiers.push({ "@type": "PropertyValue", propertyID: "RERA", value: rera });
  }
  if (identifiers.length === 1) residence.identifier = identifiers[0];
  else if (identifiers.length > 1) residence.identifier = identifiers;

  if (images.length) listing.image = images;
  if (property.created_at) {
    listing.datePosted = property.created_at;
  }
  if (property.updated_at) listing.dateModified = property.updated_at;
  if (floorSize) listing.floorSize = floorSize;
  if (bedrooms) listing.numberOfRooms = bedrooms;
  if (amenities.length) listing.amenityFeature = amenities;

  const graph: JsonLdNode[] = [listing, residence];
  const offer = offerNode(property, site, url);
  if (offer) graph.push(offer);
  graph.push(
    breadcrumbNode(
      url,
      options.breadcrumbs || [
        { name: "Home", path: "/" },
        { name: "Properties", path: "/properties" },
        { name: property.title, path: `/property/${buildPropertySlug(property.id, property.title)}` },
      ],
      site,
    ),
  );

  if (options.faqs && options.faqs.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: options.faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: stripHtml(f.answer) },
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

export function buildFaqGraph(faqs: FaqItem[], url: string): JsonLdGraph {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: stripHtml(f.answer) },
        })),
      },
    ],
  };
}

export interface LocationHubOptions {
  url: string;
  listings: SeoProperty[];
  faqs?: FaqItem[];
  locality?: LocalityInfo;
}

export function buildLocationHubGraph(
  locationName: string,
  site: SiteInfo,
  options: LocationHubOptions,
): JsonLdGraph {
  const { url, listings, faqs, locality } = options;
  const geo = locality?.geo || localityGeo(locationName);

  const place: JsonLdNode = {
    "@type": "Place",
    "@id": `${url}#place`,
    name: `${locationName}, Nagpur`,
    address: {
      "@type": "PostalAddress",
      addressLocality: locationName,
      addressRegion: REGION,
      addressCountry: COUNTRY,
    },
    geo: { "@type": "GeoCoordinates", latitude: geo.latitude, longitude: geo.longitude },
  };

  const collection: JsonLdNode = {
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    name: `Properties in ${locationName}, Nagpur`,
    about: { "@id": `${url}#place` },
    isPartOf: { "@id": `${site.siteUrl}/#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: listings.length,
      itemListElement: listings.map((property, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: property.title,
        url: propertyUrl(property, site),
      })),
    },
  };

  const graph: JsonLdNode[] = [
    collection,
    place,
    breadcrumbNode(
      url,
      [
        { name: "Home", path: "/" },
        { name: "Properties", path: "/properties" },
        { name: locationName, path: `/properties/${(locality?.slug) || locationName.toLowerCase().replace(/\s+/g, "-")}` },
      ],
      site,
    ),
  ];

  if (faqs && faqs.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: stripHtml(f.answer) },
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

export { BUYER_FAQ };
