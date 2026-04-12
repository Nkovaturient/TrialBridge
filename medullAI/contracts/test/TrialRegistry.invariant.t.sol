// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {Test, StdInvariant} from "forge-std/Test.sol";
import {TrialRegistry} from "../src/TrialRegistry.sol";

/// @notice Handler that the invariant fuzzer calls. Tracks its own counters so
///         invariants can compare against the contract's on-chain state.
contract TrialRegistryHandler is Test {
    TrialRegistry public registry;

    // shadow counter — must always equal registry.getMatchCount()
    uint256 public handlerLogCount;

    // tracks the last two timestamps written to detect regression
    uint256 public prevTimestamp;
    uint256 public lastTimestamp;

    // score of the most-recently written match
    uint8 public lastScore;

    constructor(TrialRegistry _registry) {
        registry = _registry;
        prevTimestamp = block.timestamp;
        lastTimestamp = block.timestamp;
    }

    /// @notice Log a valid match. The fuzzer may call this with any inputs;
    ///         we bound score to [0,100] so only valid writes ever reach the contract.
    function logMatchValid(bytes32 patientHash, string calldata trialId, uint8 score) external {
        vm.assume(patientHash != bytes32(0));
        uint256 tidLen = bytes(trialId).length;
        vm.assume(tidLen > 0 && tidLen <= registry.MAX_TRIAL_ID_LENGTH());

        score = uint8(bound(uint256(score), 0, 100));

        prevTimestamp = lastTimestamp;
        lastTimestamp = block.timestamp;
        lastScore = score;

        registry.logMatch(patientHash, trialId, score);
        handlerLogCount++;
    }

    /// @notice Advance time so the fuzzer can explore non-zero timestamp deltas.
    function warpForward(uint32 delta) external {
        vm.warp(block.timestamp + bound(delta, 1, 3600));
    }
}

/// @notice Invariant suite for TrialRegistry.
///
/// Invariant 1  matchCount_equals_handlerCount
///   getMatchCount() must always equal the handler's shadow counter.
///
/// Invariant 2  last_stored_score_valid
///   The most-recently stored match has score <= 100.
///   (Full array iteration is avoided to keep invariant checks O(1).)
///
/// Invariant 3  timestamps_non_decreasing_at_tail
///   The last two stored timestamps satisfy lastTimestamp >= prevTimestamp.
///   Combined with Invariant 1 this gives confidence across the whole sequence.
///
/// Invariant 4  owner_unchanged
///   Ownership must remain with the handler throughout the run.
contract TrialRegistryInvariantTest is StdInvariant, Test {
    TrialRegistry public registry;
    TrialRegistryHandler public handler;

    function setUp() public {
        registry = new TrialRegistry(address(this), address(0));
        handler = new TrialRegistryHandler(registry);

        registry.transferOwnership(address(handler));
        vm.prank(address(handler));
        registry.acceptOwnership();

        // Restrict the fuzzer to the handler only
        targetContract(address(handler));
    }

    // -------------------------------------------------------------------------
    // Invariant 1: getMatchCount() == handler shadow counter
    // -------------------------------------------------------------------------

    function invariant_matchCount_equals_handlerCount() public view {
        assertEq(registry.getMatchCount(), handler.handlerLogCount(), "MatchCount drifted from handler counter");
    }

    // -------------------------------------------------------------------------
    // Invariant 2: last stored score is valid (O(1) — no iteration)
    // -------------------------------------------------------------------------

    function invariant_last_stored_score_valid() public view {
        uint256 count = registry.getMatchCount();
        if (count == 0) return;

        TrialRegistry.Match memory m = registry.getMatch(count - 1);
        assertLe(m.score, 100, "Last stored score exceeds 100");

        // also verify it matches the handler's cached lastScore
        assertEq(m.score, handler.lastScore(), "Last stored score mismatch with handler cache");
    }

    // -------------------------------------------------------------------------
    // Invariant 3: timestamps non-decreasing at the tail (O(1))
    // -------------------------------------------------------------------------

    function invariant_timestamps_non_decreasing_at_tail() public view {
        uint256 count = registry.getMatchCount();
        if (count < 2) return;

        TrialRegistry.Match memory last = registry.getMatch(count - 1);
        TrialRegistry.Match memory prev = registry.getMatch(count - 2);

        assertGe(last.timestamp, prev.timestamp, "Timestamp decreased between last two matches");
    }

    // -------------------------------------------------------------------------
    // Invariant 4: owner is always the handler
    // -------------------------------------------------------------------------

    function invariant_owner_is_handler() public view {
        assertEq(registry.owner(), address(handler), "Owner was changed unexpectedly");
    }
}
