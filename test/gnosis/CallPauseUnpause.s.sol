pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Rent2Repay} from "../../src/Rent2Repay.sol";

contract CallPauseScript is Script {
    function run() external {
        // Charger les adresses depuis l'environnement
        address proxyAddress = vm.envAddress("R2R_PROXY_ADDR");

        // Vérifier que nous sommes sur Gnosis
        require(block.chainid == 100, "Gnosis chain");

        uint256 adminKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.addr(adminKey);

        // Si ADMIN_KEY n'existe pas, essayer OPERATOR_KEY
        uint256 emergencyKey = vm.envUint("EMERGENCY_KEY");
        address emergency = vm.addr(emergencyKey);

        Rent2Repay rent2Repay = Rent2Repay(proxyAddress);

        // Vérifier l'état actuel du contrat
        bool isPaused = rent2Repay.paused();
        console.log("Currently paused ? 0:f 1:t", isPaused);

        if (!isPaused) {
            console.log("Contract is not paused, => pause()");
            console.log("Caller address:", emergency);

            vm.startBroadcast(emergencyKey);
            rent2Repay.pause();
        } else {
            // Mettre en pause le contrat
            console.log("Contract is yet paused, => unpause()");
            console.log("Caller address:", admin);

            vm.startBroadcast(adminKey);
            rent2Repay.unpause();
            console.log("Contract paused successfully");
        }

        vm.stopBroadcast();
    }
}
