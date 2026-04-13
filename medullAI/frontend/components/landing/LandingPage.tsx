import Link from "next/link";
import { DM_Sans, Inconsolata, Syne } from "next/font/google";
import LandingCanvas from "./LandingCanvas";
import "./landing.css";

const fontSyne = Syne({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-syne",
});

const fontDmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-sans",
});

const fontInconsolata = Inconsolata({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inconsolata",
});

export default function LandingPage() {
  return (
    <div
      id="tb-landing"
      className={`${fontSyne.variable} ${fontDmSans.variable} ${fontInconsolata.variable}`}
    >
      <LandingCanvas />
<div className="wrap">

  {/* NAV */}
  <nav>
    <div className="nav-inner">
      <Link href="/" className="logo">
        <div className="logo-mark">TB</div>
        <div>
          <div className="logo-text">TrialBridge</div>
          <div className="logo-sub">Clinical Trial Matching</div>
        </div>
      </Link>
      <div className="nav-right">
        <span className="nav-pill">Base Sepolia · x402</span>
        <Link href="/match" className="btn-nav">
          Launch App →
        </Link>
      </div>
    </div>
  </nav>

  {/* HERO */}
  <section className="hero">
    <div className="container">
      <div className="hero-inner">
        <div className="hero-badge fade-up d1">
          <span className="hero-badge-dot"></span>
          DeSci Agent Swarm · India's clinical trial infrastructure
        </div>
        <h1 className="hero-title fade-up d2">
          The right patient.<br />
          <span className="accent-word">The right trial.</span><br />
          <span className="dim-word">In seconds.</span>
        </h1>
        <p className="hero-sub fade-up d3">
          AI agents match India's 1.4B patient pool to open clinical trials — 
          <strong>autonomously, on-chain, at $0.10 per verified match</strong>. 
          No CRO middlemen. No paper consent. No 3-week turnarounds.
        </p>
        <div className="hero-actions fade-up d4">
          <Link href="/match" className="btn-primary">
            Run a Match
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <a href="#how" className="btn-ghost">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M7 5v3M7 9.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            How it works
          </a>
        </div>

        <div className="ticker fade-up d5">
          <div className="ticker-item">
            <div>
              <div className="ticker-val">&lt;5s</div>
              <div className="ticker-label">end-to-end match time</div>
            </div>
          </div>
          <div className="ticker-div"></div>
          <div className="ticker-item">
            <div>
              <div className="ticker-val">$0.10</div>
              <div className="ticker-label">per match via x402</div>
            </div>
          </div>
          <div className="ticker-div"></div>
          <div className="ticker-item">
            <div>
              <div className="ticker-val">$5</div>
              <div className="ticker-label">CRO baseline we displace</div>
            </div>
          </div>
          <div className="ticker-div"></div>
          <div className="ticker-item">
            <div>
              <div className="ticker-val">80%</div>
              <div className="ticker-label">trials miss enrollment targets</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  {/* HOW IT WORKS */}
  <section id="how">
    <div className="container">
      <div className="how-header">
        <div className="section-tag">— workflow</div>
        <h2 className="section-title">Three steps.<br />Zero middlemen.</h2>
        <p className="section-sub">
          A two-agent LangGraph swarm handles eligibility parsing, hard filtering, and LLM scoring — then writes an immutable match record on-chain.
        </p>
      </div>

      <div className="steps-wrap">
        <div className="steps">
          <div className="step">
            <div className="step-num">01</div>
            <div className="step-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="2" width="14" height="14" rx="3" stroke="var(--accent)" strokeWidth="1.4"/>
                <path d="M5 6h8M5 9h5M5 12h6" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </div>
            <h3>Pay & Submit</h3>
            <p>Pharma / CRO sends a POST request with trial JSON + patient profile. The x402 middleware gates the call — $0.10 USDC is deducted from your org wallet on Base Sepolia before any agent work starts.</p>
            <div className="step-code">POST /match → HTTP 402 → pay → retry</div>
          </div>

          <div className="step">
            <div className="step-num">02</div>
            <div className="step-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="5" cy="9" r="2.5" stroke="var(--accent)" strokeWidth="1.4"/>
                <circle cx="13" cy="5" r="2.5" stroke="var(--accent)" strokeWidth="1.4"/>
                <circle cx="13" cy="13" r="2.5" stroke="var(--accent)" strokeWidth="1.4"/>
                <path d="M7.4 8.2L10.6 6M7.4 9.8L10.6 12" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </div>
            <h3>Agent Coordination</h3>
            <p>The Patient Agent structures profile data from AIKosh. The Trial Agent parses CTRI eligibility text into structured criteria. The Coordinator runs hard filters then DeepSeek-V3 LLM scoring to produce a match decision.</p>
            <div className="step-code">LangGraph · DeepSeek-V3 · CTRI + AIKosh</div>
          </div>

          <div className="step">
            <div className="step-num">03</div>
            <div className="step-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="3" y="10" width="12" height="5" rx="1.5" stroke="var(--accent)" strokeWidth="1.4"/>
                <rect x="6" y="6" width="6" height="4" rx="1.5" stroke="var(--accent)" strokeWidth="1.4"/>
                <rect x="8" y="3" width="2" height="3" rx="1" stroke="var(--accent)" strokeWidth="1.2"/>
              </svg>
            </div>
            <h3>On-Chain Proof</h3>
            <p>TrialRegistry.sol on Base Sepolia logs a keccak256 hash of the match: patient ID, trial CTRI number, eligibility score, and timestamp. Immutable. Auditable. No middlemen can alter it.</p>
            <div className="step-code">logMatch(hash, ctri_id, score) → Base Sepolia</div>
          </div>
        </div>
      </div>

      {/* MINI ARCH */}
      <div className="arch">
        <div className="arch-label">System architecture</div>
        <div className="arch-flow">
          <div className="arch-node accent">
            <div className="arch-node-label">CRO / Pharma</div>
            <div className="arch-node-sub">x402 client</div>
          </div>
          <div className="arch-arr">→</div>
          <div className="arch-node">
            <div className="arch-node-label">Express Backbone</div>
            <div className="arch-node-sub">:4020 · x402 gate</div>
          </div>
          <div className="arch-arr">→</div>
          <div className="arch-node">
            <div className="arch-node-label">Agent API</div>
            <div className="arch-node-sub">FastAPI :8100 · LangGraph</div>
          </div>
          <div className="arch-arr">→</div>
          <div className="arch-node accent">
            <div className="arch-node-label">TrialRegistry.sol</div>
            <div className="arch-node-sub">Base Sepolia</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  {/* TECH STACK */}
  {/* <section>
    <div className="container">
      <div className="section-tag">— infrastructure</div>
      <h2 className="section-title">Built on real rails.</h2>
      <p className="section-sub">No PoC shimming. Every layer is production-grade or openly verifiable.</p>

      <div className="stack-grid">
        <div className="stack-item">
          <span className="stack-badge">AGENTS</span>
          <h4>LangGraph + DeepSeek-V3</h4>
          <p>Multi-agent graph orchestration with the best open medical reasoning model.</p>
        </div>
        <div className="stack-item">
          <span className="stack-badge">DATA</span>
          <h4>ICMR AIKosh + CTRI</h4>
          <p>Real Indian clinical datasets. 10,000+ open trial listings from India's own registry.</p>
        </div>
        <div className="stack-item">
          <span className="stack-badge">PAYMENTS</span>
          <h4>x402 Protocol</h4>
          <p>HTTP-native USDC micropayments. No subscriptions, no KYC at API level. Pay per match.</p>
        </div>
        <div className="stack-item">
          <span className="stack-badge">BLOCKCHAIN</span>
          <h4>Base Sepolia</h4>
          <p>TrialRegistry.sol stores every match and consent event as an immutable on-chain log.</p>
        </div>
        <div className="stack-item">
          <span className="stack-badge">FRONTEND</span>
          <h4>Next.js + WalletConnect</h4>
          <p>Dashboard for live match feed, pipeline logs, and on-chain tx viewer.</p>
        </div>
        <div className="stack-item">
          <span className="stack-badge">BACKEND</span>
          <h4>Node / Express + viem</h4>
          <p>x402 middleware, CDP wallet integration, agent proxy and blockchain writes.</p>
        </div>
      </div>
    </div>
  </section> */}

  {/* CTA */}
  <section className="cta-section">
    <div className="container">
      <div className="cta-card">
        <h2>Ready to match?</h2>
        <p>Submit a CTRI trial JSON + patient profile. Watch agents reason in real time. Get a match score and on-chain proof in under 5 seconds.</p>
        <div>
        <Link
          href="/match"
          className="btn-primary"
          style={{ fontSize: 16, padding: "16px 36px" }}
        >
          Open the Dashboard
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        </div>
        <div className="payment-badge">
          <span className="dot"></span>
          $0.10 USDC per match · Base Sepolia · No account required
        </div>
      </div>
      
    </div>
    
  </section>

  {/* FOOTER */}
  <footer>
    <div className="container">
      <div className="footer-inner">
        <div className="footer-left">TrialBridge · DeSci Agent Swarm · India's patient pool → global trials</div>
        <div className="footer-links">
          <a href="https://ctri.nic.in" target="_blank" rel="noopener noreferrer">
            CTRI Registry
          </a>
          <a href="https://aikosh.indiaai.gov.in" target="_blank" rel="noopener noreferrer">
            AIKosh
          </a>
          <a href="https://x402.org" target="_blank" rel="noopener noreferrer">
            x402 Protocol
          </a>
          <a
            href="https://sepolia.basescan.org/address/0x40cAD144A2Dc503FdFFcbc84aBBeb0007924fc08"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contract
          </a>
        </div>
      </div>
    </div>
  </footer>

</div>
    </div>
  );
}
