import type { FaqItem, SeoProperty, SiteInfo } from "./types";

export function stripHtml(input?: string | null): string {
  if (!input) return "";
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function clampAnswer(text: string, max = 60): string {
  const parts = words(text);
  if (parts.length <= max) return text;
  return parts.slice(0, max).join(" ").replace(/[,.;:]$/, "") + "…";
}

export const BUYER_FAQ: FaqItem[] = [
  {
    id: 9001,
    question: "How do I buy a property in Nagpur?",
    answer: clampAnswer(
      "Shortlist verified listings, visit the site, verify ownership documents and RERA registration, negotiate the price, then sign the agreement and register the sale deed at the sub-registrar office. Most buyers complete the process in four to eight weeks with a home loan.",
    ),
  },
  {
    id: 9002,
    question: "What documents are needed to buy a flat in Nagpur?",
    answer: clampAnswer(
      "You typically need the sale deed or agreement to sell, title and 7/12 extract, approved building plan, encumbrance certificate, property tax receipts, NOC from the society, and your PAN, Aadhaar and income proof for the loan and registration.",
    ),
  },
  {
    id: 9003,
    question: "Is buying an under-construction property in Nagpur safe?",
    answer: clampAnswer(
      "It can be safe when the project is RERA registered, the builder has a delivery track record and payments follow construction-linked milestones. Always check the RERA portal, sanctioned plans and the builder-buyer agreement before booking.",
    ),
  },
  {
    id: 9004,
    question: "How is property price decided in Nagpur?",
    answer: clampAnswer(
      "Price depends on locality, carpet area, floor, age, amenities and demand. Ready reckoner rates set the minimum for stamp duty, while the actual market rate is negotiated and varies by project, view and possession timeline.",
    ),
  },
  {
    id: 9005,
    question: "What is RERA and does it protect Nagpur buyers?",
    answer: clampAnswer(
      "RERA is the Real Estate (Regulation and Development) Act, 2016. For registered projects it mandates project registration, escrow of 70% collections, standard agreements and penalties for delays, giving Nagpur buyers stronger protection and grievance redress.",
    ),
  },
  {
    id: 9006,
    question: "Can I get a home loan for a Nagpur property?",
    answer: clampAnswer(
      "Yes. Banks and housing finance companies fund 75 to 90 percent of the property value for eligible buyers. You need clear title, RERA-approved projects for under-construction homes, and income and credit documents. Compare interest rates before choosing a lender.",
    ),
  },
];

export function buildListingAnswers(property: SeoProperty, site: SiteInfo): FaqItem[] {
  const name = property.title;
  const locality = property.location;
  const priceText = property.price_text && property.price_text !== "*" ? property.price_text : null;
  const priceAnswer = property.price
    ? `This property is priced at about ₹${Number(property.price).toLocaleString("en-IN")}${property.transaction_type === "rent" ? " per month" : ""}. Prices in ${property.location} vary by floor, area and amenities, so confirm the final amount with the listing owner.`
    : priceText
      ? `The asking price is listed as ${priceText}. Contact the owner for the exact amount and any negotiable components for this property in ${property.location}.`
      : `Pricing for this property in ${property.location} is available on request. Use the contact form to get the latest price directly from the owner.`;

  return [
    {
      id: 9101,
      question: `What is the price of this property in ${property.location}?`,
      answer: clampAnswer(priceAnswer),
    },
    {
      id: 9102,
      question: `Where is this property located in Nagpur?`,
      answer: clampAnswer(
        `The property is located in ${property.location}, Nagpur, Maharashtra. ${property.location} offers road, school and market access, and you can request the exact address from the owner through the enquiry form.`,
      ),
    },
    {
      id: 9103,
      question: `Is this ${property.property_type || "property"} verified on ${site.siteName}?`,
      answer: clampAnswer(
        property.is_verified
          ? `Yes, this listing is marked verified by ${site.siteName}. We still recommend physically inspecting the property and checking ownership papers and RERA registration before paying any advance.`
          : `This listing is published on ${site.siteName}. Always inspect the property, verify title documents and confirm RERA registration before making any payment or booking amount.`,
      ),
    },
    {
      id: 9104,
      question: `How do I contact the owner of this property?`,
      answer: clampAnswer(
        `Use the enquiry or enquiry form on this page to connect directly with the owner of ${property.title}. Share your name and mobile number and the owner or our team will reach out to schedule a visit.`,
      ),
    },
  ];
}
