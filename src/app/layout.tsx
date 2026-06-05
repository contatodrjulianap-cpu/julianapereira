import type { Metadata } from "next";
import { Geist, Geist_Mono, Gilda_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { FbPixel } from "@/components/fb-pixel";
import { CLIENT_CONFIG } from "@/lib/client-config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Gilda Display — serif editorial da marca Sakura (títulos). Peso único 400.
const gilda = Gilda_Display({
  variable: "--font-gilda",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: CLIENT_CONFIG.professionalName,
  description: CLIENT_CONFIG.tagline,
  appleWebApp: {
    capable: true,
    title: CLIENT_CONFIG.crmName,
    statusBarStyle: "default",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  themeColor: "#414930",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${gilda.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <FbPixel pixelId={process.env.NEXT_PUBLIC_FB_PIXEL_ID ?? ""} />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
