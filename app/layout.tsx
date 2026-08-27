import type { Metadata } from "next";
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
  title: "Tempo — Registro attività",
  description: "Registro personale di clienti, progetti e ore lavorate.",
  manifest: "/manifest.webmanifest",
  themeColor: "#243f36",
  openGraph: {
    title: "Tempo — Registro attività",
    description: "Il tuo tempo, con chiarezza.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tempo — Registro attività",
    description: "Il tuo tempo, con chiarezza.",
    images: ["/og.png"],
  },
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
