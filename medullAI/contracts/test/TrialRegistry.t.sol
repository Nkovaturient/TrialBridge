// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {Test} from "forge-std/Test.sol";
import {TrialRegistry} from "../src/TrialRegistry.sol";

contract TrialRegistryTest is Test {
    TrialRegistry public registry;

    address internal owner = address(this);
    address internal notOwner = makeAddr("notOwner");
    address internal newOwner = makeAddr("newOwner");
    address internal guardianAddr = makeAddr("guardian");

    bytes32 internal constant PATIENT_HASH = keccak256("PID_anon_001");
    string internal constant TRIAL_ID = "CTRI/2024/01/061234";
    string internal constant IPFS_REF = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

    function setUp() public {
        registry = new TrialRegistry(owner, address(0));
    }

    // -------------------------------------------------------------------------
    // Constructor / initial state
    // -------------------------------------------------------------------------

    function test_owner_is_initial_owner() public view {
        assertEq(registry.owner(), owner);
    }

    function test_constructor_reverts_zero_initial_owner() public {
        vm.expectRevert(TrialRegistry.ZeroAddress.selector);
        new TrialRegistry(address(0), address(0));
    }

    function test_constructor_sets_guardian() public {
        TrialRegistry g = new TrialRegistry(owner, guardianAddr);
        assertEq(g.guardian(), guardianAddr);
    }

    function test_initial_match_count_is_zero() public view {
        assertEq(registry.getMatchCount(), 0);
    }

    function test_initial_consent_count_is_zero() public view {
        assertEq(registry.getConsentCount(), 0);
    }

    function test_VERSION() public view {
        assertEq(registry.VERSION(), "2.0.0");
    }

    // -------------------------------------------------------------------------
    // Batch getters
    // -------------------------------------------------------------------------

    function test_getMatchBatch_empty_when_offset_oob() public view {
        TrialRegistry.Match[] memory page = registry.getMatchBatch(0, 10);
        assertEq(page.length, 0);
    }

    function test_getMatchBatch_pages() public {
        registry.logMatch(PATIENT_HASH, TRIAL_ID, 10);
        registry.logMatch(keccak256("b"), "CTRI/2024/02/02", 20);
        registry.logMatch(keccak256("c"), "CTRI/2024/02/03", 30);

        TrialRegistry.Match[] memory p0 = registry.getMatchBatch(0, 2);
        assertEq(p0.length, 2);
        assertEq(p0[0].score, 10);
        assertEq(p0[1].score, 20);

        TrialRegistry.Match[] memory p1 = registry.getMatchBatch(2, 5);
        assertEq(p1.length, 1);
        assertEq(p1[0].score, 30);

        TrialRegistry.Match[] memory p2 = registry.getMatchBatch(3, 1);
        assertEq(p2.length, 0);
    }

    function test_getConsentBatch_pages() public {
        registry.logConsent(PATIENT_HASH, IPFS_REF);
        registry.logConsent(keccak256("x"), "bafysecond");

        TrialRegistry.Consent[] memory p0 = registry.getConsentBatch(0, 1);
        assertEq(p0.length, 1);
        assertEq(p0[0].ipfsRef, IPFS_REF);

        TrialRegistry.Consent[] memory p1 = registry.getConsentBatch(1, 10);
        assertEq(p1.length, 1);
        assertEq(p1[0].ipfsRef, "bafysecond");
    }

    // -------------------------------------------------------------------------
    // logMatch — happy paths
    // -------------------------------------------------------------------------

    function test_logMatch_stores_and_emits() public {
        vm.expectEmit(true, false, false, true, address(registry));
        emit TrialRegistry.MatchLogged(PATIENT_HASH, TRIAL_ID, 75, block.timestamp);

        registry.logMatch(PATIENT_HASH, TRIAL_ID, 75);

        TrialRegistry.Match memory m = registry.getMatch(0);
        assertEq(m.patientHash, PATIENT_HASH);
        assertEq(m.trialId, TRIAL_ID);
        assertEq(m.score, 75);
        assertEq(m.timestamp, block.timestamp);
    }

    function test_logMatch_score_boundary_zero() public {
        registry.logMatch(PATIENT_HASH, TRIAL_ID, 0);
        assertEq(registry.getMatch(0).score, 0);
    }

    function test_logMatch_score_boundary_100() public {
        registry.logMatch(PATIENT_HASH, TRIAL_ID, 100);
        assertEq(registry.getMatch(0).score, 100);
    }

    function test_logMatch_reverts_zero_patient_hash() public {
        vm.expectRevert(TrialRegistry.ZeroPatientHash.selector);
        registry.logMatch(bytes32(0), TRIAL_ID, 50);
    }

    function test_logConsent_reverts_zero_patient_hash() public {
        vm.expectRevert(TrialRegistry.ZeroPatientHash.selector);
        registry.logConsent(bytes32(0), IPFS_REF);
    }

    function test_logMatch_reverts_empty_trial_id() public {
        vm.expectRevert(TrialRegistry.EmptyTrialId.selector);
        registry.logMatch(PATIENT_HASH, "", 50);
    }

    function test_logMatch_reverts_trial_id_too_long() public {
        bytes memory b65 = new bytes(65);
        for (uint256 i; i < 65; i++) {
            b65[i] = "x";
        }
        vm.expectRevert(TrialRegistry.TrialIdTooLong.selector);
        registry.logMatch(PATIENT_HASH, string(b65), 50);
    }

    // -------------------------------------------------------------------------
    // logMatch — reverts
    // -------------------------------------------------------------------------

    function test_logMatch_reverts_score_above_100() public {
        vm.expectRevert(abi.encodeWithSelector(TrialRegistry.ScoreTooHigh.selector, 101));
        registry.logMatch(PATIENT_HASH, TRIAL_ID, 101);
    }

    function test_logMatch_reverts_unauthorized() public {
        vm.prank(notOwner);
        vm.expectRevert(TrialRegistry.Unauthorized.selector);
        registry.logMatch(PATIENT_HASH, TRIAL_ID, 50);
    }

    // -------------------------------------------------------------------------
    // logConsent — storage + revert
    // -------------------------------------------------------------------------

    function test_logConsent_stores_and_emits() public {
        vm.expectEmit(true, false, false, true, address(registry));
        emit TrialRegistry.ConsentLogged(PATIENT_HASH, IPFS_REF, block.timestamp);

        registry.logConsent(PATIENT_HASH, IPFS_REF);

        assertEq(registry.getConsentCount(), 1);
        TrialRegistry.Consent memory c = registry.getConsent(0);
        assertEq(c.patientHash, PATIENT_HASH);
        assertEq(c.ipfsRef, IPFS_REF);
        assertEq(c.timestamp, block.timestamp);
    }

    function test_logConsent_reverts_empty_ipfs() public {
        vm.expectRevert(TrialRegistry.EmptyIpfsRef.selector);
        registry.logConsent(PATIENT_HASH, "");
    }

    function test_logConsent_reverts_ipfs_too_long() public {
        bytes memory b = new bytes(129);
        for (uint256 i; i < 129; i++) {
            b[i] = "y";
        }
        vm.expectRevert(TrialRegistry.IpfsRefTooLong.selector);
        registry.logConsent(PATIENT_HASH, string(b));
    }

    function test_logConsent_reverts_unauthorized() public {
        vm.prank(notOwner);
        vm.expectRevert(TrialRegistry.Unauthorized.selector);
        registry.logConsent(PATIENT_HASH, IPFS_REF);
    }

    function test_getConsent_reverts_oob() public {
        vm.expectRevert(abi.encodeWithSelector(TrialRegistry.IndexOutOfBounds.selector, 0, 0));
        registry.getConsent(0);
    }

    // -------------------------------------------------------------------------
    // getMatch / getMatchCount
    // -------------------------------------------------------------------------

    function test_getMatch_reverts_out_of_bounds_empty() public {
        vm.expectRevert(abi.encodeWithSelector(TrialRegistry.IndexOutOfBounds.selector, 0, 0));
        registry.getMatch(0);
    }

    function test_getMatch_reverts_out_of_bounds_non_empty() public {
        registry.logMatch(PATIENT_HASH, TRIAL_ID, 50);
        vm.expectRevert(abi.encodeWithSelector(TrialRegistry.IndexOutOfBounds.selector, 1, 1));
        registry.getMatch(1);
    }

    function test_getMatchCount_increments() public {
        assertEq(registry.getMatchCount(), 0);
        registry.logMatch(PATIENT_HASH, TRIAL_ID, 10);
        assertEq(registry.getMatchCount(), 1);
        registry.logMatch(keccak256("PID_anon_002"), "CTRI/2024/03/075891", 85);
        assertEq(registry.getMatchCount(), 2);
        registry.logMatch(keccak256("PID_anon_003"), "CTRI/2023/11/059302", 0);
        assertEq(registry.getMatchCount(), 3);
    }

    function test_multiple_matches_stored_in_order() public {
        bytes32 h1 = keccak256("patient_a");
        bytes32 h2 = keccak256("patient_b");

        registry.logMatch(h1, "TRIAL_A", 40);
        registry.logMatch(h2, "TRIAL_B", 90);

        assertEq(registry.getMatch(0).patientHash, h1);
        assertEq(registry.getMatch(1).patientHash, h2);
        assertEq(registry.getMatch(0).trialId, "TRIAL_A");
        assertEq(registry.getMatch(1).trialId, "TRIAL_B");
    }

    // -------------------------------------------------------------------------
    // guardian + setGuardian
    // -------------------------------------------------------------------------

    function test_setGuardian_only_owner() public {
        registry.setGuardian(guardianAddr);
        assertEq(registry.guardian(), guardianAddr);

        vm.prank(notOwner);
        vm.expectRevert(TrialRegistry.Unauthorized.selector);
        registry.setGuardian(notOwner);
    }

    function test_guardian_can_pause() public {
        registry.setGuardian(guardianAddr);
        vm.prank(guardianAddr);
        registry.pause();
        assertTrue(registry.paused());
    }

    function test_guardian_cannot_unpause() public {
        registry.setGuardian(guardianAddr);
        vm.prank(guardianAddr);
        registry.pause();

        vm.prank(guardianAddr);
        vm.expectRevert(TrialRegistry.Unauthorized.selector);
        registry.unpause();
    }

    // -------------------------------------------------------------------------
    // transferOwnership (two-step) + acceptOwnership
    // -------------------------------------------------------------------------

    function test_transferOwnership_and_accept_works() public {
        registry.transferOwnership(newOwner);
        assertEq(registry.pendingOwner(), newOwner);

        vm.expectEmit(true, true, false, false, address(registry));
        emit TrialRegistry.OwnershipTransferred(owner, newOwner);

        vm.prank(newOwner);
        registry.acceptOwnership();
        assertEq(registry.owner(), newOwner);
        assertEq(registry.pendingOwner(), address(0));

        vm.prank(newOwner);
        registry.logMatch(PATIENT_HASH, TRIAL_ID, 60);
        assertEq(registry.getMatchCount(), 1);
    }

    function test_transferOwnership_emits_initiated() public {
        vm.expectEmit(true, true, false, false, address(registry));
        emit TrialRegistry.OwnershipTransferInitiated(owner, newOwner);
        registry.transferOwnership(newOwner);
    }

    function test_acceptOwnership_reverts_wrong_pending() public {
        registry.transferOwnership(newOwner);
        vm.prank(notOwner);
        vm.expectRevert(TrialRegistry.Unauthorized.selector);
        registry.acceptOwnership();
    }

    function test_cancelOwnershipTransfer_clears_pending() public {
        registry.transferOwnership(newOwner);
        vm.expectEmit(true, true, false, false, address(registry));
        emit TrialRegistry.OwnershipTransferCancelled(owner, newOwner);
        registry.cancelOwnershipTransfer();
        assertEq(registry.pendingOwner(), address(0));

        vm.prank(newOwner);
        vm.expectRevert(TrialRegistry.Unauthorized.selector);
        registry.acceptOwnership();
    }

    function test_cancelOwnershipTransfer_emits_when_no_pending() public {
        vm.expectEmit(true, true, false, false, address(registry));
        emit TrialRegistry.OwnershipTransferCancelled(owner, address(0));
        registry.cancelOwnershipTransfer();
    }

    function test_transferOwnership_old_owner_keeps_write_until_accept() public {
        registry.transferOwnership(newOwner);
        registry.logMatch(PATIENT_HASH, TRIAL_ID, 50);
        assertEq(registry.getMatchCount(), 1);
    }

    function test_transferOwnership_old_owner_cannot_write_after_accept() public {
        registry.transferOwnership(newOwner);
        vm.prank(newOwner);
        registry.acceptOwnership();

        vm.expectRevert(TrialRegistry.Unauthorized.selector);
        registry.logMatch(PATIENT_HASH, TRIAL_ID, 50);
    }

    function test_transferOwnership_reverts_zero_address() public {
        vm.expectRevert(TrialRegistry.ZeroAddress.selector);
        registry.transferOwnership(address(0));
    }

    function test_transferOwnership_reverts_unauthorized() public {
        vm.prank(notOwner);
        vm.expectRevert(TrialRegistry.Unauthorized.selector);
        registry.transferOwnership(newOwner);
    }

    // -------------------------------------------------------------------------
    // pause
    // -------------------------------------------------------------------------

    function test_pause_blocks_logMatch_and_logConsent() public {
        registry.pause();

        vm.expectRevert(TrialRegistry.ContractPaused.selector);
        registry.logMatch(PATIENT_HASH, TRIAL_ID, 50);

        vm.expectRevert(TrialRegistry.ContractPaused.selector);
        registry.logConsent(PATIENT_HASH, IPFS_REF);
    }

    function test_unpause_restores_writes() public {
        registry.pause();
        registry.unpause();
        registry.logMatch(PATIENT_HASH, TRIAL_ID, 50);
        assertEq(registry.getMatchCount(), 1);
    }

    function test_pause_reverts_unauthorized() public {
        vm.prank(notOwner);
        vm.expectRevert(TrialRegistry.Unauthorized.selector);
        registry.pause();
    }

    // -------------------------------------------------------------------------
    // Timestamp handling
    // -------------------------------------------------------------------------

    function test_timestamp_stored_at_log_time() public {
        uint256 t = 1_735_000_000;
        vm.warp(t);
        registry.logMatch(PATIENT_HASH, TRIAL_ID, 55);
        assertEq(registry.getMatch(0).timestamp, t);
    }

    function test_timestamps_increase_with_time() public {
        vm.warp(1_000_000);
        registry.logMatch(PATIENT_HASH, TRIAL_ID, 50);

        vm.warp(1_000_100);
        registry.logMatch(keccak256("p2"), "T2", 60);

        assertTrue(registry.getMatch(1).timestamp > registry.getMatch(0).timestamp);
    }
}
