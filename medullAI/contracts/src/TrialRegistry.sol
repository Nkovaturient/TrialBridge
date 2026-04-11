// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

/// @title  TrialRegistry
/// @notice Append-only on-chain audit log for TrialBridge patient-trial match events
///         and consent events. Only the contract owner may
///         write. Patient identifiers never appear on-chain — only keccak256 hashes.
/// @dev    No ETH/token value movement → no reentrancy risk.
///         Access control via a hand-rolled onlyOwner (no OZ dependency needed for one role).
///         score is uint8 (0-100); validated on-chain so no malformed records can be stored.
///         deploy with a Gnosis Safe as `initialOwner` for multisig control.
contract TrialRegistry {

    struct Match {
        bytes32 patientHash; // keccak256 of anonymised patient ID — never a real identifier
        string  trialId;     // CTRI registration number, e.g. "CTRI/2024/01/061234"
        uint8   score;       // Eligibility score 0-100
        uint256 timestamp;   // block.timestamp at logging time
    }


    address public owner;
    address public pendingOwner;
    bool    public paused;

    Match[] public matches;

    event MatchLogged(bytes32 indexed patientHash, string trialId, uint8 score, uint256 timestamp);
    event ConsentLogged(bytes32 indexed patientHash, string ipfsRef, uint256 timestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferInitiated(address indexed currentOwner, address indexed pendingNewOwner);
    event Paused(address indexed account);
    event Unpaused(address indexed account);

    error Unauthorized();
    error ScoreTooHigh(uint8 score);
    error IndexOutOfBounds(uint256 index, uint256 length);
    error ZeroAddress();
    error ContractPaused();

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
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

    // -------------------------------------------------------------------------
    // Write functions
    // -------------------------------------------------------------------------

    /// @notice Record a patient-trial eligibility match on-chain.
    /// @param  _patientHash  keccak256 hash of the anonymised patient ID.
    /// @param  _trialId      CTRI registration number string.
    /// @param  _score        Eligibility score, must be 0-100 inclusive.
    function logMatch(bytes32 _patientHash, string calldata _trialId, uint8 _score)
        external
        onlyOwner
        whenNotPaused
    {
        if (_score > 100) revert ScoreTooHigh(_score);

        matches.push(Match({
            patientHash: _patientHash,
            trialId:     _trialId,
            score:       _score,
            timestamp:   block.timestamp
        }));

        emit MatchLogged(_patientHash, _trialId, _score, block.timestamp);
    }

    /// @notice Record a patient consent event. The consent document lives on IPFS;
    ///         only its content-addressed hash reference is stored on-chain.
    /// @param  _patientHash  keccak256 hash of the anonymised patient ID.
    /// @param  _ipfsRef      IPFS CID or content hash of the consent document.
    function logConsent(bytes32 _patientHash, string calldata _ipfsRef)
        external
        onlyOwner
        whenNotPaused
    {
        emit ConsentLogged(_patientHash, _ipfsRef, block.timestamp);
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
        pendingOwner = address(0);
    }

    function pause() external onlyOwner {
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
    /// @param  _index  Zero-based index into the matches array.
    function getMatch(uint256 _index) external view returns (Match memory) {
        if (_index >= matches.length) revert IndexOutOfBounds(_index, matches.length);
        return matches[_index];
    }

    /// @notice Return the total number of logged match records.
    function getMatchCount() external view returns (uint256) {
        return matches.length;
    }
}
