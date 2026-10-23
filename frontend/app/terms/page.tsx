import type { Metadata } from "next";
import LegalSections from "@/components/legal/LegalSections";
import { SITE_URL } from "@/lib/assets";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of service for using our Nagpur real estate portal, including listing rules, user responsibilities and RERA disclaimer.",
  alternates: { canonical: `${SITE_URL}/terms` },
};

const termsSections = [
  {
    id: "t1",
    label: "Acceptance of Terms",
    content:
      "By accessing or using Plot and Roof, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our platform.",
  },
  {
    id: "t2",
    label: "Use of the Platform",
    content:
      "You may use Plot and Roof for lawful purposes only. You agree not to use the platform in any way that violates applicable laws, infringes on rights, or interferes with the platform's operation.",
  },
  {
    id: "t3",
    label: "Property Listings",
    content:
      "Users may post property listings for free where eligible. You are responsible for ensuring all information in your listings is accurate, complete, and does not mislead users. We reserve the right to remove or moderate listings that violate our policies.",
  },
  {
    id: "t4",
    label: "User Accounts",
    content:
      "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use.",
  },
  {
    id: "t5",
    label: "Subscriptions and Payments",
    content:
      "Certain features, including access to lead information, may require a subscription. All fees are as displayed at the time of purchase. Payments are processed through our designated payment providers.",
  },
  {
    id: "t6",
    label: "Intellectual Property",
    content:
      "All content on Plot and Roof, including logos, text, graphics, and software, is the property of Plot and Roof or its licensors and is protected by intellectual property laws.",
  },
  {
    id: "t7",
    label: "Disclaimer",
    content:
      "Plot and Roof provides a platform for connecting users. We do not guarantee the accuracy of listings or the outcome of any transactions. Users are advised to verify all details and conduct due diligence before making property-related decisions. This platform is not a substitute for legal, financial, or RERA advice.",
  },
  {
    id: "t8",
    label: "Limitation of Liability",
    content:
      "To the maximum extent permitted by law, Plot and Roof shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform.",
  },
  {
    id: "t9",
    label: "Termination",
    content:
      "We reserve the right to suspend or terminate your access to the platform at our discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users or our business.",
  },
  {
    id: "t10",
    label: "Governing Law",
    content:
      "These Terms shall be governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in Nagpur, Maharashtra.",
  },
  {
    id: "t11",
    label: "Changes to Terms",
    content:
      "We may modify these Terms of Service at any time. Continued use of the platform after changes constitutes acceptance of the revised terms.",
  },
  {
    id: "t12",
    label: "Contact Us",
    content:
      "If you have questions about these Terms, please contact us through our Contact page.",
  },
];

export default function TermsPage() {
  return <LegalSections title="Terms of Service" sections={termsSections} />;
}
