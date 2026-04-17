import LandingPage from "@/components/landing/LandingPage";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const mode = process.env.NEXT_PUBLIC_PAYMENT_MODE ?? "standard";
  if (mode === "x402") {
    return {
      title: "TrialBridge — Clinical Trial Matching",
      description:
        "AI-powered, x402-gated clinical trial eligibility matching. DeSci agents on Base Sepolia.",
      icons: { icon: "/banner-TB.png" },
    };
  }
  return {
    title: "TrialBridge — Clinical Trial Matching",
    description:
      "Decision-support pre-screening for Indian CTRI trials. EDC exports, confidence scoring, coordinator review.",
    icons: { icon: "/banner-TB.png" },
  };
}

export default function Home() {
  return <LandingPage />;
}
