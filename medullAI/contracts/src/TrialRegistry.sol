// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

/// @title  TrialRegistry
/// @notice Append-only on-chain audit log for TrialBridge patient-trial match events
///         and consent events. Only the contract owner may write matches/consents; guardian
///         may emergency-pause. Patient identifiers MUST NOT appear on-chain — only opaque
///         hashes produced off-chain (see privacy notes on `patientHash` params).
/// @dev    No ETH/token value movement → no reentrancy risk.
///         Access control via a hand-rolled onlyOwner (no OZ dependency needed for one role).
///         score is uint8 (0-100); validated on-chain so no malformed records can be stored.
///         deploy with a Gnosis Safe as `initialOwner` for multisig control if desired.
///         Timestamps use `block.timestamp` (Base L2: OP Stack sequencer clock, ~±12s vs wall clock).
///         For legally binding time evidence under the IT Act 2000 / Indian Evidence Act, supplement
///         on-chain records with RFC 3161 timestamps (or equivalent) anchored to the tx hash off-chain.
///         Non-upgradeable: use `VERSION` for audit trails when redeploying; migrate consumers to the new address.
contract TrialRegistry {
    /// @notice Semver string for off-chain migration and compliance documentation.
    string public constant VERSION = "2.0.0";

    /// @dev CTRI-style IDs are bounded; caps prevent calldata/storage grief.
    uint256 public constant MAX_TRIAL_ID_LENGTH = 64;
    /// @dev IPFS CID / content ref — generous upper bound (e.g. CIDv1 base32).
    uint256 public constant MAX_IPFS_REF_LENGTH = 128;

    struct Match {
        bytes32 patientHash;
        string trialId;
        uint8 score;
        /// @dev See contract-level @dev: L2 `block.timestamp` semantics; not a standalone legal clock.
        uint256 timestamp;
    }

    struct Consent {
        bytes32 patientHash;
        string ipfsRef;
        /// @dev See contract-level @dev: L2 `block.timestamp` semantics; not a standalone legal clock.
        uint256 timestamp;
    }

    address public owner;
    address public pendingOwner;
    address public guardian;
    bool public paused;

    Match[] public matches;
    Consent[] public consents;

    event MatchLogged(bytes32 indexed patientHash, string trialId, uint8 score, uint256 timestamp);
    event ConsentLogged(bytes32 indexed patientHash, string ipfsRef, uint256 timestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferInitiated(address indexed currentOwner, address indexed pendingNewOwner);
    event OwnershipTransferCancelled(address indexed cancelledBy, address indexed cancelledPendingOwner);
    event GuardianUpdated(address indexed previousGuardian, address indexed newGuardian);
    event Paused(address indexed account);
    event Unpaused(address indexed account);

    error Unauthorized();
    error ScoreTooHigh(uint8 score);
    error IndexOutOfBounds(uint256 index, uint256 length);
    error ZeroAddress();
    error ContractPaused();
    error EmptyTrialId();
    error TrialIdTooLong();
    error EmptyIpfsRef();
    error IpfsRefTooLong();
    error ZeroPatientHash();

    /// @param initialOwner  Contract admin (Safe multisig or EOA).
    /// @param initialGuardian Optional emergency pauser; `address(0)` disables guardian pause.
    constructor(address initialOwner, address initialGuardian) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        guardian = initialGuardian;
        emit OwnershipTransferred(address(0), initialOwner);
        emit GuardianUpdated(address(0), initialGuardian);
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    function _onlyOwner() internal view {
        if (msg.sender != owner) revert Unauthorized();
    }

    function _canPause() internal view returns (bool) {
        return msg.sender == owner || (guardian != address(0) && msg.sender == guardian);
    }

    /// @notice Assign or clear (`address(0)`) the guardian that may call `pause` alongside owner.
    function setGuardian(address _guardian) external onlyOwner {
        emit GuardianUpdated(guardian, _guardian);
        guardian = _guardian;
    }

    // -------------------------------------------------------------------------
    // Write functions
    // -------------------------------------------------------------------------

    /// @notice Record a patient-trial eligibility match on-chain.
    /// @param _patientHash  Opaque 32-byte identifier. Callers MUST derive this off-chain with a
    ///                      high-entropy scheme (e.g. HMAC-SHA256 with a server secret over the
    ///                      real ID).
    /// @param _trialId      CTRI registration number (bounded length).
    /// @param _score        Eligibility score 0-100 inclusive.
    function logMatch(bytes32 _patientHash, string calldata _trialId, uint8 _score) external onlyOwner whenNotPaused {
        if (_patientHash == bytes32(0)) revert ZeroPatientHash();
        uint256 tidLen = bytes(_trialId).length;
        if (tidLen == 0) revert EmptyTrialId();
        if (tidLen > MAX_TRIAL_ID_LENGTH) revert TrialIdTooLong();
        if (_score > 100) revert ScoreTooHigh(_score);

        uint256 ts = block.timestamp;
        matches.push(Match({patientHash: _patientHash, trialId: _trialId, score: _score, timestamp: ts}));

        emit MatchLogged(_patientHash, _trialId, _score, ts);
    }

    /// @notice Append a consent record to durable storage and emit for indexers.
    /// @param _patientHash  Same privacy rules as `logMatch` — HMAC/salted hash off-chain.
    /// @param _ipfsRef      IPFS CID or content hash of the consent artifact.
    function logConsent(bytes32 _patientHash, string calldata _ipfsRef) external onlyOwner whenNotPaused {
        if (_patientHash == bytes32(0)) revert ZeroPatientHash();
        uint256 refLen = bytes(_ipfsRef).length;
        if (refLen == 0) revert EmptyIpfsRef();
        if (refLen > MAX_IPFS_REF_LENGTH) revert IpfsRefTooLong();

        uint256 ts = block.timestamp;
        consents.push(Consent({patientHash: _patientHash, ipfsRef: _ipfsRef, timestamp: ts}));

        emit ConsentLogged(_patientHash, _ipfsRef, ts);
    }

    /// @notice Propose a new owner; they must call `acceptOwnership` to complete (two-step transfer).
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        pendingOwner = _newOwner;
        emit OwnershipTransferInitiated(owner, _newOwner);
    }

    /// @notice Complete ownership transfer after `transferOwnership` (must be `pendingOwner`).
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert Unauthorized();
        address oldOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(oldOwner, owner);
    }

    /// @notice Clear a pending ownership transfer before it is accepted.
    function cancelOwnershipTransfer() external onlyOwner {
        address cancelled = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferCancelled(msg.sender, cancelled);
    }

    function pause() external {
        if (!_canPause()) revert Unauthorized();
        if (paused) return;
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        if (!paused) return;
        paused = false;
        emit Unpaused(msg.sender);
    }

    // -------------------------------------------------------------------------
    // Read functions
    // -------------------------------------------------------------------------

    /// @notice Return a stored match record by array index.
    function getMatch(uint256 _index) external view returns (Match memory) {
        if (_index >= matches.length) revert IndexOutOfBounds(_index, matches.length);
        return matches[_index];
    }

    function getMatchCount() external view returns (uint256) {
        return matches.length;
    }

    /// @notice Return a stored consent record by array index.
    function getConsent(uint256 _index) external view returns (Consent memory) {
        if (_index >= consents.length) revert IndexOutOfBounds(_index, consents.length);
        return consents[_index];
    }

    function getConsentCount() external view returns (uint256) {
        return consents.length;
    }

    /// @notice Paginated match slice for indexers / dashboards (single RPC vs N× `getMatch`).
    /// @param offset Start index (inclusive).
    /// @param limit  Max rows to return; caller should bound `limit` to avoid eth_call size limits.
    function getMatchBatch(uint256 offset, uint256 limit) external view returns (Match[] memory page) {
        uint256 total = matches.length;
        if (offset >= total) return new Match[](0);
        uint256 end = offset + limit > total ? total : offset + limit;
        page = new Match[](end - offset);
        for (uint256 i; i < page.length; ++i) {
            page[i] = matches[offset + i];
        }
    }

    /// @notice Paginated consent slice for indexers / dashboards.
    function getConsentBatch(uint256 offset, uint256 limit) external view returns (Consent[] memory page) {
        uint256 total = consents.length;
        if (offset >= total) return new Consent[](0);
        uint256 end = offset + limit > total ? total : offset + limit;
        page = new Consent[](end - offset);
        for (uint256 i; i < page.length; ++i) {
            page[i] = consents[offset + i];
        }
    }
}
