export interface SiteInfo {
  siteName: string;
  siteUrl: string;
  logoUrl?: string;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  socials: string[];
  reraLicense?: string;
}

export interface PropertyFieldValue {
  field_key: string;
  field_value: string;
  field_label?: string;
}

export interface SeoContact {
  name?: string | null;
  mobile?: string | null;
  email?: string | null;
}

export interface SeoProperty {
  id: number;
  listing_id?: string | null;
  title: string;
  description?: string | null;
  price?: number | null;
  price_text?: string | null;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  transaction_type?: string | null;
  property_type?: string | null;
  is_featured?: boolean;
  is_verified?: boolean;
  images?: string[];
  created_at?: string | null;
  updated_at?: string | null;
  selected_features?: { id: number; label: string }[];
  field_values?: PropertyFieldValue[];
  contact?: SeoContact | null;
}

export interface FaqItem {
  id?: number;
  question: string;
  answer: string;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface LocalityInfo {
  name: string;
  slug: string;
  geo?: GeoPoint;
  connectivity?: string[];
  landmarks?: string[];
  description?: string;
}

export interface JsonLdNode {
  "@type": string | string[];
  "@id"?: string;
  [key: string]: unknown;
}

export interface JsonLdGraph {
  "@context": "https://schema.org";
  "@graph": JsonLdNode[];
}

export interface BreadcrumbEntry {
  name: string;
  url: string;
}
