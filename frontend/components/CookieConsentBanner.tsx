"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CONSENT_EVENT, getConsent, setConsent } from "@/lib/cookieConsent";

/**
 * Cookie/analytics consent banner. Shows until the visitor accepts or
 * declines; the choice is stored locally and analytics stays off until
 * consent is granted.
 */
export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sync = () => setVisible(getConsent() === "unknown");
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
      <div className="mx-auto max-w-3xl rounded-lg border border-gray-200 bg-white p-4 shadow-lg flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-600 sm:text-sm">
          We use cookies to analyse traffic and improve your experience. See our{" "}
          <Link href="/privacy-policy" className="text-[var(--primary)] hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => setConsent("denied")} className="btn btn-sm btn-ghost">
            Decline
          </button>
          <button onClick={() => setConsent("granted")} className="btn btn-sm btn-primary">
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
