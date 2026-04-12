# TrialBridge — Smart Contracts

![Solidity](https://img.shields.io/badge/Solidity-0.8.34-363636?logo=solidity)
![Foundry](https://img.shields.io/badge/Built%20with-Foundry-FFDB1C?logo=ethereum)
![Tests](https://img.shields.io/badge/Tests-31%20passed-brightgreen)
![Coverage](https://img.shields.io/badge/Test%20types-unit%20%7C%20fuzz%20%7C%20invariant-blue)

Append-only on-chain audit log for every patient-trial match and consent event produced by the TrialBridge agent swarm.

---

## Contract — `TrialRegistry.sol`

| Property | Value |
|---|---|
| Solidity | `0.8.34` |
| Deployment size | `4 337` bytes |
| Deployment gas | `975 649` |
| No external calls | No reentrancy surface |
| No ETH/token movement | Pure event log |
| Access control | Hand-rolled `onlyOwner` (no OZ dependency needed for one role) |

### Data model

```solidity
struct Match {
    bytes32 patientHash; // keccak256 of anonymised patient ID — no PII on-chain
    string  trialId;     // CTRI registration number e.g. "CTRI/2024/01/061234"
    uint8   score;       // Eligibility score 0-100, validated on-chain
    uint256 timestamp;   // block.timestamp at write time
}
```

### Interface

| Function | Access | Gas (avg) | Description |
|---|---|---|---|
| `logMatch(patientHash, trialId, score)` | `onlyOwner` | ~131k | Write a match record; reverts if `score > 100` |
| `logConsent(patientHash, ipfsRef)` | `onlyOwner` | ~25k | Emit consent event; IPFS CID stored off-chain |
| `getMatch(index)` | public | ~7k | Read a match record by index |
| `getMatchCount()` | public | ~2.5k | Total number of logged matches |
| `transferOwnership(newOwner)` | `onlyOwner` | ~24k | Single-step ownership transfer |

### Custom errors (gas-efficient)

```solidity
error Unauthorized();
error ScoreTooHigh(uint8 score);
error IndexOutOfBounds(uint256 index, uint256 length);
error ZeroAddress();
```

---

## Test suite

```
test/
├── TrialRegistry.t.sol           19 unit tests
├── TrialRegistry.fuzz.t.sol       8 fuzz tests   (1 000 runs each)
└── TrialRegistry.invariant.t.sol  4 invariant tests (128 runs × 32 depth = 4 096 calls each)
```

**31 / 31 pass. 0 failures.**

### Unit tests (`TrialRegistry.t.sol`)

Covers constructor state, `logMatch` happy paths, score boundaries (0 and 100), score `> 100` revert, `logConsent` event emission, `getMatch` out-of-bounds revert, `getMatchCount` increment, `transferOwnership` success + old-owner lockout + zero-address revert + unauthorized revert, and timestamp monotonicity.

### Fuzz tests (`TrialRegistry.fuzz.t.sol`)

| Test | Runs | What it proves |
|---|---|---|
| `testFuzz_logMatch_valid_score` | 1 000 | Any `score ∈ [0,100]` stores correctly |
| `testFuzz_logMatch_reverts_invalid_score` | 1 000 | Any `score > 100` always reverts |
| `testFuzz_logMatch_reverts_any_non_owner` | 1 000 | Arbitrary callers are always rejected |
| `testFuzz_logConsent_reverts_any_non_owner` | 1 000 | Same for consent writes |
| `testFuzz_getMatch_reverts_oob` | 1 000 | OOB on empty array always reverts |
| `testFuzz_getMatch_reverts_oob_after_some_writes` | 1 000 | OOB after N writes always reverts |
| `testFuzz_count_monotonically_increases` | 1 000 | Count never decreases after N writes |
| `testFuzz_transferOwnership_reverts_zero` | 1 000 | Zero address always reverts |

### Invariant tests (`TrialRegistry.invariant.t.sol`)

A `TrialRegistryHandler` acts as owner and exposes two callable actions to the fuzzer: `logMatchValid` (score bounded to `[0,100]`) and `warpForward` (advances `block.timestamp`).

| Invariant | What it proves |
|---|---|
| `invariant_matchCount_equals_handlerCount` | `getMatchCount()` always equals the handler's shadow counter — no phantom records |
| `invariant_last_stored_score_valid` | The most-recently stored `score` is always `≤ 100` |
| `invariant_timestamps_non_decreasing_at_tail` | Last two stored timestamps are always non-decreasing |
| `invariant_owner_is_handler` | `owner` is never changed by any sequence of fuzzer-generated calls |

---

## Getting started

### Prerequisites

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Build

```bash
forge build
```

### Run all tests

```bash
forge test -vvv
```

### Run by suite

```bash
# Unit only
forge test --match-path "test/TrialRegistry.t.sol" -vvv

# Fuzz only
forge test --match-path "test/TrialRegistry.fuzz.t.sol" -vvv

# Invariant only
forge test --match-path "test/TrialRegistry.invariant.t.sol" -vvv
```

### Gas report

```bash
forge test --gas-report
```

---

## Deployment

The contract owner is the **backend server wallet** — the same address that calls `logMatch` / `logConsent` from the Node.js API. Set it in `.env` before deploying.

### Environment

```bash
# .env  (never commit)
PRIVATE_KEY=0x...          # deployer wallet (broadcasts the tx)
INITIAL_OWNER=0x...        # TrialRegistry owner (often same as server wallet or a Safe)
GUARDIAN=0x...             # optional — address(0) if omitted; may emergency-pause with owner
BASE_SEPOLIA_RPC=https://sepolia.base.org
BASE_MAINNET_RPC=https://mainnet.base.org
BASESCAN_API_KEY=...       # for --verify on Base
```

### Network strategy

| Stage | Network | Purpose |
|---|---|---|
| Development | Anvil (local) | Instant feedback, no faucet needed |
| x402 payment demo | **Base Sepolia** | x402 middleware runs on Base; keep payment rail and audit log on same L2 for demo simplicity |
| Audit log testnet | **Polygon Amoy** | Low-cost MATIC, matches production Polygon stack; use when demoing audit log in isolation |
| Production | **Polygon PoS mainnet** | Finality, MATIC cost ~$0.001/tx, widely supported by explorer tooling |

> The two testnets serve different concerns: **Base Sepolia** is where the x402 payment middleware lives (`network: "base-sepolia"`). **Polygon Amoy** is the audit log testnet. In production both collapse into one decision — Polygon PoS mainnet for the audit log, Base mainnet for x402 payments.

---

### 1 — Dry-run on Anvil (local)

```bash
# Terminal 1
anvil

# Terminal 2
forge script script/Deploy.s.sol:DeployTrialRegistry \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  -vvvv
```

Expected output:
```
TrialRegistry deployed at: 0x...
Owner: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

---

### 2 — Deploy to Base Sepolia (x402 demo)

Get testnet ETH from [faucet.quicknode.com](https://faucet.quicknode.com/base/sepolia).

```bash
forge script script/Deploy.s.sol:DeployTrialRegistry \
  --rpc-url $BASE_SEPOLIA_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  -vvvv
```

Explorer: [sepolia.basescan.org](https://sepolia.basescan.org)

---

### 3 — Deploy to Polygon Amoy (audit log testnet)

Get testnet MATIC from [faucet.polygon.technology](https://faucet.polygon.technology).

```bash
forge script script/Deploy.s.sol:DeployTrialRegistry \
  --rpc-url $POLYGON_AMOY_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $POLYGONSCAN_API_KEY \
  -vvvv
```

Explorer: [amoy.polygonscan.com](https://amoy.polygonscan.com)

---

### 4 — Deploy to Polygon Mainnet (production)

```bash
forge script script/Deploy.s.sol:DeployTrialRegistry \
  --rpc-url $POLYGON_MAINNET_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $POLYGONSCAN_API_KEY \
  -vvvv
```

Explorer: [polygonscan.com](https://polygonscan.com)

---

### Post-deploy: smoke-test with `cast`

```bash
# Replace with your deployed address and RPC
REGISTRY=0x40cAD144A2Dc503FdFFcbc84aBBeb0007924fc08 #base-sepolia deployed addr
RPC=https://sepolia.base.org

# Verify owner
cast call $REGISTRY "owner()(address)" --rpc-url $RPC

# Log a match (owner wallet required)
cast send $REGISTRY \
  "logMatch(bytes32,string,uint8)" \
  $(cast keccak "PID_anon_001") \
  "CTRI/2024/01/061234" \
  75 \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC

# Read it back
cast call $REGISTRY "getMatchCount()(uint256)" --rpc-url $RPC
cast call $REGISTRY "getMatch(uint256)((bytes32,string,uint8,uint256))" 0 --rpc-url $RPC
```

## Deployed TrialRegistry Contract

| Network | Address | Explorer |
|---|---|---|
| Base Sepolia | `0x40cAD144A2Dc503FdFFcbc84aBBeb0007924fc08` | [basescan](https://sepolia.basescan.org/address/0x40cAD144A2Dc503FdFFcbc84aBBeb0007924fc08) |
| Polygon Amoy | `0x96EE446A832b7AdcF598C4B2340131f622677c25` | [polygonscan](https://amoy.polygonscan.com/address/0x96EE446A832b7AdcF598C4B2340131f622677c25) |

The backbone server (`backbone/index.js`) writes to **Base Sepolia** only. Polygon Amoy is kept as a fallback.

---

<!-- ## Ownership — backbone integration

The backbone wallet must be the contract `owner` to call `logMatch`. To transfer ownership to the backbone's server wallet:

```bash
# Run with the current owner's private key
cast send 0x40cAD144A2Dc503FdFFcbc84aBBeb0007924fc08 \
  "transferOwnership(address)" \
  <BACKBONE_WALLET_ADDRESS> \
  --private-key <CURRENT_OWNER_PRIVATE_KEY> \
  --rpc-url https://sepolia.base.org
```

Verify the transfer:

```bash
cast call 0x40cAD144A2Dc503FdFFcbc84aBBeb0007924fc08 \
  "owner()(address)" \
  --rpc-url https://sepolia.base.org
``` -->