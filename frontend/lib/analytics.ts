import { hasAnalyticsConsent } from "@/lib/cookieConsent";

export const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || "";

/** Fire a GA4 event (no-op when GA4 is not configured or consent is missing). */
export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (!GA4_ID || !hasAnalyticsConsent()) return;
  window.gtag?.("event", name, params);
}
