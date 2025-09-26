// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Rent2Repay} from "../../src/Rent2Repay.sol";

contract ManageTokenPairScript is Script {
    function run() external {
        // Charger les adresses depuis l'environnement
        address proxyAddress = vm.envAddress("R2R_PROXY_ADDR");
        address usdcToken = vm.envAddress("USDC_TOKEN");
        address usdcSupplyToken = vm.envAddress("USDC_SUPPLY_TOKEN");
        address usdcDebtToken = vm.envAddress("USDC_DEBT_TOKEN");

        require(block.chainid == 100, "Gnosis chain");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        
        // Créer une instance du contrat via le proxy
        Rent2Repay rent2Repay = Rent2Repay(proxyAddress);

      
        Rent2Repay.TokenConfig memory config = rent2Repay.tokenConfig(usdcToken);
        console.log("Token:", config.token);
        console.log("Supply Token:", config.supplyToken);
        console.log("Debt Token:", config.debtToken);
        console.log("Active:", config.active);
   
        rent2Repay.unauthorizeToken(usdcToken);
        config = rent2Repay.tokenConfig(usdcToken);
        console.log("Token:", config.token);
        console.log("Supply Token:", config.supplyToken);
        console.log("Debt Token:", config.debtToken);
        console.log("Active:", config.active);

        rent2Repay.authorizeTokenPair(usdcToken, usdcSupplyToken, usdcDebtToken);

        config = rent2Repay.tokenConfig(usdcToken);
        console.log("Token:", config.token);
        console.log("Supply Token:", config.supplyToken);
        console.log("Debt Token:", config.debtToken);
        console.log("Active:", config.active);
        
        vm.stopBroadcast();

    }
}