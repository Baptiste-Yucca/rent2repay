// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Rent2Repay} from "../../src/Rent2Repay.sol";

contract giveApprovalScript is Script {
    function run() external {
        // Charger les adresses depuis l'environnement
        address proxyAddress = vm.envAddress("R2R_PROXY_ADDR");

        require(block.chainid == 100, "Gnosis chain");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        
        // Créer une instance du contrat via le proxy
        Rent2Repay rent2Repay = Rent2Repay(proxyAddress);

      
        rent2Repay.giveApproval(vm.envAddress("USDC_TOKEN"), proxyAddress, type(uint256).max);
        rent2Repay.giveApproval(vm.envAddress("WXDAI_TOKEN"), proxyAddress, type(uint256).max);
        rent2Repay.giveApproval(vm.envAddress("USDC_SUPPLY_TOKEN"), proxyAddress, type(uint256).max);
        rent2Repay.giveApproval(vm.envAddress("WXDAI_SUPPLY_TOKEN"), proxyAddress, type(uint256).max);
   
        
        vm.stopBroadcast();

    }
}