import LandingPage from "@/components/landing/LandingPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TrialBridge — Clinical Trial Matching",
  description:
    "AI-powered, x402-gated clinical trial eligibility matching. DeSci agents on Base Sepolia.",
  icons: {
    icon: "/banner-TB.png",
  },
};

export default function Home() {
  return <LandingPage />;
}
