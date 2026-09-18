import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
export const metadata: Metadata = {
  title: "Trail — A better path to your next role",
  description:
    "A thoughtful job-search workspace for builders. Discover relevant opportunities, research companies, draft personal outreach, and contribute with context.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${geist.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
