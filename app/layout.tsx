import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Timmy Timer — Il tempo giusto, al posto giusto",
  description:
    "Il time tracker con carattere: organizza clienti, progetti e ore insieme a Timmy.",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Timmy Timer",
    description: "Il tempo giusto, al posto giusto.",
    images: ["/og-timmy-timer.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Timmy Timer",
    description: "Il tempo giusto, al posto giusto.",
    images: ["/og-timmy-timer.png"],
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
    <html lang="it">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
