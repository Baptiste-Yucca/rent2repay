pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Rent2Repay} from "../../src/Rent2Repay.sol";

contract RevokeR2Rscript is Script {
    function run() external {
        // Charger les adresses depuis l'environnement
        address proxyAddress = vm.envAddress("R2R_PROXY_ADDR");
        
        // Vérifier que nous sommes sur Gnosis
        require(block.chainid == 100, "Gnosis chain");
        
        // Charger la clé privée de l'utilisateur depuis l'environnement
        uint256 user1_k = vm.envUint("USER1_KEY");
        address user1 = vm.addr(user1_k);
        console.log("user1", user1);
        
        vm.startBroadcast(user1_k);

        Rent2Repay rent2Repay = Rent2Repay(proxyAddress);
        
      
        rent2Repay.revokeRent2RepayAll();
         
        bool isAuthorizedAfter = rent2Repay.isAuthorized(user1);
        console.log("User authorized after revoke:", isAuthorizedAfter);
    
        
        vm.stopBroadcast();
    }
}