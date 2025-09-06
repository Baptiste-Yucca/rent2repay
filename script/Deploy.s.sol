// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Rent2Repay} from "../src/Rent2Repay.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address emergency = vm.envAddress("EMERGENCY_ADDRESS");
        address operator = vm.envAddress("OPERATOR_ADDRESS");
        
        // Adresses sur Gnosis
        address rmm = vm.envAddress("RMM_ADDRESS");
        address wxdai = vm.envAddress("WXDAI_ADDRESS");
        address wxdaiSupply = vm.envAddress("WXDAI_SUPPLY_ADDRESS");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address usdcSupply = vm.envAddress("USDC_SUPPLY_ADDRESS");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy Rent2Repay
        Rent2Repay rent2Repay = new Rent2Repay();
        
        // Initialize
        rent2Repay.initialize(
            admin,
            emergency,
            operator,
            rmm,
            wxdai,
            wxdaiSupply,
            usdc,
            usdcSupply
        );
        
        vm.stopBroadcast();
        
        console.log("Rent2Repay deployed at:", address(rent2Repay));
    }
}
