import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BlockedUserScreen } from "@/components/BlockedUserScreen";
import { auth } from "@/lib/auth";
import { findUserById } from "@/lib/users";
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
  title: "ProxNet — Discover Professionals in Your Proximity",
  description:
    "Your neighbor could be your next career connection. ProxNet helps you discover professionals living nearby, ask questions anonymously, and network — all without revealing identities.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ProxNet",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  themeColor: "#004182",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  let isBlocked = false;

  if (session?.user?.id) {
    const user = await findUserById(session.user.id);
    if (user?.is_blocked) {
      isBlocked = true;
    }
  }

  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <Nav />
          {isBlocked ? (
            <BlockedUserScreen />
          ) : (
            <main className="main-content">{children}</main>
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
