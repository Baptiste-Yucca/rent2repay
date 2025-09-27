pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Rent2Repay} from "../../src/Rent2Repay.sol";

contract configureR2Rscript is Script {
    function run() external {
        // Charger les adresses depuis l'environnement
        address proxyAddress = vm.envAddress("R2R_PROXY_ADDR");
        address rmmAddress = vm.envAddress("RMM_ADDRESS");
        // Vérifier que nous sommes sur Gnosis
        require(block.chainid == 100, "Gnosis chain");

        // Charger la clé privée depuis l'environnement
        uint256 user2Key = vm.envUint("USER2_KEY");
        address user2 = vm.addr(user2Key);
        console.log("user2", user2);
        address usdcSupplyAddr = vm.envAddress("USDC_SUPPLY_TOKEN");
        address usdcAddr = vm.envAddress("USDC_TOKEN");
        address wxdaiSupplyAddr = vm.envAddress("WXDAI_SUPPLY_TOKEN");

        vm.startBroadcast(user2Key);
        Rent2Repay rent2Repay = Rent2Repay(proxyAddress);

        address[] memory tokens = new address[](3);
        tokens[0] = usdcSupplyAddr;
        tokens[1] = wxdaiSupplyAddr;
        tokens[2] = usdcAddr;
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 2 * 10 ** 4; // 0.1 cent
        amounts[1] = 3 * 10 ** 16; // 0.1 cent
        amounts[2] = 4 * 10 ** 5; // 1 USDC

        rent2Repay.configureRent2Repay(tokens, amounts, 4 seconds, block.timestamp);

        // approve USDC for Rent2Repay
        IERC20(usdcAddr).approve(proxyAddress, type(uint256).max);
        IERC20(wxdaiSupplyAddr).approve(proxyAddress, type(uint256).max);
        IERC20(usdcSupplyAddr).approve(proxyAddress, type(uint256).max);

        console.log("Checking allowances R2R");
        uint256 allowance = IERC20(usdcAddr).allowance(user2, proxyAddress);
        console.log("Allowance USDC:", allowance);
        allowance = IERC20(usdcSupplyAddr).allowance(user2, proxyAddress);
        console.log("Allowance USDC Supply:", allowance);

        console.log("Checking allowances RMM");
        allowance = IERC20(usdcAddr).allowance(user2, rmmAddress);
        console.log("Allowance USDC:", allowance);
        allowance = IERC20(usdcSupplyAddr).allowance(user2, rmmAddress);
        console.log("Allowance USDC Supply:", allowance);

        vm.stopBroadcast();
    }
}
