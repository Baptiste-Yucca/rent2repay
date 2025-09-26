// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Rent2Repay} from "../../src/Rent2Repay.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract sendTokenScript is Script {
    function run() external {
        // Charger les adresses depuis l'environnement
        address proxyAddress = vm.envAddress("R2R_PROXY_ADDR");


        require(block.chainid == 100, "Gnosis chain");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        uint256 user1_k = vm.envUint("USER1_KEY");
        address user1 = vm.addr(user1_k);


        address usdcAddr = vm.envAddress("USDC_TOKEN");
        address usdcSupplyAddr = vm.envAddress("USDC_SUPPLY_TOKEN");
        
        vm.startBroadcast(user1_k);
        IERC20(usdcAddr).transfer(proxyAddress, 100);
        //IERC20(usdcSupplyAddr).transfer(user1, 100);
        vm.stopBroadcast();

        vm.startBroadcast(deployerPrivateKey);        
        // Créer une instance du contrat via le proxy
        Rent2Repay rent2Repay = Rent2Repay(proxyAddress);

        uint256 amount = IERC20(usdcAddr).balanceOf(proxyAddress);
        console.log("R2R USDC balance:", amount);
        if(amount > 0){
            rent2Repay.emergencyTokenRecovery(usdcAddr, amount, user1);
        }

        amount = IERC20(usdcSupplyAddr).balanceOf(proxyAddress);
        console.log("R2R USDC Supply balance:", amount);
        if(amount > 0){
            rent2Repay.emergencyTokenRecovery(usdcSupplyAddr, amount, user1);
        }
        
        vm.stopBroadcast();

    }
}
