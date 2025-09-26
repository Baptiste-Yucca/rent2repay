// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Rent2Repay} from "../../src/Rent2Repay.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract giveApprovalScript is Script {
    function run() external {
        // Charger les adresses depuis l'environnement
        address proxyAddress = vm.envAddress("R2R_PROXY_ADDR");
        address rmmAddress = vm.envAddress("RMM_ADDRESS");
        
        require(block.chainid == 100, "Gnosis chain");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        
        // Créer une instance du contrat via le proxy
        Rent2Repay rent2Repay = Rent2Repay(proxyAddress);

        address usdcSupplyAddr = vm.envAddress("USDC_SUPPLY_TOKEN");
        address usdcAddr = vm.envAddress("USDC_TOKEN");
        address wxdaiSupplyAddr = vm.envAddress("WXDAI_SUPPLY_TOKEN");
        address wxdaiAddr = vm.envAddress("WXDAI_TOKEN");

        rent2Repay.giveApproval(usdcAddr, rmmAddress, 0); 
        rent2Repay.giveApproval(wxdaiAddr, rmmAddress, 0); 
        rent2Repay.giveApproval(wxdaiSupplyAddr, rmmAddress, 0);
        rent2Repay.giveApproval(usdcSupplyAddr, rmmAddress, 0);
        
        console.log("Checking allowances RMM");
        uint256 allowance = IERC20(usdcAddr).allowance(proxyAddress, rmmAddress);
        console.log("Allowance USDC:", allowance);
        allowance = IERC20(usdcSupplyAddr).allowance(proxyAddress, rmmAddress);
        console.log("Allowance USDC Supply:", allowance);
        allowance = IERC20(wxdaiAddr).allowance(proxyAddress, rmmAddress);
        console.log("Allowance WXDAI:", allowance);
        allowance = IERC20(wxdaiSupplyAddr).allowance(proxyAddress, rmmAddress);
        console.log("Allowance WXDAI Supply:", allowance);

        vm.stopBroadcast();

    }
}