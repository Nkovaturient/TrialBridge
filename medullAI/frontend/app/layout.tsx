import type { Metadata } from "next";
import { DM_Sans, Inconsolata, Syne } from "next/font/google";
import "./globals.css";

const fontDmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const fontInconsolata = Inconsolata({
  variable: "--font-inconsolata",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const fontSyne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "TrialBridge — Clinical Trial Matching",
  description:
    "AI-powered, x402-gated clinical trial eligibility matching for CRO and Pharma teams. Powered by DeSci agents on Base Sepolia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fontDmSans.variable} ${fontInconsolata.variable} ${fontSyne.variable} h-full`}
    >
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
