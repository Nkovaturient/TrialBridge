# 🧬 TrialBridge — DeSci Agent Swarm for Clinical Trial Matching

> **"India's patients. AI matching. Blockchain proof. 10x faster clinical trials."**

<img width="1785" height="964" alt="banner-TB (1)" src="https://github.com/user-attachments/assets/6680947c-dd22-4aa4-aba0-d4870617ec5f" />


> Autonomous matching. On-chain proof. Zero middlemen.

- the LangGraph agent coordination, decentralized audit log, and the x402 pay-per-use model displacing CRO intermediaries.
- The "Bridge" metaphor captures : connectivity between patients and trials, between India's underserved population and global research, and between off-chain matching logic and on-chain proof.
---

## 🔴 The Problem

**$50B lost annually** to patient-trial mismatch. Clinical trials fail not because science is bad — but because finding the right patient takes 3+ weeks manually, costs ~$5 per match through CROs, and excludes India's 1.4B diverse population almost entirely.

- **80%** of clinical trials fail to meet enrollment timelines
- **India** is underrepresented despite being the world's largest patient pool for diverse genomics
- **Consent** is a paper-based, opaque process with no auditability
- **Coordinators** (trial sponsors, pharma) pay middlemen to recruit — no direct patient incentive

---

## ✅ The Solution

**TrialBridge** is a 2-agent AI coordination system that:
1. Matches patient profiles (from real Indian public health data) to open clinical trials using LLM-powered eligibility reasoning
2. Logs every match and consent event on blockchain for immutable audit
3. Uses **x402 micropayments** so the **matching service itself is pay-per-use** — pharma/CROs pay USDC per verified match via HTTP-native payment protocol, not a subscription

**This is infrastructure for DeSci, not a patient-facing app.**

---

## 🏗️ Architecture Workflow

```
┌─────────────────────────────────────────────────────┐
│                   Next.js Dashboard                 │
│          (Match feed + on-chain proof viewer)        │
└────────────────────┬────────────────────────────────┘
                     │ HTTP
        ┌────────────▼────────────┐
        │   Backbone (Express)    │  x402 on Base Sepolia:
        │   backbone/index.js     │  POST /match → $0.10 USDC;
        │                         │  POST /batch_match_parsed → $2.00 USDC
        └────┬────────────────┬───┘
             │ proxy to agents │ logMatch() (single match only)
   ┌─────────▼──────────┐  ┌──────▼──────────────────┐
   │  Agent Layer        │  │  TrialRegistry.sol       │
   │  (FastAPI :8100)    │  │  Base Sepolia            │
   │                     │  │  0x40cAD144...924fc08    │
   │  Patient Agent      │  │  - logMatch(hash,id,score│
   │  Trial Agent        │  │  - logConsent(hash, ipfs)│
   │  Coordinator        │  │  - getMatch(index)       │
   │  (LangGraph +       │  │  - getMatchCount()       │
   │   DeepSeek)         │  └──────────────────────────┘
   └─────────────────────┘
```

---

## 🗂️ Data Sources

### India — AIKosh (https://aikosh.indiaai.gov.in)
| Dataset | Source | Use |
|---|---|---|
| Oral Cancer Clinical Dataset | ICMR | Disease profile matching |
| Aadhaar demographic data | UIDAI via INDIAAI | Age/geography eligibility |
| National Health datasets (20 sectors) | Various Ministries | Comorbidity features |

> **AIKosh is a Government of India platform** with 10,234+ datasets across 20 sectors including Healthcare (sector 203). ICMR datasets are real clinical data. Registration is free. You use these for **offline agent training/testing** — not live PII transfers.

### Trial Registry
| Source | What |
|---|---|
| CTRI (Clinical Trials Registry India) | ctri.nic.in — public, scrapeable, real open trials |
| ClinicalTrials.gov | US-based, JSON API, free |

