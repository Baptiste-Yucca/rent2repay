// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Rent2Repay} from "../src/Rent2Repay.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployGnosisScript is Script {
    // Adresses des contrats sur Gnosis (du fichier .env)
    address constant ADMIN_ADDRESS = 0xD2f9d86f58E8871c6D97DCc2BF911efB98a4c97C;
    address constant EMERGENCY_ADDRESS = 0x19c13C99C13e648Cc9cF32ab04455Ea66eB6b6f8;
    address constant OPERATOR_ADDRESS = 0x5B3B05566724fD1E6C2941bC1499E9e89ca4E7f2;
    address constant RMM_ADDRESS = 0xFb9b496519fCa8473fba1af0850B6B8F476BFdB3;
    address constant WXDAI_TOKEN = 0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d;
    address constant WXDAI_SUPPLY_TOKEN = 0x0cA4f5554Dd9Da6217d62D8df2816c82bba4157b;
    address constant WXDAI_DEBT_TOKEN = 0x9908801dF7902675C3FEDD6Fea0294D18D5d5d34;
    address constant USDC_TOKEN = 0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83;
    address constant USDC_SUPPLY_TOKEN = 0xeD56F76E9cBC6A64b821e9c016eAFbd3db5436D1;
    address constant USDC_DEBT_TOKEN = 0x69c731aE5f5356a779f44C355aBB685d84e5E9e6;
    address constant DAO_GOVERNANCE_TOKEN = 0x0AA1e96D2a46Ec6beB2923dE1E61Addf5F5f1dce;
    address constant DAO_TREASURY = 0x3456789012345678901234567890123456789012;

    function run() external {
        // Charger la clé privée depuis l'environnement
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console.log("=== DEPLOYING RENT2REPAY ON GNOSIS ===");
        console.log("Deployer address:", vm.addr(deployerPrivateKey));
        console.log("Chain ID:", block.chainid);

        // Vérifier que nous sommes sur Gnosis
        require(block.chainid == 100, "Must be on Gnosis chain");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy l'implémentation
        Rent2Repay implementation = new Rent2Repay();
        console.log("Rent2Repay implementation deployed at:", address(implementation));

        // 2. Préparer les données d'initialisation
        Rent2Repay.InitConfig memory cfg = Rent2Repay.InitConfig({
            admin: ADMIN_ADDRESS,
            emergency: EMERGENCY_ADDRESS,
            operator: OPERATOR_ADDRESS,
            rmm: RMM_ADDRESS,
            wxdaiToken: WXDAI_TOKEN,
            wxdaiArmmToken: WXDAI_SUPPLY_TOKEN,
            wxdaiDebtToken: WXDAI_DEBT_TOKEN, // Si pas utilisé dans les tests
            usdcToken: USDC_TOKEN,
            usdcArmmToken: USDC_SUPPLY_TOKEN,
            usdcDebtToken: USDC_DEBT_TOKEN // Si pas utilisé dans les tests
        });

        bytes memory initData = abi.encodeWithSelector(Rent2Repay.initialize.selector, cfg);

        // 3. Deploy le proxy avec l'implémentation
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        Rent2Repay rent2Repay = Rent2Repay(address(proxy));

        console.log("Rent2Repay proxy deployed at:", address(rent2Repay));

        // 4. Configuration post-déploiement
        rent2Repay.updateDaoTreasuryAddress(DAO_TREASURY);
        console.log("DAO Treasury address set to:", DAO_TREASURY);

        rent2Repay.updateDaoFeeReductionToken(DAO_GOVERNANCE_TOKEN);
        console.log("DAO Governance token set to:", DAO_GOVERNANCE_TOKEN);

        rent2Repay.updateDaoFeeReductionMinimumAmount(1);
        console.log("DAO Fee reduction minimum amount set to: 100 ether");

        rent2Repay.updateDaoFeeReductionPercentage(5000); // 50% de réduction
        console.log("DAO Fee reduction percentage set to: 50%");

        // 5. Vérifications finales
        console.log("\n=== DEPLOYMENT VERIFICATION ===");
        console.log("Admin role:", rent2Repay.hasRole(rent2Repay.ADMIN_ROLE(), ADMIN_ADDRESS));
        console.log("Emergency role:", rent2Repay.hasRole(rent2Repay.EMERGENCY_ROLE(), EMERGENCY_ADDRESS));
        console.log("Operator role:", rent2Repay.hasRole(rent2Repay.OPERATOR_ROLE(), OPERATOR_ADDRESS));
        console.log("RMM address:", address(rent2Repay.rmm()));

        (uint256 daoFees, uint256 senderTips) = rent2Repay.getFeeConfiguration();
        console.log("DAO fees (BPS):", daoFees);
        console.log("Sender tips (BPS):", senderTips);

        address[] memory activeTokens = rent2Repay.getActiveTokens();
        console.log("Number of active tokens:", activeTokens.length);
        for (uint256 i = 0; i < activeTokens.length; i++) {
            console.log("Active token", i, ":", activeTokens[i]);
        }

        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT COMPLETED SUCCESSFULLY ===");
        console.log("Contract address:", address(rent2Repay));
        console.log("Implementation address:", address(implementation));
        console.log("Proxy address:", address(proxy));
    }
}
