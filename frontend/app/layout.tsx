import "./globals.css";
import type { Metadata, Viewport } from "next";
import LayoutWrapper from "@/components/LayoutWrapper";
import LocationChips from "@/components/LocationChips";
import Footer from "@/components/Footer";
import ThemeStyle from "@/components/ThemeStyle";
import JsonLd from "@/components/seo/JsonLd";
import GA4 from "@/components/GA4";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import { ToastProvider } from "@/components/Toast";
import { SettingsProvider } from "@/hooks/useSettings";
import { OwnerAuthProvider } from "@/hooks/useOwnerAuth";
import { ConfirmProvider } from "@/hooks/useConfirm";
import { SITE_URL } from "@/lib/assets";
import { getSettings } from "@/lib/serverData";
import { buildSiteInfo, buildSiteGraph } from "@/lib/seo/schema";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const site = buildSiteInfo(settings, SITE_URL);
  const description =
    site.description ||
    `Browse verified properties for sale and rent in Nagpur. Connect directly with ${site.siteName}.`;

  const googleVerification = settings.seo_google_verification?.trim();
  const bingVerification = settings.seo_bing_verification?.trim();

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: site.siteName,
      template: `%s | ${site.siteName}`,
    },
    description,
    applicationName: site.siteName,
    alternates: { canonical: "/" },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
    openGraph: {
      type: "website",
      siteName: site.siteName,
      url: SITE_URL,
      description,
      images: site.logoUrl ? [{ url: site.logoUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      description,
      images: site.logoUrl ? [site.logoUrl] : undefined,
    },
    verification:
      googleVerification || bingVerification
        ? {
            google: googleVerification || undefined,
            other: bingVerification ? { "msvalidate.01": bingVerification } : undefined,
          }
        : undefined,
  };
}

export async function generateViewport(): Promise<Viewport> {
  const settings = await getSettings();
  return {
    width: "device-width",
    initialScale: 1,
    themeColor: settings.primary_color?.trim() || "#0f766e",
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettings();
  const site = buildSiteInfo(settings, SITE_URL);

  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <JsonLd data={buildSiteGraph(site)} />
        <GA4 />
        <ThemeStyle />
        <SettingsProvider>
        <OwnerAuthProvider>
        <ToastProvider>
        <ConfirmProvider>

        {/* Main Layout */}
        <LayoutWrapper>
          <main className="flex-grow">
            {children}
          </main>
        </LayoutWrapper>

        {/* Location chips above footer */}
        <LocationChips />

        {/* Footer always at bottom */}
        <Footer />

        <CookieConsentBanner />

        </ConfirmProvider>
        </ToastProvider>
        </OwnerAuthProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
