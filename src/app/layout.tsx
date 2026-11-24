import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Literata } from "next/font/google";
import "./globals.css";

// Three typefaces, each with one job (design review 2026-11-23): Geist for the app, Literata for
// words said in an interview (stories, answers, interview questions), Geist Mono for spoken time and
// figures.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "InterviewMax",
  description: "Turn your work history into behavioral interview stories that land.",
};

export const viewport: Viewport = {
  // Graphite, the sidebar's colour (was the teal from before the rebrand).
  themeColor: "#1f2333",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // The sidebar sets data-nav on <html> before React loads (components/app-header.tsx).
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${literata.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
