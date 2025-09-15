pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Rent2Repay} from "../../src/Rent2Repay.sol";

contract CallPauseScript is Script {
    function run() external {
        // Charger les adresses depuis l'environnement
        address proxyAddress = vm.envAddress("R2R_PROXY_ADDR");
        
        // Vérifier que nous sommes sur Gnosis
        require(block.chainid == 100, "Gnosis chain");
        
        // Essayer d'abord avec ADMIN_KEY, sinon OPERATOR_KEY
        uint256 adminKey;
        address caller;
        string memory role;
        
        try vm.envUint("PRIVATE_KEY") returns (uint256 key) {
            adminKey = key;
            caller = vm.addr(adminKey);
            role = "ADMIN";
        } catch {
            // Si ADMIN_KEY n'existe pas, essayer OPERATOR_KEY
            adminKey = vm.envUint("OPERATOR_KEY");
            caller = vm.addr(adminKey);
            role = "OPERATOR";
        }
        
        console.log("Caller address:", caller);
        console.log("Role:", role);
        
        vm.startBroadcast(adminKey);
        
        // Créer une instance du contrat via le proxy
        Rent2Repay rent2Repay = Rent2Repay(proxyAddress);
        
        // Vérifier l'état actuel du contrat
        bool isPaused = rent2Repay.paused();
        console.log("Contract currently paused:", isPaused);
        
        if (isPaused) {
            console.log("Contract is already paused, nothing to do");
        } else {
            // Mettre en pause le contrat
            rent2Repay.pause();
            console.log("Contract paused successfully");
            
            // Vérifier que le contrat est bien en pause
            bool isPausedAfter = rent2Repay.paused();
            console.log("Contract paused after call:", isPausedAfter);
        }
        
        vm.stopBroadcast();
    }
}