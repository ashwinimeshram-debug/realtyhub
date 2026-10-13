import "./globals.css";
import LayoutWrapper from "@/components/LayoutWrapper";
import LocationChips from "@/components/LocationChips";
import Footer from "@/components/Footer";
import ThemeStyle from "@/components/ThemeStyle";
import { ToastProvider } from "@/components/Toast";
import { SettingsProvider } from "@/hooks/useSettings";
import { OwnerAuthProvider } from "@/hooks/useOwnerAuth";
import { ConfirmProvider } from "@/hooks/useConfirm";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
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

        </ConfirmProvider>
        </ToastProvider>
        </OwnerAuthProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
