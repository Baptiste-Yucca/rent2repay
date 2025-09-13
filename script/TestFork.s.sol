// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Test, console as testConsole} from "forge-std/Test.sol";
import {Rent2Repay} from "../src/Rent2Repay.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract TestForkScript is Script, Test {
    // Adresses des contrats sur Gnosis (du fichier .env)
    address constant ADMIN_ADDRESS = 0xD2f9d86f58E8871c6D97DCc2BF911efB98a4c97C;
    address constant EMERGENCY_ADDRESS = 0x19c13C99C13e648Cc9cF32ab04455Ea66eB6b6f8;
    address constant OPERATOR_ADDRESS = 0x5B3B05566724fD1E6C2941bC1499E9e89ca4E7f2;
    address constant RMM_ADDRESS = 0xFb9b496519fCa8473fba1af0850B6B8F476BFdB3;
    address constant WXDAI_TOKEN = 0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d;
    address constant WXDAI_SUPPLY_TOKEN = 0x0cA4f5554Dd9Da6217d62D8df2816c82bba4157b;
    address constant USDC_TOKEN = 0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83;
    address constant USDC_SUPPLY_TOKEN = 0xeD56F76E9cBC6A64b821e9c016eAFbd3db5436D1;
    address constant DAO_GOVERNANCE_TOKEN = 0x0AA1e96D2a46Ec6beB2923dE1E61Addf5F5f1dce;
    
    // Adresses de test
    address constant TEST_USER = 0x412a25D4Bc1C30C41D5E1923C6E87b69198Efc49;
    address constant TEST_USER2 = 0x2345678901234567890123456789012345678901;
    address constant DAO_TREASURY = 0x3f2d192F64020dA31D44289d62DB82adE6ABee6c;
    
    Rent2Repay public rent2Repay;
    IERC20 public wxdai;
    IERC20 public usdc;
    IERC20 public wxdaiSupply;
    IERC20 public usdcSupply;
    IERC20 public daoGovernanceToken;

    function run() external {
        // Fork Gnosis
        vm.createFork("https://rpc.gnosischain.com");
        
        console.log("=== FORK GNOSIS TEST ===");
        console.log("Forking Gnosis at block:", block.number);
        console.log("Chain ID:", block.chainid);
        
        // Initialiser les interfaces des tokens
        wxdai = IERC20(WXDAI_TOKEN);
        usdc = IERC20(USDC_TOKEN);
        wxdaiSupply = IERC20(WXDAI_SUPPLY_TOKEN);
        usdcSupply = IERC20(USDC_SUPPLY_TOKEN);
        daoGovernanceToken = IERC20(DAO_GOVERNANCE_TOKEN);
        
        // Vérifier les balances initiales
        address testAddress = address(0x1234567890123456789012345678901234567890);
        console.log("WXDAI balance of test address:", wxdai.balanceOf(testAddress));
        console.log("USDC balance of test address:", usdc.balanceOf(testAddress));
        console.log("WXDAI Supply balance of test address:", wxdaiSupply.balanceOf(testAddress));
        console.log("USDC Supply balance of test address:", usdcSupply.balanceOf(testAddress));
        
        // Déployer Rent2Repay
        _deployRent2Repay();
        
        // Exécuter les tests
        _testRent2RepayOnFork();
    }
    
    function _deployRent2Repay() internal {
        console.log("\n=== DEPLOYING RENT2REPAY ===");
        
        // 1. Deploy l'implémentation
        Rent2Repay implementation = new Rent2Repay();
        console.log("Rent2Repay implementation deployed at:", address(implementation));
        
        // 2. Préparer les données d'initialisation
        bytes memory initData = abi.encodeWithSelector(
            Rent2Repay.initialize.selector,
            ADMIN_ADDRESS,
            EMERGENCY_ADDRESS,
            OPERATOR_ADDRESS,
            RMM_ADDRESS,
            WXDAI_TOKEN,
            WXDAI_SUPPLY_TOKEN,
            USDC_TOKEN,
            USDC_SUPPLY_TOKEN
        );
        
        // 3. Deploy le proxy avec l'implémentation
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        rent2Repay = Rent2Repay(address(proxy));
        
        console.log("Rent2Repay proxy deployed at:", address(rent2Repay));
        
        // 4. Configuration post-déploiement
        vm.prank(ADMIN_ADDRESS);
        rent2Repay.updateDaoTreasuryAddress(DAO_TREASURY);
        
        vm.prank(ADMIN_ADDRESS);
        rent2Repay.updateDaoFeeReductionToken(DAO_GOVERNANCE_TOKEN);
        
        vm.prank(ADMIN_ADDRESS);
        rent2Repay.updateDaoFeeReductionMinimumAmount(100 ether);
        
        vm.prank(ADMIN_ADDRESS);
        rent2Repay.updateDaoFeeReductionPercentage(5000); // 50% de réduction
        
        console.log("Rent2Repay configured successfully");
    }
    
    function _testRent2RepayOnFork() internal {
        console.log("\n=== TESTING RENT2REPAY ON FORK ===");
        
        // Test 1: Vérifier l'initialisation
        _testInitialization();
        
        // Test 2: Vérifier les tokens autorisés
        _testAuthorizedTokens();
        
        // Test 3: Test de configuration utilisateur
        _testUserConfiguration();

        
        console.log("\n=== ALL TESTS COMPLETED ===");
    }
    
    function _testInitialization() internal {
        console.log("\n--- Testing Initialization ---");
        
        // Vérifier les rôles
        assertTrue(rent2Repay.hasRole(rent2Repay.DEFAULT_ADMIN_ROLE(), ADMIN_ADDRESS), "Admin should have DEFAULT_ADMIN_ROLE");
        assertTrue(rent2Repay.hasRole(rent2Repay.ADMIN_ROLE(), ADMIN_ADDRESS), "Admin should have ADMIN_ROLE");
        assertTrue(rent2Repay.hasRole(rent2Repay.EMERGENCY_ROLE(), EMERGENCY_ADDRESS), "Emergency should have EMERGENCY_ROLE");
        assertTrue(rent2Repay.hasRole(rent2Repay.OPERATOR_ROLE(), OPERATOR_ADDRESS), "Operator should have OPERATOR_ROLE");
        
        // Vérifier la configuration des frais
        (uint256 daoFees, uint256 senderTips) = rent2Repay.getFeeConfiguration();
        console.log("DAO fees (BPS):", daoFees);
        console.log("Sender tips (BPS):", senderTips);
        
        // Vérifier l'adresse RMM
        assertEq(address(rent2Repay.rmm()), RMM_ADDRESS, "RMM address should match");
        
        console.log("Initialization test passed");
    }
    
    function _testAuthorizedTokens() internal {
        console.log("\n--- Testing Authorized Tokens ---");
        
        // Vérifier les tokens actifs
        address[] memory activeTokens = rent2Repay.getActiveTokens();
        console.log("Number of active tokens:", activeTokens.length);
        
        for (uint i = 0; i < activeTokens.length; i++) {
            console.log("Active token", i, ":", activeTokens[i]);
            
            // Vérifier la configuration du token
            Rent2Repay.TokenConfig memory config = rent2Repay.tokenConfig(activeTokens[i]);
            console.log("  - Token:", config.token);
            console.log("  - Supply Token:", config.supplyToken);
            console.log("  - Active:", config.active);
        }
        
        // Vérifier que WXDAI et USDC sont autorisés
        Rent2Repay.TokenConfig memory wxdaiConfig = rent2Repay.tokenConfig(WXDAI_TOKEN);
        assertTrue(wxdaiConfig.active, "WXDAI should be active");
        
        Rent2Repay.TokenConfig memory usdcConfig = rent2Repay.tokenConfig(USDC_TOKEN);
        assertTrue(usdcConfig.active, "USDC should be active");
        
        console.log("Authorized tokens test passed");
    }
    
    function _testUserConfiguration() internal {
        console.log("\n--- Testing User Configuration ---");
        
        // Vérifier que l'utilisateur n'est pas autorisé initialement
        assertFalse(rent2Repay.isAuthorized(TEST_USER), "User should not be authorized initially");
        
        // Configurer l'utilisateur
        address[] memory tokens = new address[](2);
        tokens[0] = WXDAI_TOKEN;
        tokens[1] = USDC_TOKEN;
        
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1 ether; // 1 WXDAI
        amounts[1] = 100 * 10**6; // 100 USDC
        
        vm.prank(TEST_USER);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 weeks, block.timestamp);
        
        // Vérifier que l'utilisateur est maintenant autorisé
        assertTrue(rent2Repay.isAuthorized(TEST_USER), "User should be authorized after configuration");
        
        // Vérifier les montants configurés
        assertEq(rent2Repay.allowedMaxAmounts(TEST_USER, WXDAI_TOKEN), 1 ether, "WXDAI amount should be set");
        assertEq(rent2Repay.allowedMaxAmounts(TEST_USER, USDC_TOKEN), 100 * 10**6, "USDC amount should be set");
        
        // Vérifier la périodicité
        assertEq(rent2Repay.periodicity(TEST_USER, WXDAI_TOKEN), 1 weeks, "Periodicity should be set");
        
        console.log("User configuration test passed");
    }
    
}
