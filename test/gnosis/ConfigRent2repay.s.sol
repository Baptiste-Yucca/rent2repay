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
        uint256 user1_k = vm.envUint("USER1_KEY");
        address user1 = vm.addr(user1_k);
        console.log("user1", user1);
        address usdcSupplyAddr = vm.envAddress("USDC_SUPPLY_TOKEN");
        address usdcAddr = vm.envAddress("USDC_TOKEN");
        address wxdaiSupplyAddr = vm.envAddress("WXDAI_SUPPLY_TOKEN");
        address wxdaiAddr = vm.envAddress("USDC_DEBT_TOKEN");
        //address usdcDebtAddr = vm.envAddress("USDC_DEBT_TOKEN");
       
        vm.startBroadcast(user1_k);
        
        // Créer une instance du contrat via le proxy
        Rent2Repay rent2Repay = Rent2Repay(proxyAddress);

      
        address[] memory tokens = new address[](3);
        tokens[0] = usdcSupplyAddr; 
        tokens[1] = wxdaiSupplyAddr;
        tokens[2] = usdcAddr;
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 1 * 10**4; // 0.1 cent
        amounts[1] = 1 * 10**16; // 0.1 cent
        amounts[2] = 1 * 10**6; // 1 USDC
        
        rent2Repay.configureRent2Repay(tokens, amounts, 1 seconds, block.timestamp);


        
        // approve USDC for Rent2Repay
        IERC20(usdcAddr).approve(proxyAddress, type(uint256).max);
        IERC20(wxdaiSupplyAddr).approve(proxyAddress, type(uint256).max);
        IERC20(usdcSupplyAddr).approve(proxyAddress, type(uint256).max);

        console.log("Checking allowances R2R");
        uint256 allowance = IERC20(usdcAddr).allowance(user1, proxyAddress);
        console.log("Allowance USDC:", allowance);
        allowance = IERC20(usdcSupplyAddr).allowance(user1, proxyAddress);
        console.log("Allowance USDC Supply:", allowance);

        // no allowance ?? make revert 80    
        //allowance = IERC20(usdcDebtAddr).allowance(user1, proxyAddress);
        //console.log("Allowance USDC Debt:", allowance);

        console.log("Checking allowances RMM");
        allowance = IERC20(usdcAddr).allowance(user1, rmmAddress);
        console.log("Allowance USDC:", allowance);
        allowance = IERC20(usdcSupplyAddr).allowance(user1, rmmAddress);
        console.log("Allowance USDC Supply:", allowance);

        // no allowance ?? make revert 80  
        //allowance = IERC20(usdcDebtAddr).allowance(user1, rmmAddress);
        //console.log("Allowance USDC Debt:", allowance);


        vm.stopBroadcast();
    }
}