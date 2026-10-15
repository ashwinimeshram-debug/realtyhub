"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CONSENT_EVENT, hasAnalyticsConsent } from "@/lib/cookieConsent";

const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || "";

/**
 * Google Analytics 4 via gtag. Loads only when NEXT_PUBLIC_GA4_MEASUREMENT_ID
 * is set AND the visitor has granted cookie consent; the initial page_view is
 * sent by gtag('config'), and SPA route changes send follow-up page_view
 * events using the current pathname.
 */
export default function GA4() {
  const pathname = usePathname();
  const isFirst = useRef(true);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const sync = () => setEnabled(Boolean(GA4_ID) && hasAnalyticsConsent());
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (isFirst.current) {
      // Initial page_view is handled by the gtag('config', id) call.
      isFirst.current = false;
      return;
    }
    window.gtag?.("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, enabled]);

  if (!GA4_ID || !enabled) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${GA4_ID}');`}
      </Script>
    </>
  );
}
