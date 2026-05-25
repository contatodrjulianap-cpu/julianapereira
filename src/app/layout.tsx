import type { Metadata } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond, Newsreader } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { FbPixel } from "@/components/fb-pixel";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

// Newsreader: serif moderna desenhada pra leitura digital — usada no quiz
// onde Cormorant ficava fino/etéreo demais em mobile.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dra. Juliana Pereira",
  description: "Odontologia estética em São Paulo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} ${newsreader.variable} h-full antialiased`}
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
