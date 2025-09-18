pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IRMM} from "../../src/interfaces/IRMM.sol";

contract testSupplyOnBehalfOfScript is Script {
    function run() external {
        // Charger les adresses depuis l'environnement
       
        address rmmAddress = vm.envAddress("RMM_ADDRESS");
        address usdcSuppplyAddr = vm.envAddress("USDC_SUPPLY_TOKEN");
        address usdcAddr = vm.envAddress("USDC_TOKEN");
        
        // Vérifier que nous sommes sur Gnosis
        require(block.chainid == 100, "Gnosis chain");
        
        // Charger la clé privée depuis l'environnement
        uint256 user1_k = vm.envUint("USER1_KEY");
        address user1 = vm.addr(user1_k);
        uint256 user2_k = vm.envUint("USER2_KEY");
        address user2 = vm.addr(user2_k);
        
    
        uint256 amount = IERC20(usdcAddr).balanceOf(user1);
        console.log("U1 - USDC:", amount);
        amount = IERC20(usdcSuppplyAddr).balanceOf(user1);
        console.log("U1 - USDC Supply:", amount);
        amount = IERC20(usdcAddr).balanceOf(user2);
        console.log("U2 - USDC:", amount);
        amount = IERC20(usdcSuppplyAddr).balanceOf(user2);
        console.log("U2 - USDC Supply:", amount);

        vm.startBroadcast(user1_k);
        IRMM(rmmAddress).supply(usdcAddr, 100, user2, 0);
        vm.stopBroadcast();

        amount = IERC20(usdcAddr).balanceOf(user1);
        console.log("U1 - USDC:", amount);
        amount = IERC20(usdcSuppplyAddr).balanceOf(user1);
        console.log("U1 - USDC Supply:", amount);
        amount = IERC20(usdcAddr).balanceOf(user2);
        console.log("U2 - USDC:", amount);
        amount = IERC20(usdcSuppplyAddr).balanceOf(user2);
        console.log("U2 - USDC Supply:", amount);
    }
}