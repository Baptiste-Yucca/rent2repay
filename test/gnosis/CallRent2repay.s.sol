pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Rent2Repay} from "../../src/Rent2Repay.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract callR2Rscript is Script {
    function run() external {
        // Charger les adresses depuis l'environnement
        address proxyAddress = vm.envAddress("R2R_PROXY_ADDR");

        // Vérifier que nous sommes sur Gnosis
        require(block.chainid == 100, "Gnosis chain");

        // Charger la clé privée depuis l'environnement
        uint256 user1Key = vm.envUint("USER1_KEY");
        address user1 = vm.addr(user1Key);
        uint256 user2Key = vm.envUint("USER2_KEY");
        address user2 = vm.addr(user2Key);

        console.log("This BOT", user2);
        console.log("will call rent2repay for", user1);

        address usdcSupplyAddr = vm.envAddress("USDC_SUPPLY_TOKEN");
        address usdcDebtAddr = vm.envAddress("USDC_DEBT_TOKEN");
        vm.startBroadcast(user2Key);

        // Créer une instance du contrat via le proxy
        Rent2Repay rent2Repay = Rent2Repay(proxyAddress);

        uint256 amount = IERC20(usdcSupplyAddr).balanceOf(user1);
        console.log("User1 USDC Supply:", amount);
        amount = IERC20(usdcDebtAddr).balanceOf(user1);
        console.log("User1 USDC Debt:", amount);
        amount = rent2Repay.allowedMaxAmounts(user1, usdcSupplyAddr);
        console.log("User1 USDC Supply Allowed:", amount);

        rent2Repay.rent2repay(user1, usdcSupplyAddr);

        vm.stopBroadcast();
    }
}
