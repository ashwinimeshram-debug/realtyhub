import { Suspense } from "react";
import type { Metadata } from "next";
import UnsubscribeClient from "./UnsubscribeClient";

export const metadata: Metadata = {
  title: "Unsubscribe from alerts",
  robots: { index: false, follow: false },
};

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh]" />}>
      <UnsubscribeClient />
    </Suspense>
  );
}
