pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Rent2Repay} from "../../src/Rent2Repay.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract callR2Rscript is Script {
    function run() external {
        // Charger les adresses depuis l'environnement
        address proxyAddress = vm.envAddress("R2R_PROXY_ADDR");
        console.log("Proxy Address:", proxyAddress);

        // Vérifier que nous sommes sur Gnosis
        require(block.chainid == 100, "Gnosis chain");

        // Charger la clé privée depuis l'environnement
        uint256 user1Key = vm.envUint("USER1_KEY");
        address user1 = vm.addr(user1Key);
        uint256 user2Key = vm.envUint("USER2_KEY");
        address user2 = vm.addr(user2Key);
        console.log("User1", user2);
        console.log("User2", user1);

        address usdcAddr = vm.envAddress("USDC_TOKEN");
        address usdcSupplyAddr = vm.envAddress("USDC_SUPPLY_TOKEN");
        address usdcDebtAddr = vm.envAddress("USDC_DEBT_TOKEN");

        uint256 op_k = vm.envUint("OPERATOR_KEY");
        address op = vm.addr(op_k);
        console.log("BOT", op);

        uint256 amount = IERC20(usdcSupplyAddr).balanceOf(user1);
        console.log("User1 USDC Supply:", amount);
        amount = IERC20(usdcDebtAddr).balanceOf(user1);
        console.log("User1 USDC Debt:", amount);
        amount = IERC20(usdcAddr).balanceOf(user1);
        console.log("User1 USDC:", amount);

        amount = IERC20(usdcSupplyAddr).balanceOf(user2);
        console.log("User2 USDC Supply:", amount);
        amount = IERC20(usdcDebtAddr).balanceOf(user2);
        console.log("User2 USDC Debt:", amount);
        amount = IERC20(usdcAddr).balanceOf(user2);
        console.log("User2 USDC:", amount);

        console.log("OP Balance:", address(op).balance);
        amount = IERC20(usdcSupplyAddr).balanceOf(op);
        console.log("OP USDC Supply:", amount);
        amount = IERC20(usdcDebtAddr).balanceOf(op);
        console.log("OP USDC Debt:", amount);
        amount = IERC20(usdcAddr).balanceOf(op);
        console.log("OP USDC:", amount);

        vm.startBroadcast(op_k);

        Rent2Repay rent2Repay = Rent2Repay(proxyAddress);

        address[] memory users = new address[](2);
        users[0] = user1;
        users[1] = user2;
        rent2Repay.batchRent2Repay(users, usdcAddr);

        amount = IERC20(usdcSupplyAddr).balanceOf(user1);
        console.log("User1 USDC Supply:", amount);
        amount = IERC20(usdcDebtAddr).balanceOf(user1);
        console.log("User1 USDC Debt:", amount);
        amount = IERC20(usdcAddr).balanceOf(user1);
        console.log("User1 USDC:", amount);

        amount = IERC20(usdcSupplyAddr).balanceOf(user2);
        console.log("User2 USDC Supply:", amount);
        amount = IERC20(usdcDebtAddr).balanceOf(user2);
        console.log("User2 USDC Debt:", amount);
        amount = IERC20(usdcAddr).balanceOf(user2);
        console.log("User2 USDC:", amount);

        amount = IERC20(usdcSupplyAddr).balanceOf(op);
        console.log("OP USDC Supply:", amount);
        amount = IERC20(usdcDebtAddr).balanceOf(op);
        console.log("OP USDC Debt:", amount);
        amount = IERC20(usdcAddr).balanceOf(op);
        console.log("OP USDC:", amount);

        vm.stopBroadcast();
    }
}
