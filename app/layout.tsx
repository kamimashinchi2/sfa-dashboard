import type { Metadata } from "next";
import { Fraunces, Sora, JetBrains_Mono } from "next/font/google";
import TawkLoader from "./components/academy/TawkLoader";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

const sans = Sora({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Smart Financial Academy — Iteration 4 Pilot",
  description:
    "Bilingual M1–M5 + A6–A8 educational pilot within the eight-stage Smart Financial Academy roadmap. Synthetic practice only. Weekly submission packets are local evidence exports.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col font-sans text-paper">
        {children}
        <TawkLoader />
      </body>
    </html>
  );
}
