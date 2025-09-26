pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Rent2Repay} from "../../src/Rent2Repay.sol";

contract checkFeesScript is Script {
    function run() external {
        // Charger les adresses depuis l'environnement
        address proxyAddress = vm.envAddress("R2R_PROXY_ADDR");
        address rmmAddress = vm.envAddress("RMM_ADDRESS");
        // Vérifier que nous sommes sur Gnosis
        require(block.chainid == 100, "Gnosis chain");
        
        // Charger la clé privée depuis l'environnement
        uint256 user1_k = vm.envUint("USER1_KEY");
        address user1 = vm.addr(user1_k);
        
        uint256 admin_k = vm.envUint("PRIVATE_KEY");

        address usdcSupplyAddr = vm.envAddress("USDC_SUPPLY_TOKEN");
        address usdcAddr = vm.envAddress("USDC_TOKEN");
        address usdcDebtAddr = vm.envAddress("USDC_DEBT_TOKEN");
       
        vm.startBroadcast(admin_k);
        
        // Créer une instance du contrat via le proxy
        Rent2Repay rent2Repay = Rent2Repay(proxyAddress);

        console.log("Sender Tip BPS:", rent2Repay.senderTipsBps());

        console.log("DAO Fees BPS:", rent2Repay.daoFeesBps());
        address daoFeeReductionToken = rent2Repay.daoFeeReductionToken();

        console.log("DAO Fee Reduction Token:", daoFeeReductionToken);
        console.log("DAO Fee Reduction Minimum Amount:", rent2Repay.daoFeeReductionMinimumAmount());
        console.log("DAO Fee Reduction BPS:", rent2Repay.daoFeeReductionBps());

        //rent2Repay.updateDaoFeeReductionMinimumAmount(2);
        rent2Repay.updateDaoFeeReductionMinimumAmount(type(uint256).max);
        console.log("DAO Fee Reduction Minimum Amount:", rent2Repay.daoFeeReductionMinimumAmount());

        uint256 amount = IERC20(daoFeeReductionToken).balanceOf(user1);
        console.log("User1 DAO Fee Reduction Token Balance:", amount);
    }
}