> Use **CTRI** — this is the Indian government's own registry. It gives you 10,000+ real trial listings with eligibility criteria. DeepSeek parses eligibility text → structured JSON.

---

## 💳 x402 Payments — How the Business Model Works

**x402** (launched by Coinbase + Cloudflare, Sept 2025) is an HTTP-native payment protocol. A server returns `HTTP 402 Payment Required` with a USDC amount + wallet address. The client agent pays and retries. No subscriptions, no accounts.

### Who Pays Whom

```
PAYER:  Pharma company / CRO / researcher  ──────► pays USDC per match request
                                                     via x402 HTTP 402 response
RECEIVER: Your TrialBridge API endpoint
AMOUNT: **$0.10** per single match, **$2.00** per batch patient rank (dashboard CSV flow); compare to ~$5 CRO baseline per manual lead

PATIENT: Does NOT receive direct payment in MVP.
         In v2: patient consent = on-chain event → future token reward
         (this is legally complex — defer it entirely from 7-day build)
```

### Why x402 Fits Here Perfectly
- Your matching endpoint is literally an **API** — x402 was built for API monetisation
- Trial sponsors already pay per-lead to CROs — this is the same model, autonomous
- Every payment = on-chain proof of demand = real traction metric for investors
- No KYC/AML complexity at demo stage (we're B2B, not B2C patient payments)

> Both x402 payments and TrialRegistry audit logging run on **Base Sepolia**.

---

## 📋  Diagram Flow (How CROs would pay?)

```
 CRO User (Browser)
       │
       ▼
 Next.js Frontend (:3000)
  ├── /match            → Single JSON match + batch CSV rank UI
  ├── /api/match        → x402 POST /match ($0.10) → agents
  ├── /api/ingest_csv   → agents /ingest_patients_csv (no x402 on agents)
  ├── /api/batch_match  → x402 POST /batch_match_parsed ($2) → agents
  │    └── Payment receipt: tx hash + BaseScan link when settled
  │
  └── /dashboard        → History, balance, analytics
       │
       ▼
 Backbone Express (:4020)
  ├── x402 middleware validates payment (per route amount)
  ├── POST /match → Agent /run_match (or parsed path) + logMatch() on registry
  ├── POST /batch_match_parsed → Agent /batch_match_parsed (ranked list; no per-row logMatch)
  └── Returns JSON + pipeline timings + X-PAYMENT-RESPONSE
```


<!-- **Drop entirely from 7-day scope:**
- ❌ Akash GPU deployment (use Vercel/Railway)
- ❌ Chainlink oracles (overkill for MVP)
- ❌ ZK proofs (say "v2 roadmap")
- ❌ Patient USDC payments (legally complex, defer)
- ❌ China AI infra claims (see below)
- ❌ Llama3.1 edge deployment -->

---

## 🔐 On Cross-Border Health Data (India ↔ China) — Factual Answer

### India Side (DPDP Act 2023 + Rules 2025)
- India uses a **"negative list" (blacklist) model** for cross-border data transfers — transfers are permitted by default unless a country is specifically restricted by the Central Government
- As of March 2026, **no official blacklist has been published** — the MEITY white paper (Nov 2024) proposed a Green/Amber/Red tier model; formal rules expected in 2025 Q3 but delayed
- **Health data falls under "sensitive personal data"** requiring explicit, granular consent from the data principal before transfer
- **CTRI trial data** (what you use) is already **publicly available** — no transfer issue
- **AIKosh datasets** — you download and use locally for training/testing. No live PII leaves India in your architecture

### China Side (PIPL + CAC Regulations, effective Jan 2026)
- China's **Personal Information Protection Law (PIPL)** and new **Certification Measures** (effective 1 Jan 2026) create a three-pathway compliance framework for cross-border transfers
- Health data is classified as **sensitive personal information (SPI)** — any transfer of SPI for 10,000+ individuals requires a **CAC Security Assessment** (government-filed, 3-year validity)
- The **National Medical Products Administration (NMPA)** controls what counts as "Important Data" in life sciences — such data may be entirely prohibited from export
- Practically: **a solo developer cannot legally transfer live Chinese patient health data across borders** — the compliance pathway requires corporate registration, government assessment, and months of process

### Honest Answer

> *"We deliberately scoped the MVP to avoid this problem. Our matching agents use AIKosh's publicly available Indian health datasets — downloaded locally, no live cross-border PII transfer — and CTRI's public trial registry. Patient data never leaves its source jurisdiction. China's role in our architecture is DeepSeek's open-source model weights, which we run via API — model inference, not data transfer. When we scale to live patient enrollment, we will need formal DPDP consent flows on the India side and PIPL SPI compliance on the China side. We've designed the consent logging layer on to support that audit trail in v2. We know where the legal walls are — our MVP deliberately stays on the right side of them."*

---

## 🛠️ Tech Stack

```
Layer          | Tool                        | Why
─────────────────────────────────────────────────────────────
Agents         | LangGraph + DeepSeek API    | Multi-agent graph, best open reasoning model
LLM            | DeepSeek-V3 (API)           | Superior medical text parsing, cheap
Data           | AIKosh (ICMR) + CTRI.nic.in | Real Indian clinical data, public domain
Payments       | x402 + USDC (Base Sepolia)  | HTTP-native, agent-to-agent commerce
Blockchain     | Base Sepolia testnet         | Match + consent audit log
Smart Contract | Solidity + Foundry           | TrialRegistry.sol 
Frontend       | Next.js + WalletConnect      | Vercel deploy
Backend        | Node.js / Express            | x402 middleware + viem + agent proxy
Storage        | IPFS (via nft.storage)       | Consent document hash (optional, Day 7)
```

---


## 📊 To-achieve Demo Metrics

| Metric | Honest Claim | How to Back It |
|---|---|---|
| Match speed | `< 5s end-to-end` | Time your actual demo |
| Cost per match | `< $0.50 via x402` | DeepSeek API cost + gas |
| Baseline | `vs $5 CRO manual quote` | Cite published CRO pricing |
| Dataset | `ICMR oral cancer + CTRI trials — real data` | Link AIKosh + CTRI |
| Accuracy | Do NOT claim a % | Say: "Qualitative — 5 live demo matches, judge for yourself" |

---

## 🚫 Challenges & Limitations

| Challenge | Reality |
|---|---|
| **No live patient enrollment** | MVP uses static/anonymised dataset profiles — not real patient sign-ups |
| **Regulatory compliance** | DPDP consent flows and PIPL SPI compliance are v2 work, not in MVP |
| **x402 KYC/AML** | Protocol has regulatory ambiguity — B2B demo only, not live patient payments |
| **China AI infra** | DeepSeek model via API only — no Huawei Ascend, no Baidu Ernie |
| **Match accuracy** | Depends on CTRI eligibility text quality — highly variable, often unstructured |


---

## 📁 Repo Structure

```
TrialBridge/
├── medullAI/
│   ├── agents/                # FastAPI :8100 — see medullAI/agents/README.md
│   ├── backbone/              # Express :4020 — x402 + agent proxy
│   ├── contracts/             # TrialRegistry.sol (Foundry)
│   └── frontend/              # Next.js — see medullAI/frontend/README.md
└── README.md
```

---

## 🔗 Key References

- AIKosh Health Datasets: https://aikosh.indiaai.gov.in/home/datasets/203
- CTRI Public Registry: https://ctri.nic.in
- x402 Protocol: https://x402.org
- x402 npm package: `npm install x402-express`
- DeepSeek API: https://platform.deepseek.com
- Base Sepolia Explorer: https://sepolia.basescan.org
- TrialRegistry (Base Sepolia): https://sepolia.basescan.org/address/0x40cAD144A2Dc503FdFFcbc84aBBeb0007924fc08
- India DPDP Act 2023 + Rules 2025: https://meity.gov.in/dpdp
