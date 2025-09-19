pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Rent2Repay} from "../../src/Rent2Repay.sol";

contract checkBalancesScript is Script {
    function run() external {
        // Charger les adresses depuis l'environnement
        address proxyAddress = vm.envAddress("R2R_PROXY_ADDR");
        address rmmAddress = vm.envAddress("RMM_ADDRESS");
        // Vérifier que nous sommes sur Gnosis
        require(block.chainid == 100, "Gnosis chain");
        
        // Charger la clé privée depuis l'environnement
        uint256 user1_k = vm.envUint("USER2_KEY");
        address user1 = vm.addr(user1_k);

        address usdcSupplyAddr = vm.envAddress("USDC_SUPPLY_TOKEN");
        address usdcAddr = vm.envAddress("USDC_TOKEN");
        address wxdaiSupplyAddr = vm.envAddress("WXDAI_SUPPLY_TOKEN");
        address wxdaiAddr = vm.envAddress("USDC_DEBT_TOKEN");
        address usdcDebtAddr = vm.envAddress("USDC_DEBT_TOKEN");
       
        vm.startBroadcast(user1_k);
        
        // Créer une instance du contrat via le proxy
        Rent2Repay rent2Repay = Rent2Repay(proxyAddress);


        //IERC20(usdcAddr).approve(proxyAddress, type(uint256).max);
        //IERC20(wxdaiSupplyAddr).approve(proxyAddress, type(uint256).max);
        //IERC20(usdcSupplyAddr).approve(proxyAddress, type(uint256).max);

        console.log("USER1 Checking balances R2R");
        uint256 balance = IERC20(usdcAddr).balanceOf(user1);
        console.log("Allowance USDC:", balance);
        balance = IERC20(usdcSupplyAddr).balanceOf(user1);
        console.log("Allowance USDC Supply:", balance);
        balance = IERC20(usdcDebtAddr).balanceOf(user1);
        console.log("Allowance USDC Debt:", balance);


        console.log("USER1 Checking allowances R2R");
        uint256 allowance = IERC20(usdcAddr).allowance(user1, proxyAddress);
        console.log("Allowance USDC:", allowance);
        allowance = IERC20(usdcSupplyAddr).allowance(user1, proxyAddress);
        console.log("Allowance USDC Supply:", allowance);

        // no allowance ?? make revert 80    
        //allowance = IERC20(usdcDebtAddr).allowance(user1, proxyAddress);
        //console.log("Allowance USDC Debt:", allowance);

        console.log("USR 1 Checking allowances RMM");
        allowance = IERC20(usdcAddr).allowance(user1, rmmAddress);
        console.log("Allowance USDC:", allowance);
        if(allowance == 0) {
                IERC20(usdcAddr).approve(rmmAddress, type(uint256).max);
                allowance = IERC20(usdcAddr).allowance(user1, rmmAddress);
                console.log("New Allowance USDC:", allowance);
        }
        allowance = IERC20(usdcSupplyAddr).allowance(user1, rmmAddress);
        console.log("Allowance USDC Supply:", allowance);
        if(allowance == 0) {
                IERC20(usdcAddr).approve(rmmAddress, type(uint256).max);
                allowance = IERC20(usdcAddr).allowance(user1, rmmAddress);
                console.log("Allowance USDC:", allowance);
        }
        console.log("R2R Checking allowances RMM");
        allowance = IERC20(usdcAddr).allowance(proxyAddress, rmmAddress);
        console.log("Allowance USDC:", allowance);

        allowance = IERC20(usdcSupplyAddr).allowance(proxyAddress, rmmAddress);
        console.log("Allowance USDC Supply:", allowance);

        // no allowance ?? make revert 80  
        //allowance = IERC20(usdcDebtAddr).allowance(user1, rmmAddress);
        //console.log("Allowance USDC Debt:", allowance);

    }
}