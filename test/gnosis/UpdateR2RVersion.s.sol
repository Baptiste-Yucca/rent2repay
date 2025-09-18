// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Rent2Repay} from "../../src/Rent2Repay.sol";

/**
 * @title UpdateR2RVersion
 * @dev Script pour mettre à jour la version de Rent2Repay derrière le proxy UUPS
 * @notice Ce script déploie une nouvelle implémentation et met à jour le proxy
 */
contract UpdateR2RVersion is Script {
    
    function run() external {
        // Charger les adresses depuis l'environnement
        address proxyAddress = vm.envAddress("R2R_PROXY_ADDR");
        
        // Vérifier que nous sommes sur Gnosis
        require(block.chainid == 100, "Gnosis chain");
        
        // Charger la clé privée admin depuis l'environnement
        uint256 adminPrivateKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.addr(adminPrivateKey);
        
        console.log("Mise a jour de Rent2Repay");
        console.log("Proxy Address:", proxyAddress);
        console.log("Admin Address:", admin);
        console.log("Chain ID:", block.chainid);
        
        vm.startBroadcast(adminPrivateKey);
        
        // Créer une instance du contrat via le proxy pour vérifier l'état actuel
        Rent2Repay rent2Repay = Rent2Repay(proxyAddress);
     
        // Déployer la nouvelle implémentation
        Rent2Repay newImplementation = new Rent2Repay();
        console.log("Nouvelle addresse:", address(newImplementation));
        
        // Effectuer la mise à jour
        console.log("Mise a jour du proxy...");
        rent2Repay.upgradeToAndCall(address(newImplementation), "");
        

        
        vm.stopBroadcast();
    }
}
