export const TRIAL_REGISTRY_ABI = [
    {
        "type": "constructor",
        "inputs": [
            {
                "name": "initialOwner",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "initialGuardian",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "MAX_IPFS_REF_LENGTH",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "MAX_TRIAL_ID_LENGTH",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "VERSION",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "string",
                "internalType": "string"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "acceptOwnership",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "cancelOwnershipTransfer",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "consents",
        "inputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "patientHash",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "ipfsRef",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "timestamp",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getConsent",
        "inputs": [
            {
                "name": "_index",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "internalType": "struct TrialRegistry.Consent",
                "components": [
                    {
                        "name": "patientHash",
                        "type": "bytes32",
                        "internalType": "bytes32"
                    },
                    {
                        "name": "ipfsRef",
                        "type": "string",
                        "internalType": "string"
                    },
                    {
                        "name": "timestamp",
                        "type": "uint256",
                        "internalType": "uint256"
                    }
                ]
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getConsentBatch",
        "inputs": [
            {
                "name": "offset",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "limit",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "page",
                "type": "tuple[]",
                "internalType": "struct TrialRegistry.Consent[]",
                "components": [
                    {
                        "name": "patientHash",
                        "type": "bytes32",
                        "internalType": "bytes32"
                    },
                    {
                        "name": "ipfsRef",
                        "type": "string",
                        "internalType": "string"
                    },
                    {
                        "name": "timestamp",
                        "type": "uint256",
                        "internalType": "uint256"
                    }
                ]
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getConsentCount",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getMatch",
        "inputs": [
            {
                "name": "_index",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "internalType": "struct TrialRegistry.Match",
                "components": [
                    {
                        "name": "patientHash",
                        "type": "bytes32",
                        "internalType": "bytes32"
                    },
                    {
                        "name": "trialId",
                        "type": "string",
                        "internalType": "string"
                    },
                    {
                        "name": "score",
                        "type": "uint8",
                        "internalType": "uint8"
                    },
                    {
                        "name": "timestamp",
                        "type": "uint256",
                        "internalType": "uint256"
                    }
                ]
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getMatchBatch",
        "inputs": [
            {
                "name": "offset",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "limit",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "page",
                "type": "tuple[]",
                "internalType": "struct TrialRegistry.Match[]",
                "components": [
                    {
                        "name": "patientHash",
                        "type": "bytes32",
                        "internalType": "bytes32"
                    },
                    {
                        "name": "trialId",
                        "type": "string",
                        "internalType": "string"
                    },
                    {
                        "name": "score",
                        "type": "uint8",
                        "internalType": "uint8"
                    },
                    {
                        "name": "timestamp",
                        "type": "uint256",
                        "internalType": "uint256"
                    }
                ]
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getMatchCount",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "guardian",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "logConsent",
        "inputs": [
            {
                "name": "_patientHash",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "_ipfsRef",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "logMatch",
        "inputs": [
            {
                "name": "_patientHash",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "_trialId",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "_score",
                "type": "uint8",
                "internalType": "uint8"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "matches",
        "inputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "patientHash",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "trialId",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "score",
                "type": "uint8",
                "internalType": "uint8"
            },
            {
                "name": "timestamp",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "owner",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "pause",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "paused",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "pendingOwner",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "setGuardian",
        "inputs": [
            {
                "name": "_guardian",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "transferOwnership",
        "inputs": [
            {
                "name": "_newOwner",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "unpause",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "event",
        "name": "ConsentLogged",
        "inputs": [
            {
                "name": "patientHash",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "ipfsRef",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "timestamp",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "GuardianUpdated",
        "inputs": [
            {
                "name": "previousGuardian",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "newGuardian",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "MatchLogged",
        "inputs": [
            {
                "name": "patientHash",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "trialId",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "score",
                "type": "uint8",
                "indexed": false,
                "internalType": "uint8"
            },
            {
                "name": "timestamp",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "OwnershipTransferCancelled",
        "inputs": [
            {
                "name": "cancelledBy",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "cancelledPendingOwner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "OwnershipTransferInitiated",
        "inputs": [
            {
                "name": "currentOwner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "pendingNewOwner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "OwnershipTransferred",
        "inputs": [
            {
                "name": "previousOwner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "newOwner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "Paused",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "Unpaused",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "error",
        "name": "ContractPaused",
        "inputs": []
    },
    {
        "type": "error",
        "name": "EmptyIpfsRef",
        "inputs": []
    },
    {
        "type": "error",
        "name": "EmptyTrialId",
        "inputs": []
    },
    {
        "type": "error",
        "name": "IndexOutOfBounds",
        "inputs": [
            {
                "name": "index",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "length",
                "type": "uint256",
                "internalType": "uint256"
            }
        ]
    },
    {
        "type": "error",
        "name": "IpfsRefTooLong",
        "inputs": []
    },
    {
        "type": "error",
        "name": "ScoreTooHigh",
        "inputs": [
            {
                "name": "score",
                "type": "uint8",
                "internalType": "uint8"
            }
        ]
    },
    {
        "type": "error",
        "name": "TrialIdTooLong",
        "inputs": []
    },
    {
        "type": "error",
        "name": "Unauthorized",
        "inputs": []
    },
    {
        "type": "error",
        "name": "ZeroAddress",
        "inputs": []
    },
    {
        "type": "error",
        "name": "ZeroPatientHash",
        "inputs": []
    }
];
