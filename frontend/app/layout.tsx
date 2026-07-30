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
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Poppins:wght@300;400;500;600;700;800&family=Roboto:wght@300;400;500;700&family=Lato:wght@300;400;700&family=Merriweather:wght@300;400;700;900&family=Montserrat:wght@300;400;500;600;700;800&family=Oswald:wght@200;400;500;600;700&family=Raleway:wght@300;400;500;600;700&family=Nunito:wght@300;400;600;700;800&family=Dancing+Script:wght@400;500;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Josefin+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
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
