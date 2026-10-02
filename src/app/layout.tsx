import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Cinzel } from "next/font/google";
import { Providers } from "@/components/providers";
import { RegisterSW } from "@/components/pwa/register-sw";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BLACKMIRROR™ — Field Inspection",
  description:
    "Offline-first property inspection for Blackline Public Adjusters / BLACKBOX",
  applicationName: "BLACKMIRROR",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BLACKMIRROR",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0F1C2E",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrains.variable} ${cinzel.variable} bg-brand-navy text-brand-white antialiased`}
      >
        <Providers>
          <RegisterSW />
          {children}
        </Providers>
      </body>
    </html>
  );
}
