import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Fraunces, Geist, Geist_Mono, IBM_Plex_Mono } from "next/font/google";
import { DESIGN_BOOT_SCRIPT } from "@/lib/design-boot";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });
const barlow = Barlow_Condensed({ variable: "--font-barlow", subsets: ["latin"], weight: ["500", "600", "700"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Slate Replay",
  description: "A daily MLB betting-read game: real historical games, real closing odds, five minutes. No money.",
};

export const viewport: Viewport = { themeColor: "#0b0f14" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fonts = [geistSans, geistMono, fraunces, barlow, plexMono].map((f) => f.variable).join(" ");
  return (
    <html lang="en" data-design="sportsbook" className={`${fonts} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: DESIGN_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
