import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { I18nProvider } from "./i18n/i18n-provider";
import "./globals.css";
import "./calendar.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tempo-personale.chatgpt.site"),
  title: "Timmy Timer — The right time, in the right place",
  description:
    "The time tracker with character: organize clients, projects, and hours with Timmy.",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Timmy Timer",
    description: "The right time, in the right place.",
    images: ["/og-timmy-timer-en.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Timmy Timer",
    description: "The right time, in the right place.",
    images: ["/og-timmy-timer-en.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2d2038",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
