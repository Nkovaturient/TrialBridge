import { createHmac } from 'node:crypto';
import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { TRIAL_REGISTRY_ABI } from './TrialRegistryABI.js';
import { paymentMiddleware } from 'x402-express';

config();

const {
  PRIVATE_KEY,
  PATIENT_HASH_SECRET,
  PAY_TO_ADDRESS,
  TRIAL_REGISTRY_CONTRACT_ADDRESS,
  BASE_SEPOLIA_RPC = 'https://sepolia.base.org',
  AGENT_API_URL = 'http://localhost:8100',
  PORT = '4020',
} = process.env;

if (!PRIVATE_KEY)           throw new Error('PRIVATE_KEY is required');
if (!PATIENT_HASH_SECRET)  throw new Error('PATIENT_HASH_SECRET is required');
if (!PAY_TO_ADDRESS)        throw new Error('PAY_TO_ADDRESS is required');
if (!TRIAL_REGISTRY_CONTRACT_ADDRESS) throw new Error('TRIAL_REGISTRY_CONTRACT_ADDR is required');

const account = privateKeyToAccount(PRIVATE_KEY);
const transport = http(BASE_SEPOLIA_RPC);
const publicClient = createPublicClient({ chain: baseSepolia, transport });
const walletClient = createWalletClient({ account, chain: baseSepolia, transport });


/** HMAC-SHA256(secret, patient_id) as 0x-prefixed 32-byte hex*/
function hashPatientId(patientId) {
  const digest = createHmac('sha256', PATIENT_HASH_SECRET).update(patientId, 'utf8').digest();
  return `0x${digest.toString('hex')}`;
}

