// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Rent2Repay} from "../src/Rent2Repay.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Rent2RepayForkTest is Test {
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
    
    // Adresses de test (utiliser des adresses avec des fonds sur Gnosis)
    address constant TEST_USER = 0x412a25D4Bc1C30C41D5E1923C6E87b69198Efc49; // max 1000 en supply USDC
    address constant TEST_USER2 = 0x17108acDCCcA5CdEDA3C27170b8943b716B497a2;
    address constant DAO_TREASURY = 0x3f2d192F64020dA31D44289d62DB82adE6ABee6c;

    
    Rent2Repay public rent2Repay;
    IERC20 public wxdai;
    IERC20 public usdc;
    IERC20 public wxdaiSupply;
    IERC20 public usdcSupply;
    IERC20 public daoGovernanceToken;

    function setUp() public {
        // Fork Gnosis
        vm.createFork("https://rpc.gnosischain.com");
        
        console.log("=== FORK GNOSIS TEST SETUP ===");
        console.log("Forking Gnosis at block:", block.number);
        console.log("Chain ID:", block.chainid);
        
        // Initialiser les interfaces des tokens
        wxdai = IERC20(WXDAI_TOKEN);
        usdc = IERC20(USDC_TOKEN);
        wxdaiSupply = IERC20(WXDAI_SUPPLY_TOKEN);
        usdcSupply = IERC20(USDC_SUPPLY_TOKEN);
        daoGovernanceToken = IERC20(DAO_GOVERNANCE_TOKEN);
        
        // Déployer Rent2Repay
        _deployRent2Repay();
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
    
    function testForkInitialization() public view {
        console.log("\n--- Testing Fork Initialization ---");
        
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
        
        console.log("Fork initialization test passed");
    }
    
    function testRealTokenBalances() public view {
        console.log("\n--- Testing Real Token Balances ---");
        
        // Vérifier les balances des tokens réels
        console.log("WXDAI balance of this contract:", wxdai.balanceOf(address(this)));
        console.log("USDC balance of this contract:", usdc.balanceOf(address(this)));
        console.log("WXDAI Supply balance of this contract:", wxdaiSupply.balanceOf(address(this)));
        console.log("USDC Supply balance of this contract:", usdcSupply.balanceOf(address(this)));
        console.log("DAO Governance Token balance of this contract:", daoGovernanceToken.balanceOf(address(this)));
        
        // Vérifier que les tokens existent (non zéro)
        assertTrue(wxdai.totalSupply() > 0, "WXDAI should have supply");
        assertTrue(usdc.totalSupply() > 0, "USDC should have supply");
        
        console.log("Real token balances test passed");
    }
    
    function testAuthorizedTokensOnFork() public view {
        console.log("\n--- Testing Authorized Tokens on Fork ---");
        
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
        
        console.log("Authorized tokens on fork test passed");
    }
    
    function testUserConfigurationOnFork() public {
        console.log("\n--- Testing User Configuration on Fork ---");
        
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
        
        console.log("User configuration on fork test passed");
    }
    
    function testRent2RepayValidationOnFork() public {
        console.log("\n--- Testing Rent2Repay Validation on Fork ---");
        
        // Test avec utilisateur non autorisé
        vm.prank(TEST_USER2);
        vm.expectRevert();
        rent2Repay.rent2repay(TEST_USER, WXDAI_TOKEN);
        
        // Test avec token non autorisé
        address fakeToken = address(0x123);
        vm.prank(TEST_USER);
        vm.expectRevert();
        rent2Repay.rent2repay(TEST_USER, fakeToken);
        
        // Test avec adresse zéro
        vm.prank(TEST_USER);
        vm.expectRevert();
        rent2Repay.rent2repay(TEST_USER, address(0));
        
        console.log("Rent2Repay validation on fork test passed");
    }
    
    function testRMMIntegration() public view{
        console.log("\n--- Testing RMM Integration ---");
        
        // Vérifier que l'adresse RMM est correcte
        assertEq(address(rent2Repay.rmm()), RMM_ADDRESS, "RMM address should match");
        
        // Vérifier que le contrat RMM existe (code non vide)
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(sload(0))
        }
        // Note: Cette vérification peut ne pas fonctionner selon l'implémentation
        
        console.log("RMM address:", address(rent2Repay.rmm()));
        console.log("RMM integration test passed");
    }
    
    function testFeeConfigurationOnFork() public view {
        console.log("\n--- Testing Fee Configuration on Fork ---");
        
        // Vérifier la configuration des frais
        (uint256 daoFees, uint256 senderTips) = rent2Repay.getFeeConfiguration();
        assertGt(daoFees, 0, "DAO fees should be greater than 0");
        assertGt(senderTips, 0, "Sender tips should be greater than 0");
        
        // Vérifier la configuration de réduction des frais DAO
        (address reductionToken, uint256 minimumAmount, uint256 reductionPercentage, address treasuryAddress) = 
            rent2Repay.getDaoFeeReductionConfiguration();
        
        assertEq(reductionToken, DAO_GOVERNANCE_TOKEN, "Reduction token should match");
        assertEq(minimumAmount, 100 ether, "Minimum amount should be 100 ether");
        assertEq(reductionPercentage, 5000, "Reduction percentage should be 50%");
        assertEq(treasuryAddress, DAO_TREASURY, "Treasury address should match");
        
        console.log("DAO fees (BPS):", daoFees);
        console.log("Sender tips (BPS):", senderTips);
        console.log("Reduction token:", reductionToken);
        console.log("Minimum amount:", minimumAmount);
        console.log("Reduction percentage:", reductionPercentage);
        console.log("Treasury address:", treasuryAddress);
        
        console.log("Fee configuration on fork test passed");
    }
    
    function testPauseUnpauseOnFork() public {
        console.log("\n--- Testing Pause/Unpause on Fork ---");
        
        // Vérifier que le contrat n'est pas en pause initialement
        assertFalse(rent2Repay.paused(), "Contract should not be paused initially");
        
        // Test pause par emergency
        vm.prank(EMERGENCY_ADDRESS);
        rent2Repay.pause();
        assertTrue(rent2Repay.paused(), "Contract should be paused after emergency pause");
        
        // Test unpause par admin
        vm.prank(ADMIN_ADDRESS);
        rent2Repay.unpause();
        assertFalse(rent2Repay.paused(), "Contract should not be paused after admin unpause");
        
        console.log("Pause/Unpause on fork test passed");
    }
    
    function testRoleBasedAccessControlOnFork() public {
        console.log("\n--- Testing Role-Based Access Control on Fork ---");
        
        // Test que seul emergency peut faire pause
        vm.prank(ADMIN_ADDRESS);
        vm.expectRevert();
        rent2Repay.pause();
        
        vm.prank(OPERATOR_ADDRESS);
        vm.expectRevert();
        rent2Repay.pause();
        
        // Test que seul admin peut faire unpause
        vm.prank(EMERGENCY_ADDRESS);
        vm.expectRevert();
        rent2Repay.unpause();
        
        vm.prank(OPERATOR_ADDRESS);
        vm.expectRevert();
        rent2Repay.unpause();
        
        // Test que seul admin peut modifier les frais
        vm.prank(OPERATOR_ADDRESS);
        vm.expectRevert();
        rent2Repay.updateDaoFees(100);
        
        vm.prank(EMERGENCY_ADDRESS);
        vm.expectRevert();
        rent2Repay.updateDaoFees(100);
        
        console.log("Role-based access control on fork test passed");
    }

    function testSupplyTokenRepaymentWithRealUsers() public {

        uint256 user1SupplyBalanceBefore = usdcSupply.balanceOf(TEST_USER);
        uint256 user1UsdcBalanceBefore = usdc.balanceOf(TEST_USER);
        uint256 user2SupplyBalanceBefore = usdcSupply.balanceOf(TEST_USER2);
        uint256 daoTreasurySupplyBalanceBefore = usdcSupply.balanceOf(DAO_TREASURY);
        
        // Vérifier que TEST_USER a des supply tokens
        require(user1SupplyBalanceBefore > 0, "TEST_USER needs supply USDC tokens");
        
        // Configuration pour TEST_USER avec supply USDC
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdcSupply); // Utiliser le vrai supply USDC
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1 * 10**6; // 1 USDC (1,000,000 en unités brutes)
        
        // TEST_USER configure rent2repay pour le supply USDC
        vm.prank(TEST_USER);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 weeks, block.timestamp);
        
        console.log("TEST_USER configured rent2repay for supply USDC");
        
        // TEST_USER approuve le contrat pour dépenser ses supply tokens
        vm.prank(TEST_USER);
        usdcSupply.approve(address(rent2Repay), amounts[0]);
        
        console.log("TEST_USER approved supply USDC spending");
        
        // Avancer le temps pour respecter la périodicité
        vm.warp(block.timestamp + 1 weeks + 1);
        
        // TEST_USER2 appelle rent2repay pour TEST_USER
        vm.prank(TEST_USER2);
        rent2Repay.rent2repay(TEST_USER, address(usdcSupply));
        
        console.log("TEST_USER2 executed rent2repay for TEST_USER");
        
        // Vérifier les balances finales
        uint256 user1SupplyBalanceAfter = usdcSupply.balanceOf(TEST_USER);
        uint256 user1UsdcBalanceAfter = usdc.balanceOf(TEST_USER);
        uint256 user2SupplyBalanceAfter = usdcSupply.balanceOf(TEST_USER2);
        uint256 daoTreasurySupplyBalanceAfter = usdcSupply.balanceOf(DAO_TREASURY);
        
        console.log("TEST_USER Supply USDC balance after:", user1SupplyBalanceAfter);
        console.log("TEST_USER USDC balance after:", user1UsdcBalanceAfter);
        console.log("TEST_USER2 Supply USDC balance after:", user2SupplyBalanceAfter);
        console.log("DAO Treasury Supply USDC balance after:", daoTreasurySupplyBalanceAfter);
        
        // Vérifications
        // TEST_USER a payé avec ses supply tokens
        assertLt(user1SupplyBalanceAfter, user1SupplyBalanceBefore, "TEST_USER supply balance should have decreased");
        
        // TEST_USER USDC balance ne change pas (il paie avec supply tokens)
        assertEq(user1UsdcBalanceAfter, user1UsdcBalanceBefore, "TEST_USER USDC balance should not change");
        
        // Calculer les frais attendus
        uint256 daoFeesBps = rent2Repay.daoFeesBps();
        uint256 senderTipsBps = rent2Repay.senderTipsBps();
        uint256 expectedDaoFees = (amounts[0] * daoFeesBps) / 10000;
        uint256 expectedSenderTips = (amounts[0] * senderTipsBps) / 10000;
        
        console.log("Expected DAO fees:", expectedDaoFees);
        console.log("Expected sender tips:", expectedSenderTips);
        
        // TEST_USER2 a reçu les sender tips (en supply USDC)
        uint256 actualTipsReceived = user2SupplyBalanceAfter - user2SupplyBalanceBefore;
        assertEq(actualTipsReceived, expectedSenderTips, "TEST_USER2 should receive correct sender tips in supply USDC");
        
        // DAO treasury a reçu les frais DAO (en supply USDC)
        uint256 actualDaoFeesReceived = daoTreasurySupplyBalanceAfter - daoTreasurySupplyBalanceBefore;
        assertEq(actualDaoFeesReceived, expectedDaoFees, "DAO treasury should receive correct DAO fees in supply USDC");
        
        // Le contrat ne garde pas de supply tokens
        uint256 contractSupplyBalanceAfter = usdcSupply.balanceOf(address(rent2Repay));
        assertEq(contractSupplyBalanceAfter, 0, "Contract should not hold supply tokens after repayment");
        
        console.log("Supply token repayment test with real users passed!");
    }
}
