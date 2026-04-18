# TrialBridge — CRO / pharma dashboard

CRO / pharma-facing dashboard: submit trial + patient data, run batch matching, and review a full **data-quality report** — deduplication, per-field missingness, imputation lineage, visit context, and a DM query workflow.

**Data posture:** Intended for **de-identified or synthetic** cohorts in pilots. Align production use with India's **DPDP Act 2023**.

---

## Pages

| Route | Description |
|-------|-------------|
| `/match` | Single and batch eligibility matching. CSV upload → ingest → rank. |
| `/quality` | EDC upload → async ingest job (polls `/api/ingest_jobs/:id`) → upload summary, deduplication, per-field missingness table, cohort completeness, quality flags. |
| `/queries` | DM query queue — raise / answer / close / void queries against subject + field + visit. |
| `/evaluation` | Benchmark results from `ground_truth.jsonl`. |
| `/activity` | Backbone health + optional x402 payment surface. |
| `/funding` | Only when `NEXT_PUBLIC_PAYMENT_MODE=x402`. |

## Route handlers

| Path | Proxies to |
|------|-----------|
| `POST /api/ingest_csv` | `/ingest_patients_csv` (synchronous, 10 min timeout) |
| `POST /api/ingest_async` | `/ingest_async` (returns `job_id`) |
| `GET /api/ingest_jobs/[id]` | `/ingest_jobs/:id` (poll) |
| `GET/POST /api/queries` | `/queries` CRUD |
| `POST /api/queries/[id]` | `/queries/:id/{answer,close,void}` |
| `POST /api/match` | Backbone `/match` |
| `POST /api/batch_match` | Backbone `/batch_match_parsed` |

**Expected ingest latency:** ~10–15 s per 10 rows (LLM-bound). The quality page uses the async endpoint and polls every 3 s.

**Core principle:** integration secrets belong only in Next.js Route Handlers. The browser never receives private keys or server-only API secrets.
---

## Environment variables

Copy **`.env.example`** to `.env.local` and fill values.

**Default (standard mode):**

- `NEXT_PUBLIC_PAYMENT_MODE=standard` — CRO-safe UI (no payment surface).
- `BACKBONE_URL` — Express backbone base URL (default `http://127.0.0.1:4020`).
- `AGENT_API_URL` — Optional remote agents URL if documented for your deploy.
- `ALLOWED_ORIGIN` — CORS origin for `/api/*` (default `http://localhost:3000`).
- `NEXT_PUBLIC_BACKBONE_URL` — Optional; Activity page may call the backbone from the browser.

**Optional: x402 mode** (must match backbone `PAYMENT_MODE=x402`):

- `NEXT_PUBLIC_PAYMENT_MODE=x402`
- `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`, `CDP_PROJECT_ID`
- `MATCH_API_SECRET` — Optional guard for `POST /api/onramp/session`

`TrialRegistry` and backbone **`PRIVATE_KEY`** live in **`medullAI/backbone/.env`**, not here — the Next app talks to the backbone over HTTP.

---

## Local development

1. **Agents** (port `8100`) and **backbone** (port `4020`) must be running with valid `.env` files (`PAYMENT_MODE=standard` is fine for local demos).
2. Start the dashboard:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (redirects to `/match`).

```bash
npm run build
```

---

## Official references

- India DPDP Act 2023 (MeitY): https://meity.gov.in/dpdp
- [Coinbase CDP docs](https://docs.cdp.coinbase.com/) (x402 / Server Wallet — advanced)