async function logMatchOnChain(patientId, trialId, score) {
  const patientHash = hashPatientId(patientId);
  const txHash = await walletClient.writeContract({
    address: TRIAL_REGISTRY_CONTRACT_ADDRESS,
    abi: TRIAL_REGISTRY_ABI,
    functionName: 'logMatch',
    args: [patientHash, trialId, score],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  return { txHash, blockNumber: Number(receipt.blockNumber) };
}

async function callAgent(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${AGENT_API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Agent API ${path} returned ${res.status}: ${detail}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

const app = express();

app.use(cors({ exposedHeaders: ['X-PAYMENT-RESPONSE'] }));
app.use(express.json());

// x402 gate — only POST /match requires payment
app.use(
  paymentMiddleware(
    PAY_TO_ADDRESS,
    {
      'POST /match': {
        price: '$0.10',
        network: 'base-sepolia',
        config: { description: 'Patient-trial eligibility match (TrialBridge)' },
      },
    },
    { url: 'https://facilitator.xpay.sh' },
  ),
);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/health', async (_req, res) => {
  const checks = {};

  try {
    const agentRes = await fetch(`${AGENT_API_URL}/health`, { signal: AbortSignal.timeout(5_000) });
    checks.agent = agentRes.ok ? 'ok' : 'degraded';
  } catch {
    checks.agent = 'unreachable';
  }

  try {
    const owner = await publicClient.readContract({
      address: TRIAL_REGISTRY_CONTRACT_ADDRESS,
      abi: TRIAL_REGISTRY_ABI,
      functionName: 'owner',
    });
    checks.registry = 'ok';
    checks.registryOwner = owner;
    checks.walletIsOwner = owner.toLowerCase() === account.address.toLowerCase();
  } catch {
    checks.registry = 'unreachable';
  }

  const healthy = checks.agent === 'ok' && checks.registry === 'ok';
  res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', checks });
});

/**
 * POST /match
 * Full pipeline: raw CTRI trial JSON + raw AIKosh patient JSON → LLM parse → score → on-chain log.
 * Gated by x402 ($0.10 USDC on Base Sepolia).
 *
 * Body: { raw_trial: object, raw_patient: object }
 * Response: MatchResult + { txHash, blockNumber, explorerUrl }
 */
app.post('/match', async (req, res) => {
  try {
    const { raw_trial, raw_patient } = req.body;
    if (!raw_trial || !raw_patient) {
      return res.status(400).json({ error: 'raw_trial and raw_patient are required' });
    }

    const t0 = Date.now();
    const matchResult = await callAgent('/run_match', { raw_trial, raw_patient });
    const agentMs = Date.now() - t0;

    const t1 = Date.now();
    const { txHash, blockNumber } = await logMatchOnChain(
      matchResult.patient_id,
      matchResult.trial_id,
      matchResult.score,
    );
    const chainMs = Date.now() - t1;

    res.json({
      ...matchResult,
      onChain: {
        txHash,
        blockNumber,
        explorerUrl: `https://sepolia.basescan.org/tx/${txHash}`,
      },
      pipeline: [
        { name: 'x402_payment', status: 'settled' },
        { name: 'agent_run_match', ms: agentMs },
        { name: 'onchain_logMatch', ms: chainMs, txHash },
      ],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /match_parsed
 * Direct scoring with pre-parsed TrialCriteria + PatientProfile — bypasses LLM parsing.
 * NOT gated by x402 (internal/testing use).
 *
 * Body: { trial_criteria: TrialCriteria, patient_profile: PatientProfile }
 * Response: MatchResult + { txHash, blockNumber, explorerUrl }
 */
app.post('/match_parsed', async (req, res) => {
  try {
    const { trial_criteria, patient_profile } = req.body;
    if (!trial_criteria || !patient_profile) {
      return res.status(400).json({ error: 'trial_criteria and patient_profile are required' });
    }

    const t0 = Date.now();
    const matchResult = await callAgent('/run_match_parsed', { trial_criteria, patient_profile });
    const agentMs = Date.now() - t0;

    const t1 = Date.now();
    const { txHash, blockNumber } = await logMatchOnChain(
      matchResult.patient_id,
      matchResult.trial_id,
      matchResult.score,
    );
    const chainMs = Date.now() - t1;

    res.json({
      ...matchResult,
      onChain: {
        txHash,
        blockNumber,
        explorerUrl: `https://sepolia.basescan.org/tx/${txHash}`,
      },
      pipeline: [
        { name: 'agent_run_match_parsed', ms: agentMs },
        { name: 'onchain_logMatch', ms: chainMs, txHash },
      ],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /match_count
 * Returns the total number of matches logged on-chain.
 */
app.get('/match_count', async (_req, res) => {
  try {
    const count = await publicClient.readContract({
      address: TRIAL_REGISTRY_CONTRACT_ADDRESS,
      abi: TRIAL_REGISTRY_ABI,
      functionName: 'getMatchCount',
    });
    res.json({ count: Number(count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /matches/:index
 * Returns a single match record by zero-based index from TrialRegistry.
 */
app.get('/matches/:index', async (req, res) => {
  try {
    const index = BigInt(req.params.index);
    const match = await publicClient.readContract({
      address: TRIAL_REGISTRY_CONTRACT_ADDRESS,
      abi: TRIAL_REGISTRY_ABI,
      functionName: 'getMatch',
      args: [index],
    });
    res.json({
      patientHash: match.patientHash,
      trialId:     match.trialId,
      score:       Number(match.score),
      timestamp:   Number(match.timestamp),
    });
  } catch (err) {
    const msg = err.message ?? '';
    if (msg.includes('IndexOutOfBounds') || msg.includes('reverted')) {
      return res.status(404).json({ error: `No match at index ${req.params.index}` });
    }
    res.status(500).json({ error: msg });
  }
});


app.listen(Number(PORT), async () => {
  console.log(`TrialBridge backbone listening on port ${PORT}`);
  console.log(`  Agent API : ${AGENT_API_URL}`);
  console.log(`  Registry  : ${TRIAL_REGISTRY_CONTRACT_ADDRESS} (Base Sepolia)`);
  console.log(`  Wallet    : ${account.address}`);

  try {
    const onChainOwner = await publicClient.readContract({
      address: TRIAL_REGISTRY_CONTRACT_ADDRESS,
      abi: TRIAL_REGISTRY_ABI,
      functionName: 'owner',
    });
    if (onChainOwner.toLowerCase() !== account.address.toLowerCase()) {
      console.warn(`\n  WARNING: on-chain owner is ${onChainOwner}`);
    } else {
      console.log(`  Registry owner match ✓`);
    }
  } catch {
    console.warn('  Could not verify registry owner (RPC unreachable at startup)');
  }
});
