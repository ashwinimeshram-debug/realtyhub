import type { Metadata } from "next";
import AboutClient from "./AboutClient";
import { SITE_URL } from "@/lib/assets";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about Plot and Roof — how we verify listings, help owners post properties and connect buyers and tenants directly.",
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: { title: "About Us", url: `${SITE_URL}/about`, type: "website" },
};

const aboutSections: Array<{
  id: string;
  label: string;
  content: string;
  type?: "section" | "description";
}> = [
  {
    id: "a1",
    label: "Welcome",
    content:
      "Welcome to Plot and Roof, your trusted destination for buying, selling, and exploring properties in Nagpur.",
  },
  {
    id: "a2",
    label: "About Us",
    type: "section",
    content:
      "Making Property Listings and Real Estate Lead Generation More Accessible\nPlot and Roof is an online real estate platform designed to make it easier for individuals and property professionals to showcase properties and explore real estate opportunities.\nWe believe that property owners, brokers, independent consultants, and small real estate groups should have a convenient way to publish property listings online without facing an initial listing fee.\nAt the same time, real estate professionals need practical ways to identify prospective customers and grow their businesses.\nPlot and Roof brings these needs together through a free property-listing model and subscription-based access to available lead information.",
  },
  {
    id: "a3",
    label: "Our Mission",
    type: "section",
    content:
      "To simplify property discovery and real estate lead generation by providing a platform where individuals, brokers, and consultants can list properties for free and access lead opportunities through affordable subscriptions.",
  },
  {
    id: "a4",
    label: "Our Vision",
    type: "section",
    content:
      "To become a trusted real estate platform that connects property seekers, owners, brokers, and investors through accessible property listings and smarter lead-generation solutions.",
  },
  {
    id: "vyk2odel",
    label: "What We Do",
    type: "section",
    content:
      "Our platform supports two primary activities.\n\n<b>Property discovery:</b> We help users explore available property listings, including relevant photographs and property information.\n\n<b>Property promotion and lead access:</b> We provide a platform where eligible users can publish property listings for free and explore subscription plans for accessing available leads.",
  },
  {
    id: "a5",
    label: "Why Choose Us",
    content:
      "Verified and quality property listings\nUser-friendly search and browsing experience\nDirect connection with property owners and agents\nLocal expertise in Nagpur real estate market\nTransparent and trustworthy platform",
  },
  {
    id: "a6",
    label: "Our Services",
    content:
      "Property Listings (Buy / Sell / Rent)\nLead Generation for Agents &amp; Builders\nProperty Promotion &amp; Marketing\nReal Estate Consultation",
  },
  {
    id: "slh1yvgb",
    label: "Who We Serve",
    type: "section",
    content:
      "<b>Individual Property Owners</b>\n\nProperty owners can showcase eligible properties for sale or rent without paying an initial listing fee.\n\n<b>Real Estate Brokers</b>\n\nBrokers can use the platform to publish property listings and explore subscription-based lead access.\n\n<b>Independent Property Consultants</b>\n\nConsultants can showcase property opportunities and explore options for accessing leads relevant to their business.\n\n<b>Small Real Estate Groups</b>\n\nSmall teams can use the platform to improve their online property visibility and explore lead-generation opportunities.",
  },
  {
    id: "9ywwiomy",
    label: "Our Approach",
    type: "section",
    content:
      "We aim to keep property listing accessible while offering additional lead-access features through subscriptions.\n\nUsers can begin by publishing eligible properties for free and consider a paid plan when they want access to the lead information covered by that plan.\n\nWe encourage users to provide accurate property information and verify important details before making property-related decisions.",
  },
  {
    id: "4rpq3stl",
    label: "Our Geographic Focus",
    type: "section",
    content:
      "Plot and Roof is focused initially on property opportunities in Nagpur, Maharashtra, with the goal of helping property seekers and real estate professionals discover opportunities through an accessible online platform.",
  },
  {
    id: "6muiqdes",
    label: "Get Started with Plot and Roof",
    type: "section",
    content:
      "Whether you want to showcase a property, explore available listings, or discover subscription options for real estate leads, Plot and Roof gives you a place to begin.\nExplore properties, publish your listing for free, or review our subscription plans to find the option that suits your needs.",
  },
];

export default function AboutPage() {
  return (
    <AboutClient
      rawSections={aboutSections}
      members={[]}
      layout="carousel"
      galleryImages={[]}
      siteName="Plot and Roof"
      galleryTransition="fade"
    />
  );
}
