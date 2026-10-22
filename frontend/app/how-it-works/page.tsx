import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/serverData";
import { SITE_URL } from "@/lib/assets";

export const metadata: Metadata = {
  title: "How Plot and Roof Works | Free Listings and Lead Access",
  description:
    "Learn how to list property for free on Plot and Roof and explore subscription plans for accessing available real estate leads.",
  alternates: { canonical: `${SITE_URL}/how-it-works` },
  openGraph: {
    title: "How Plot and Roof Works | Free Listings and Lead Access",
    description:
      "Learn how to list property for free on Plot and Roof and explore subscription plans for accessing available real estate leads.",
    url: `${SITE_URL}/how-it-works`,
    type: "website",
  },
};

const steps = [
  {
    title: "Step 1: Create Your Account",
    body: [
      "Register on Plot and Roof and provide the information required to use the platform.",
    ],
  },
  {
    title: "Step 2: List Your Property for Free",
    body: [
      "Submit your eligible property listing, upload photographs, and provide accurate information such as property type, location, price, and other details requested by the platform.",
      "There is no initial listing fee under our free-listing model.",
    ],
  },
  {
    title: "Step 3: Make Your Property Discoverable",
    body: [
      "Once your listing has been published or approved according to the platform's process, it can be discovered by users browsing the relevant property categories.",
      "Keep your photographs and property information accurate and up to date.",
    ],
  },
  {
    title: "Step 4: Explore Subscription Plans",
    body: [
      "If you want to access lead information, review the available subscription plans and compare their features, duration, pricing, and limitations.",
    ],
  },
  {
    title: "Step 5: Access Available Leads",
    body: [
      "Purchase a suitable plan to access the lead information covered by that subscription.",
      "Lead availability and the information provided depend on the platform's functionality and applicable plan terms.",
    ],
  },
];

const audience = [
  "Individual property owners.",
  "Real estate brokers and agents.",
  "Independent property consultants.",
  "Small real estate agencies and groups.",
  "Other eligible property listers.",
];

export default async function HowItWorksPage() {
  const settings = await getSettings();
  const siteName = (settings.site_name || "").trim() || "Plot and Roof";

  return (
    <div className="min-h-screen py-10 md:py-16 px-4 md:px-6 lg:px-10" style={{ backgroundColor: "var(--bg-page)" }}>
      <div className="max-w-3xl mx-auto">
        <h1
          className="text-3xl md:text-4xl font-extrabold mb-4"
          style={{ color: "var(--text-dark)" }}
        >
          How {siteName} Works
        </h1>
        <p className="text-base md:text-lg mb-3" style={{ color: "var(--text-muted)" }}>
          {siteName} makes it easier to showcase properties online and explore real estate
          lead-generation opportunities.
        </p>
        <p className="text-base mb-10" style={{ color: "var(--text-muted)" }}>
          Whether you are an individual property owner, broker, consultant, or small real estate
          group, getting started is simple.
        </p>

        <div className="space-y-8">
          {steps.map((step) => (
            <section key={step.title}>
              <h2
                className="text-xl md:text-2xl font-bold mb-2"
                style={{ color: "var(--text-dark)" }}
              >
                {step.title}
              </h2>
              {step.body.map((para, i) => (
                <p key={i} className="text-base mb-2 last:mb-0" style={{ color: "var(--text-muted)" }}>
                  {para}
                </p>
              ))}
            </section>
          ))}

          <section>
            <h2
              className="text-xl md:text-2xl font-bold mb-3"
              style={{ color: "var(--text-dark)" }}
            >
              Who Can Use {siteName}?
            </h2>
            <ul className="list-disc pl-6 space-y-1" style={{ color: "var(--text-muted)" }}>
              {audience.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2
              className="text-xl md:text-2xl font-bold mb-2"
              style={{ color: "var(--text-dark)" }}
            >
              Start Today
            </h2>
            <p className="text-base mb-2" style={{ color: "var(--text-muted)" }}>
              Publish your property for free or explore the subscription plans available for lead
              access.
            </p>
            <p className="text-base mb-6" style={{ color: "var(--text-muted)" }}>
              {siteName} helps bring property listings and lead-generation opportunities together in
              one platform.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/post"
                className="btn btn-sm"
                style={{ backgroundColor: "var(--secondary)", color: "#ffffff", borderColor: "var(--secondary)" }}
              >
                Post Property Free
              </Link>
              <Link
                href="/properties"
                className="btn btn-sm"
                style={{ backgroundColor: "var(--primary)", color: "#ffffff", borderColor: "var(--primary)" }}
              >
                Browse Properties
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
