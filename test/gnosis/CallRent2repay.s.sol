pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Rent2Repay} from "../../src/Rent2Repay.sol";

contract callR2Rscript is Script {
    function run() external {
        // Charger les adresses depuis l'environnement
        address proxyAddress = vm.envAddress("R2R_PROXY_ADDR");
        
        // Vérifier que nous sommes sur Gnosis
        require(block.chainid == 100, "Gnosis chain");
        
        // Charger la clé privée depuis l'environnement
        uint256 user1_k = vm.envUint("USER1_KEY");
        address user1 = vm.addr(user1_k);
        uint256 user2_k = vm.envUint("USER2_KEY");
        address user2 = vm.addr(user2_k);
    
        console.log("This BOT", user2);
        console.log("will call rent2repay for", user1);

        //address usdcSuppplyAddr = vm.envAddress("USDC_SUPPLY_TOKEN");
        address usdcAddr = vm.envAddress("USDC_TOKEN");
        //address wxdaiSuppyAddr = vm.envAddress("WXDAI_SUPPLY_TOKEN");
       
        vm.startBroadcast(user2_k);
        
        // Créer une instance du contrat via le proxy
        Rent2Repay rent2Repay = Rent2Repay(proxyAddress);

    
        rent2Repay.rent2repay(user1, usdcAddr);
        
        vm.stopBroadcast();
    }
}