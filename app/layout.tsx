import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BlockUserWrapper } from "@/components/BlockUserWrapper";
import { Suspense } from "react";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "https://www.proxnet.in"),
  title: {
    default: "ProxNet — Anonymous Local Professional Network & Job Referrals",
    template: "%s | ProxNet",
  },
  description:
    "ProxNet connects you with verified professionals in your neighborhood — 100% anonymously. Get insider job referrals, ask candid career questions, join local forums & meetups, and build genuine career connections hiding in your backyard.",
  keywords: [
    "anonymous job referral",
    "professional network app",
    "local professional community",
    "neighborhood professionals",
    "employee referral app",
    "anonymous career Q&A",
    "proximity network",
    "privacy-first networking",
    "hyper-local professional network",
    "tech community near me",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-96.png",
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    title: "ProxNet — Anonymous Local Professional Network & Job Referrals",
    description:
      "Connect with verified professionals in your neighborhood — anonymously. Request job referrals, ask career questions, and join local meetups.",
    url: "https://www.proxnet.in",
    siteName: "ProxNet",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "ProxNet Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "ProxNet — Anonymous Local Professional Network",
    description:
      "Discover professionals nearby. Get referred anonymously. Build your local career network.",
    images: ["/logo.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ProxNet",
  },
  formatDetection: {
    telephone: false,
  },
};

import { PreventZoom } from "@/components/PreventZoom";
import { PullToRefresh } from "@/components/PullToRefresh";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  themeColor: "#004182",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <GoogleAnalytics />
        <PreventZoom />
        <ThemeProvider>
          <Nav />
          <PullToRefresh>
            <Suspense fallback={<main className="main-content">{children}</main>}>
              <BlockUserWrapper>
                <main className="main-content">{children}</main>
              </BlockUserWrapper>
            </Suspense>
          </PullToRefresh>
        </ThemeProvider>
      </body>
    </html>
  );
}
