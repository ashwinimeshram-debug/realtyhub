import type { Metadata } from "next";
import LegalSections from "@/components/legal/LegalSections";
import { SITE_URL } from "@/lib/assets";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy policy covering how we collect, use and protect personal and property information submitted on our Nagpur real estate portal.",
  alternates: { canonical: `${SITE_URL}/privacy-policy` },
};

const privacySections = [
  {
    id: "p1",
    label: "Introduction",
    content:
      "Plot and Roof is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.",
  },
  {
    id: "p2",
    label: "Information We Collect",
    content:
      "We may collect personal information such as your name, email address, phone number, and property details when you register, post a property, contact us, or subscribe to our services. We may also collect usage data and cookies to improve your experience.",
  },
  {
    id: "p3",
    label: "How We Use Your Information",
    content:
      "We use the information we collect to provide and maintain our services, facilitate property listings and inquiries, process subscriptions, communicate with you, improve our platform, and comply with legal obligations.",
  },
  {
    id: "p4",
    label: "Sharing Your Information",
    content:
      "We may share your information with other users when you post a property or make an inquiry (as necessary to facilitate contact). We may share with service providers who assist our operations, and when required by law or to protect our rights.",
  },
  {
    id: "p5",
    label: "Data Security",
    content:
      "We implement reasonable security measures to protect your personal information. However, no method of transmission over the internet or electronic storage is 100% secure.",
  },
  {
    id: "p6",
    label: "Your Rights",
    content:
      "You may access, update, or delete your personal information by contacting us. You may also opt out of certain communications. Depending on your location, you may have additional rights under applicable data protection laws.",
  },
  {
    id: "p7",
    label: "Cookies",
    content:
      "We use cookies and similar tracking technologies to enhance your experience, analyze usage, and assist with marketing efforts. You can control cookie preferences through your browser settings.",
  },
  {
    id: "p8",
    label: "Changes to This Policy",
    content:
      "We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page with an updated revision date.",
  },
  {
    id: "p9",
    label: "Contact Us",
    content:
      "If you have questions or concerns about this Privacy Policy, please contact us through our Contact page.",
  },
];

export default function PrivacyPolicyPage() {
  return <LegalSections title="Privacy Policy" sections={privacySections} />;
}
