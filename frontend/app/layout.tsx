import "./globals.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import LayoutWrapper from "@/components/LayoutWrapper";
import LocationChips from "@/components/LocationChips";
import Footer from "@/components/Footer";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/hooks/useConfirm";
import { SettingsProvider } from "@/hooks/useSettings";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
      </head>
      <body className="flex flex-col min-h-screen">
        <SettingsProvider>
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

        </ConfirmProvider>
        </ToastProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
