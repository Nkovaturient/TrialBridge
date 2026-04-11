// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { TrialRegistry } from "../src/TrialRegistry.sol";

contract DeployTrialRegistry is Script {
    function run() external returns (TrialRegistry registry) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address initialOwner = vm.envAddress("INITIAL_OWNER");

        vm.startBroadcast(deployerPrivateKey);

        registry = new TrialRegistry(initialOwner);

        vm.stopBroadcast();

        console.log("TrialRegistry deployed at:", address(registry));
        console.log("Owner:", registry.owner());
    }
}
