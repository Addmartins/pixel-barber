import type { Metadata, Viewport } from "next";
import { AppConnectivity } from "@/components/device/AppConnectivity";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pixel Barber | Clube da Barbearia",
  description: "Agende seu corte, acumule pontos e jogue no Pixel Boy.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Pixel Barber" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#e88b2e",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><AppConnectivity />{children}</body></html>;
}
