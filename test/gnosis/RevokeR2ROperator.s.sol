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
        uint256 op_k = vm.envUint("OPERATOR_KEY");
        address op = vm.addr(op_k);
        console.log("op", op);

        uint256 user1Key = vm.envUint("USER1_KEY");
        address user1 = vm.addr(user1Key);

        vm.startBroadcast(op_k);

        Rent2Repay rent2Repay = Rent2Repay(proxyAddress);

        bool isAuthorizedAfter = rent2Repay.isAuthorized(user1);
        console.log("User authorized 0/1:", isAuthorizedAfter);

        rent2Repay.removeUser(user1);

        isAuthorizedAfter = rent2Repay.isAuthorized(user1);
        console.log("User authorized after revoke:", isAuthorizedAfter);

        vm.stopBroadcast();
    }
}
