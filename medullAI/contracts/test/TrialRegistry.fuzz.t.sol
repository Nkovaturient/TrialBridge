// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import { Test } from "forge-std/Test.sol";
import { TrialRegistry } from "../src/TrialRegistry.sol";

/// @notice Fuzz tests for TrialRegistry — exercising the full input space for
///         logMatch and getMatch with random bytes/strings/uint8 values.
contract TrialRegistryFuzzTest is Test {
    TrialRegistry public registry;

    function setUp() public {
        registry = new TrialRegistry(address(this));
    }

    // -------------------------------------------------------------------------
    // logMatch — valid scores store correctly for any hash and any trialId string
    // -------------------------------------------------------------------------

    function testFuzz_logMatch_valid_score(
        bytes32 patientHash,
        string calldata trialId,
        uint8 score
    ) public {
        vm.assume(score <= 100);

        registry.logMatch(patientHash, trialId, score);

        assertEq(registry.getMatchCount(), 1);
        TrialRegistry.Match memory m = registry.getMatch(0);
        assertEq(m.patientHash, patientHash);
        assertEq(m.trialId,     trialId);
        assertEq(m.score,       score);
        assertEq(m.timestamp,   block.timestamp);
    }

    // -------------------------------------------------------------------------
    // logMatch — any score > 100 must revert
    // -------------------------------------------------------------------------

    function testFuzz_logMatch_reverts_invalid_score(uint8 score) public {
        vm.assume(score > 100);
        vm.expectRevert(abi.encodeWithSelector(TrialRegistry.ScoreTooHigh.selector, score));
        registry.logMatch(keccak256("patient"), "TRIAL", score);
    }

    // -------------------------------------------------------------------------
    // logMatch — any non-owner caller must revert, for all inputs
    // -------------------------------------------------------------------------

    function testFuzz_logMatch_reverts_any_non_owner(
        address caller,
        bytes32 patientHash,
        string calldata trialId,
        uint8 score
    ) public {
        vm.assume(caller != address(this));
        vm.assume(score <= 100);

        vm.prank(caller);
        vm.expectRevert(TrialRegistry.Unauthorized.selector);
        registry.logMatch(patientHash, trialId, score);
    }

    // -------------------------------------------------------------------------
    // getMatch — any index >= count must revert
    // -------------------------------------------------------------------------

    function testFuzz_getMatch_reverts_oob(uint256 index) public {
        // empty array: any index is out of bounds
        uint256 count = registry.getMatchCount();
        vm.assume(index >= count);
        vm.expectRevert(
            abi.encodeWithSelector(TrialRegistry.IndexOutOfBounds.selector, index, count)
        );
        registry.getMatch(index);
    }

    function testFuzz_getMatch_reverts_oob_after_some_writes(uint8 numWrites, uint256 index) public {
        vm.assume(numWrites > 0 && numWrites <= 20);

        for (uint8 i = 0; i < numWrites; i++) {
            registry.logMatch(keccak256(abi.encode(i)), "T", i % 101);
        }

        uint256 count = registry.getMatchCount();
        vm.assume(index >= count);
        vm.expectRevert(
            abi.encodeWithSelector(TrialRegistry.IndexOutOfBounds.selector, index, count)
        );
        registry.getMatch(index);
    }

    // -------------------------------------------------------------------------
    // logConsent — any non-owner must revert
    // -------------------------------------------------------------------------

    function testFuzz_logConsent_reverts_any_non_owner(
        address caller,
        bytes32 patientHash,
        string calldata ipfsRef
    ) public {
        vm.assume(caller != address(this));
        vm.prank(caller);
        vm.expectRevert(TrialRegistry.Unauthorized.selector);
        registry.logConsent(patientHash, ipfsRef);
    }

    // -------------------------------------------------------------------------
    // transferOwnership — zero address always reverts
    // -------------------------------------------------------------------------

    function testFuzz_transferOwnership_reverts_zero(address current) public {
        vm.assume(current != address(0));
        TrialRegistry r = new TrialRegistry(current);

        vm.prank(current);
        vm.expectRevert(TrialRegistry.ZeroAddress.selector);
        r.transferOwnership(address(0));
    }

    // -------------------------------------------------------------------------
    // getMatchCount monotonically increases
    // -------------------------------------------------------------------------

    function testFuzz_count_monotonically_increases(uint8 n) public {
        vm.assume(n > 0 && n <= 50);
        for (uint8 i = 0; i < n; i++) {
            uint256 before = registry.getMatchCount();
            registry.logMatch(keccak256(abi.encode(i)), "T", i % 101);
            assertEq(registry.getMatchCount(), before + 1);
        }
        assertEq(registry.getMatchCount(), n);
    }
}
