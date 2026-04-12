import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent CDP secrets from leaking into client bundles
  // All CDP_* vars are server-only; none should be prefixed NEXT_PUBLIC_
  serverExternalPackages: ["@coinbase/cdp-sdk"],

  async headers() {
    const origin = process.env.ALLOWED_ORIGIN ?? "http://localhost:3000";
    return [
      {
        // Onramp session endpoint: restrict CORS per CDP security requirements
        source: "/api/onramp/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: origin },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, x-api-secret" },
        ],
      },
      {
        // Match API: same-origin only in prod; localhost allowed in dev
        source: "/api/match",
        headers: [
          { key: "Access-Control-Allow-Origin", value: origin },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
};

export default nextConfig;
