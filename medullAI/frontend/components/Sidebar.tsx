"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    href: "/match",
    label: "Run Match",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/quality",
    label: "Quality",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1L2 4v4c0 4.42 3.58 8 8 8s8-3.58 8-8V4l-6-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: "/evaluation",
    label: "Evaluation",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M2 6h12M6 2v12" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: "/activity",
    label: "Activity",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 8h2l2-4 3 8 2-4 1 2h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/funding",
    label: "Funding",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="4" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M1 7h14" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="w-16 sm:w-56 shrink-0 flex flex-col border-r" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      {/* Logo */}
      <div className="px-3 sm:px-5 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-center sm:justify-start gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background: "var(--accent)", color: "var(--background)" }}
          >
            TB
          </div>
          <div className="hidden sm:block">
            <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
              TrialBridge
            </span>
          </div>
        </div>
        <p className="hidden sm:block text-xs mt-1.5 leading-tight" style={{ color: "var(--text-secondary)" }}>
          Clinical Trial Matching
        </p>
      </div>

      {/* Network badge */}
      <div className="px-3 sm:px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-center sm:justify-start gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: "var(--success)" }} />
          <span className="hidden sm:inline text-xs" style={{ color: "var(--text-secondary)" }}>
            Base Sepolia · x402
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map((item) => {
          const active = path === item.href || path.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-center sm:justify-start gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: active ? "var(--accent-dim)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-secondary)",
                border: active ? "1px solid var(--accent-border)" : "1px solid transparent",
              }}
            >
              {item.icon}
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="hidden sm:block px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
        <p className="text-xs leading-snug" style={{ color: "var(--text-secondary)" }}>
          Payments via{" "}
          <span style={{ color: "var(--accent)" }}>x402</span> + CDP Server Wallet
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Logs on Base Sepolia
        </p>
      </div>
    </aside>
  );
}
