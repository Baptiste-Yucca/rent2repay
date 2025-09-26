// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Rent2Repay} from "../../src/Rent2Repay.sol";

contract UpdateDaoTokenScript is Script {
    function run() external {
        // Charger les adresses depuis l'environnement
        address proxyAddress = vm.envAddress("R2R_PROXY_ADDR");
        address daoGovernanceToken = vm.envAddress("DAO_GOVERNENCE_TOKEN");
        address usdcToken = vm.envAddress("USDC_TOKEN");

        require(block.chainid == 100, "Gnosis chain");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        
        // Créer une instance du contrat via le proxy
        Rent2Repay rent2Repay = Rent2Repay(proxyAddress);

        // TEST
        uint256 daoFeeBps = rent2Repay.daoFeesBps();
        console.log("DAO Fee Reduction BPS:", daoFeeBps);
        rent2Repay.updateDaoFees(1);
        daoFeeBps = rent2Repay.daoFeesBps();
        console.log("DAO Fee Reduction BPS:", daoFeeBps);

        uint256 senderTipsBps = rent2Repay.senderTipsBps();
        console.log("Tips BPS:", senderTipsBps);
        rent2Repay.updateSenderTips(2);
        senderTipsBps = rent2Repay.senderTipsBps();
        console.log("Tips BPS:", senderTipsBps);

        address daoFeeReductionToken = rent2Repay.daoFeeReductionToken();
        console.log("DAO Fee Reduction Token:", daoFeeReductionToken);
        rent2Repay.updateDaoFeeReductionToken(usdcToken);
        daoFeeReductionToken = rent2Repay.daoFeeReductionToken();
        console.log("DAO Fee Reduction Token:", daoFeeReductionToken);

        uint256 daoFeeReductionMinimumAmount = rent2Repay.daoFeeReductionMinimumAmount();
        console.log("DAO Fee Reduction Minimum Amount:", daoFeeReductionMinimumAmount);
        rent2Repay.updateDaoFeeReductionMinimumAmount(3);
        daoFeeReductionMinimumAmount = rent2Repay.daoFeeReductionMinimumAmount();
        console.log("DAO Fee Reduction Minimum Amount:", daoFeeReductionMinimumAmount);


        uint256 daoFeeReductionPercentage = rent2Repay.daoFeeReductionBps();
        console.log("DAO Fee Reduction Percentage:", daoFeeReductionPercentage);
        rent2Repay.updateDaoFeeReductionPercentage(10000);
        daoFeeReductionPercentage = rent2Repay.daoFeeReductionBps();
        console.log("DAO Fee Reduction Percentage:", daoFeeReductionPercentage);

        address treasury = rent2Repay.daoTreasuryAddress();
        console.log("DAO Treasury Address:", treasury);
        rent2Repay.updateDaoTreasuryAddress(address(0x123));
        treasury = rent2Repay.daoTreasuryAddress();
        console.log("DAO Treasury Address:", treasury);



        // rollback
        rent2Repay.updateDaoFeeReductionToken(daoGovernanceToken);
        rent2Repay.updateDaoFees(5000);
        rent2Repay.updateSenderTips(2500);
        rent2Repay.updateDaoFeeReductionMinimumAmount(1);
        rent2Repay.updateDaoTreasuryAddress(address(0x3456789012345678901234567890123456789012));
        rent2Repay.updateDaoFeeReductionPercentage(5000);
        
        vm.stopBroadcast();

    }
}
