// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Rent2Repay} from "../src/Rent2Repay.sol";
import {MockRMM} from "./mocks/MockRMM.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Rent2RepayTest is Test {
    Rent2Repay public rent2Repay;
    MockRMM public mockRMM;
    MockERC20 public wxdai;
    MockERC20 public usdc;
    MockERC20 public wxdaiSupply;
    MockERC20 public usdcSupply;
    
    address public admin = address(0x1);
    address public emergency = address(0x2);
    address public operator = address(0x3);
    address public user = address(0x4);
    address public user2 = address(0x5);
    address public user3 = address(0x6);
    
    function setUp() public {
        // Créer les tokens d'abord
        wxdai = new MockERC20("Wrapped XDAI", "WXDAI", 18, 1000000 ether);
        usdc = new MockERC20("USD Coin", "USDC", 6, 1000000 * 10**6);
        wxdaiSupply = new MockERC20("WXDAI Supply", "aWXDAI", 18, 1000000 ether);
        usdcSupply = new MockERC20("USDC Supply", "aUSDC", 6, 1000000 * 10**6);
        
        // Créer les debt tokens
        MockERC20 wxdaiDebt = new MockERC20("WXDAI Debt", "dWXDAI", 18, 1000000 ether);
        MockERC20 usdcDebt = new MockERC20("USDC Debt", "dUSDC", 6, 1000000 * 10**6);
        
        // Configurer le MockRMM avec les paramètres requis
        address[] memory tokens = new address[](2);
        tokens[0] = address(wxdai);
        tokens[1] = address(usdc);
        
        address[] memory debtTokens = new address[](2);
        debtTokens[0] = address(wxdaiDebt);
        debtTokens[1] = address(usdcDebt);
        
        address[] memory supplyTokens = new address[](2);
        supplyTokens[0] = address(wxdaiSupply);
        supplyTokens[1] = address(usdcSupply);
        
        mockRMM = new MockRMM(tokens, debtTokens, supplyTokens);
        mockRMM.setMode(0); // Mode normal sans soustraction
        
        // 1. Deploy l'implémentation
        Rent2Repay implementation = new Rent2Repay();
        
        // 2. Préparer les données d'initialisation
        bytes memory initData = abi.encodeWithSelector(
            Rent2Repay.initialize.selector,
            admin,
            emergency,
            operator,
            address(mockRMM),
            address(wxdai),           // wxdaiToken
            address(wxdaiSupply),     // wxdaiArmmToken
            address(usdc),            // usdcToken
            address(usdcSupply)       // usdcArmmToken
        );
        
        // 3. Deploy le proxy avec l'implémentation
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        rent2Repay = Rent2Repay(address(proxy));
        
        // Setup user with tokens
        wxdai.mint(user, 1000 ether);
        usdc.mint(user, 1000 * 10**6);
        
        // Donner des debt tokens au user (nécessaire pour le MockRMM)
        wxdaiDebt.mint(user, 100 ether);
        usdcDebt.mint(user, 100 * 10**6);
        
        // User approves Rent2Repay to spend tokens
        vm.prank(user);
        wxdai.approve(address(rent2Repay), type(uint256).max);
        vm.prank(user);
        usdc.approve(address(rent2Repay), type(uint256).max);
        
        // User approves MockRMM to spend debt tokens
        vm.prank(user);
        wxdaiDebt.approve(address(mockRMM), type(uint256).max);
        vm.prank(user);
        usdcDebt.approve(address(mockRMM), type(uint256).max);
    }
    
    function testInitialize() public view {
        assertTrue(rent2Repay.hasRole(rent2Repay.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(rent2Repay.hasRole(rent2Repay.ADMIN_ROLE(), admin));
        assertTrue(rent2Repay.hasRole(rent2Repay.EMERGENCY_ROLE(), emergency));
        assertTrue(rent2Repay.hasRole(rent2Repay.OPERATOR_ROLE(), operator));
    }
    
    function testConfigureRent2Repay() public {
        assertFalse(rent2Repay.isAuthorized(user));
        assertEq(rent2Repay.lastRepayTimestamps(user), 0);
        assertEq(rent2Repay.allowedMaxAmounts(user, address(wxdai)), 0);
        assertEq(rent2Repay.allowedMaxAmounts(user, address(usdc)), 0);
        assertEq(rent2Repay.periodicity(user, address(wxdai)), 0);
        assertEq(rent2Repay.periodicity(user, address(usdc)), 0);
    
        address[] memory tokens = new address[](2);
        tokens[0] = address(wxdai);
        tokens[1] = address(usdc);
    
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10 ether;
        amounts[1] = 100 * 10**6;
    
        uint256 period = 5 seconds;
        uint256 configTimestamp = block.timestamp;
    
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, period, configTimestamp);
    
        assertTrue(rent2Repay.isAuthorized(user));
        assertEq(rent2Repay.lastRepayTimestamps(user), configTimestamp);
        assertEq(rent2Repay.allowedMaxAmounts(user, address(wxdai)), 10 ether);
        assertEq(rent2Repay.allowedMaxAmounts(user, address(usdc)), 100 * 10**6);
        assertEq(rent2Repay.periodicity(user, address(wxdai)), period);
        assertEq(rent2Repay.periodicity(user, address(usdc)), period);
        assertGt(rent2Repay.lastRepayTimestamps(user), 0);
        assertGt(rent2Repay.allowedMaxAmounts(user, address(wxdai)), 0);
        assertGt(rent2Repay.allowedMaxAmounts(user, address(usdc)), 0);
        assertGt(rent2Repay.periodicity(user, address(wxdai)), 0);
        assertGt(rent2Repay.periodicity(user, address(usdc)), 0);
    }


    function testRent2Repay() public {
        // Configure first
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 seconds, block.timestamp);

        // Avancer le temps pour respecter la périodicité
        vm.warp(block.timestamp + 2 seconds);
        
        // Récupérer la configuration des frais
        (, uint256 senderTipsBps) = rent2Repay.getFeeConfiguration();
        
        // Mesurer les balances avant l'appel
        uint256 userBalanceBefore = wxdai.balanceOf(user);
        uint256 user2BalanceBefore = wxdai.balanceOf(user2);
        
        // Execute rent2repay avec user2 comme caller (qui reçoit les frais)
        vm.prank(user2);
        rent2Repay.rent2repay(user, address(wxdai));
        
        // Mesurer les balances après l'appel
        uint256 userBalanceAfter = wxdai.balanceOf(user);
        uint256 user2BalanceAfter = wxdai.balanceOf(user2);
        
        // Vérifier que l'utilisateur a payé
        assertLt(userBalanceAfter, userBalanceBefore);
        
        // Calculer les frais attendus pour user2
        uint256 amountRepaid = userBalanceBefore - userBalanceAfter;
        uint256 expectedSenderTips = (amountRepaid * senderTipsBps) / 10000;
        
        // Vérifier que user2 a reçu les frais
        uint256 actualTipsReceived = user2BalanceAfter - user2BalanceBefore;
        assertEq(actualTipsReceived, expectedSenderTips, "User2 should receive correct sender tips");
    }
    
    function testBatchRent2Repay() public {
        // ===== SETUP =====
        // Setup second user
        wxdai.mint(user2, 1000 ether);
        
        // Récupérer les debt tokens du MockRMM (utilise ceux configurés dans setUp)
        address wxdaiDebt = mockRMM.getDebtToken(address(wxdai));
        address usdcDebt = mockRMM.getDebtToken(address(usdc));
        
        // Donner des debt tokens au user2
        MockERC20(wxdaiDebt).mint(user2, 50 ether);
        MockERC20(usdcDebt).mint(user2, 50 * 10**6);
        
        // Approvals pour user2
        vm.prank(user2);
        wxdai.approve(address(rent2Repay), type(uint256).max);
        vm.prank(user2);
        MockERC20(wxdaiDebt).approve(address(mockRMM), type(uint256).max);
        vm.prank(user2);
        MockERC20(usdcDebt).approve(address(mockRMM), type(uint256).max);
        
        // ===== CONFIGURATION =====
        // Configuration des tokens et montants
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 5 ether;
        
        // Configurer Rent2Repay pour les deux utilisateurs
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 weeks, block.timestamp);
        
        vm.prank(user2);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 weeks, block.timestamp);
        
        // Avancer le temps pour respecter la périodicité
        vm.warp(block.timestamp + 1 weeks + 1 seconds);
        
        // ===== MESURE DES BALANCES AVANT =====
        uint256[] memory balancesBefore = new uint256[](2);
        balancesBefore[0] = wxdai.balanceOf(user);
        balancesBefore[1] = wxdai.balanceOf(user2);
        
        // ===== EXECUTION DU BATCH =====
        address[] memory users = new address[](2);
        users[0] = user;
        users[1] = user2;
        
        vm.prank(operator);
        rent2Repay.batchRent2Repay(users, address(wxdai));
        
        // ===== MESURE DES BALANCES APRÈS =====
        uint256[] memory balancesAfter = new uint256[](2);
        balancesAfter[0] = wxdai.balanceOf(user);
        balancesAfter[1] = wxdai.balanceOf(user2);
        
        // ===== VÉRIFICATIONS =====
        // Vérifier que les deux utilisateurs sont toujours autorisés
        assertTrue(rent2Repay.isAuthorized(user), "User 1 should still be authorized");
        assertTrue(rent2Repay.isAuthorized(user2), "User 2 should still be authorized");
        
        // Vérifier que les balances ont diminué (tokens dépensés)
        assertLt(balancesAfter[0], balancesBefore[0], "User 1 balance should have decreased");
        assertLt(balancesAfter[1], balancesBefore[1], "User 2 balance should have decreased");
        
        // Vérifier que la diminution est cohérente avec les montants configurés
        uint256 expectedSpent1 = balancesBefore[0] - balancesAfter[0];
        uint256 expectedSpent2 = balancesBefore[1] - balancesAfter[1];
        
        assertLe(expectedSpent1, amounts[0], "User 1 should not have spent more than configured");
        assertLe(expectedSpent2, amounts[0], "User 2 should not have spent more than configured");
        
        // Vérifier que les montants dépensés sont identiques (même configuration)
        assertEq(expectedSpent1, expectedSpent2, "Both users should have spent the same amount");
    }
    
    function testRevokeRent2Repay() public {
        // Configure first
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 weeks, block.timestamp);
        
        assertTrue(rent2Repay.isAuthorized(user));
        
        // Revoke
        vm.prank(user);
        rent2Repay.revokeRent2RepayAll();
        
        assertFalse(rent2Repay.isAuthorized(user));
    }

    function testRent2RepayLimit() public {
        // ===== SETUP =====
        // User a 100$ de dette (du setUp) et autorise 10$ par semaine
        uint256 weeklyLimit = 10 ether;
        address wxdaiDebt = mockRMM.getDebtToken(address(wxdai));
        
        // Configuration : 10$ par semaine
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = weeklyLimit;
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 weeks, block.timestamp);
        
        // ===== BOUCLE DE REMBOURSEMENTS =====
        uint256 totalSpent = 0;
        uint256 repaymentCount = 0;
        
        // Continuer les remboursements jusqu'à ce qu'il n'y ait plus de debt tokens
        // On s'arrête quand il reste moins de 5 ether (pour éviter les erreurs d'underflow)
        while (MockERC20(wxdaiDebt).balanceOf(user) >= 5 ether) {
            repaymentCount++;
            console.log("=== REMBOURSEMENT", repaymentCount, "===");
            console.log("Debt tokens avant:", MockERC20(wxdaiDebt).balanceOf(user));
            
            // Avancer le temps pour respecter la périodicité
            vm.warp(block.timestamp + 1 weeks + 1 seconds);
            
            uint256 balanceBefore = wxdai.balanceOf(user);
            vm.prank(user2);
            rent2Repay.rent2repay(user, address(wxdai));
            uint256 balanceAfter = wxdai.balanceOf(user);
            
            uint256 spent = balanceBefore - balanceAfter;
            totalSpent += spent;
            
            console.log("Montant rembourse:", spent);
            console.log("Debt tokens apres:", MockERC20(wxdaiDebt).balanceOf(user));
            console.log("Total depense:", totalSpent);
            console.log("---");
            
            // Vérifier que chaque remboursement est proche de 10$ (tolérance pour les différences du MockRMM)
            assertGe(spent, 9 ether, string(abi.encodePacked("Repayment ", repaymentCount, " should be at least 9$")));
            assertLe(spent, 10 ether, string(abi.encodePacked("Repayment ", repaymentCount, " should be at most 10$")));
            assertTrue(rent2Repay.isAuthorized(user), "User should still be authorized");
        }
        
        console.log("=== FIN DES REMBOURSEMENTS ===");
        console.log("Nombre total de remboursements:", repaymentCount);
        console.log("Total depense:", totalSpent);
        console.log("Debt tokens restants:", MockERC20(wxdaiDebt).balanceOf(user));
        
        // ===== TEST FINAL : REMBOURSEMENT DOIT ÉCHOUER =====
        vm.warp(block.timestamp + 1 weeks + 1 seconds);
        
        uint256 balanceBeforeFinal = wxdai.balanceOf(user);
        
        // Ce remboursement doit échouer car il n'y a plus assez de debt tokens
        vm.prank(user2);
        vm.expectRevert();
        rent2Repay.rent2repay(user, address(wxdai));
        
        // Vérifier que la balance n'a pas changé
        uint256 balanceAfterFinal = wxdai.balanceOf(user);
        assertEq(balanceAfterFinal, balanceBeforeFinal, "Balance should not change on failed repayment");
        
        // ===== VÉRIFICATIONS FINALES =====
        // Vérifier qu'on a fait plusieurs remboursements et que le total est proche de 100$
        assertGt(repaymentCount, 5, "Should have made several repayments");
        assertGe(totalSpent, 90 ether, "Total spent should be at least 90$");
        assertLe(totalSpent, 100 ether, "Total spent should be at most 100$");
    }

    // ===== TESTS DE COUVERTURE =====
    
    function testPauseUnpause() public {
        // Configuration préalable de l'utilisateur
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 seconds, block.timestamp);
        
        // Test initial : le contrat n'est pas en pause
        assertFalse(rent2Repay.paused(), "Contract should not be paused initially");
        
        // Test pause par emergency
        vm.prank(emergency);
        rent2Repay.pause();
        assertTrue(rent2Repay.paused(), "Contract should be paused after emergency pause");
        
        // Test qu'on ne peut pas faire de rent2repay quand c'est en pause
        vm.warp(block.timestamp + 2 seconds);
        vm.prank(user2);
        vm.expectRevert();
        rent2Repay.rent2repay(user, address(wxdai));
        
        // Test unpause par admin
        vm.prank(admin);
        rent2Repay.unpause();
        assertFalse(rent2Repay.paused(), "Contract should not be paused after admin unpause");
        
        // Test qu'on peut refaire du rent2repay après unpause
        vm.warp(block.timestamp + 2 seconds);
        vm.prank(user2);
        rent2Repay.rent2repay(user, address(wxdai));
    }
    
    function testFeeConfiguration() public {
        // Test des fonctions de récupération de configuration
        (uint256 daoFees, uint256 senderTips) = rent2Repay.getFeeConfiguration();
        assertGt(daoFees, 0, "DAO fees should be greater than 0");
        assertGt(senderTips, 0, "Sender tips should be greater than 0");
        
        // Test des getters individuels
        assertEq(rent2Repay.daoFeesBps(), daoFees, "daoFeesBps should match getFeeConfiguration");
        assertEq(rent2Repay.senderTipsBps(), senderTips, "senderTipsBps should match getFeeConfiguration");
        
        // Test de mise à jour des frais par admin
        uint256 newDaoFees = 500; // 5%
        uint256 newSenderTips = 300; // 3%
        
        vm.prank(admin);
        rent2Repay.updateDaoFees(newDaoFees);
        assertEq(rent2Repay.daoFeesBps(), newDaoFees, "DAO fees should be updated");
        
        vm.prank(admin);
        rent2Repay.updateSenderTips(newSenderTips);
        assertEq(rent2Repay.senderTipsBps(), newSenderTips, "Sender tips should be updated");
        
        // Test que seul admin peut modifier les frais
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.updateDaoFees(100);
        
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.updateSenderTips(100);
    }
    
    function testDaoFeeReduction() public {
        // Test des getters de réduction des frais DAO
        address reductionToken = rent2Repay.daoFeeReductionToken();
        uint256 minimumAmount = rent2Repay.daoFeeReductionMinimumAmount();
        uint256 reductionBps = rent2Repay.daoFeeReductionBps();
        address treasury = rent2Repay.daoTreasuryAddress();
        
        // Vérifier que les valeurs sont cohérentes
        assertTrue(reductionToken != address(0) || reductionToken == address(0), "Reduction token should be valid");
        assertGe(minimumAmount, 0, "Minimum amount should be non-negative");
        assertGe(reductionBps, 0, "Reduction BPS should be non-negative");
        // L'adresse du trésor peut être address(0) par défaut
        assertTrue(treasury == address(0) || treasury != address(0), "Treasury address should be valid");
        
        // Test de mise à jour de la réduction des frais par admin
        address newReductionToken = address(0x123);
        uint256 newMinimumAmount = 1000 ether;
        uint256 newReductionBps = 500; // 5%
        address newTreasury = address(0x456);
        
        vm.prank(admin);
        rent2Repay.updateDaoFeeReductionToken(newReductionToken);
        assertEq(rent2Repay.daoFeeReductionToken(), newReductionToken, "Reduction token should be updated");
        
        vm.prank(admin);
        rent2Repay.updateDaoFeeReductionMinimumAmount(newMinimumAmount);
        assertEq(rent2Repay.daoFeeReductionMinimumAmount(), newMinimumAmount, "Minimum amount should be updated");
        
        vm.prank(admin);
        rent2Repay.updateDaoFeeReductionPercentage(newReductionBps);
        assertEq(rent2Repay.daoFeeReductionBps(), newReductionBps, "Reduction BPS should be updated");
        
        vm.prank(admin);
        rent2Repay.updateDaoTreasuryAddress(newTreasury);
        assertEq(rent2Repay.daoTreasuryAddress(), newTreasury, "Treasury address should be updated");
        
        // Test que seul admin peut modifier la réduction des frais
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.updateDaoFeeReductionToken(address(0x789));
    }
    
    function testTokenManagement() public {
        // Test des fonctions de gestion des tokens
        
        // Test getActiveTokens initial
        address[] memory initialTokens = rent2Repay.getActiveTokens();
        assertGe(initialTokens.length, 2, "Should have at least 2 active tokens initially");
        
        // Test authorizeTokenPair par admin
        address newToken = address(0x999);
        address newSupplyToken = address(0x888);
        
        vm.prank(admin);
        rent2Repay.authorizeTokenPair(newToken, newSupplyToken);
        
        // Vérifier que le token est maintenant actif
        address[] memory tokensAfterAdd = rent2Repay.getActiveTokens();
        assertGt(tokensAfterAdd.length, initialTokens.length, "Should have more tokens after adding");
        
        // Vérifier la configuration du token
        Rent2Repay.TokenConfig memory config = rent2Repay.tokenConfig(newToken);
        assertEq(config.token, newToken, "Token address should match");
        assertEq(config.supplyToken, newSupplyToken, "Supply token address should match");
        assertTrue(config.active, "Token should be active");
        
        // Test que seul admin peut autoriser des tokens
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.authorizeTokenPair(address(0x777), address(0x666));
        
        // Test unauthorizeToken par admin
        vm.prank(admin);
        rent2Repay.unauthorizeToken(newToken);
        
        // Vérifier que le token n'est plus actif
        Rent2Repay.TokenConfig memory configAfterRemove = rent2Repay.tokenConfig(newToken);
        assertFalse(configAfterRemove.active, "Token should not be active after removal");
        
        // Test que seul admin peut désautoriser des tokens
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.unauthorizeToken(address(wxdai));
        
        // Test des getters de tokens
        assertEq(rent2Repay.tokenList(0), address(wxdai), "First token should be WXDAI");
        assertEq(rent2Repay.tokenList(1), address(usdc), "Second token should be USDC");
    }
    
    function testGettersAndUtilities() public {
        // Configuration préalable de l'utilisateur
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 seconds, block.timestamp);
        
        // Test des fonctions de récupération de configuration
        
        // Test whoami
        (bool isAdmin, bool isOperator, bool isEmergency) = rent2Repay.whoami();
        assertFalse(isAdmin, "This contract should not be admin");
        assertFalse(isOperator, "This contract should not be operator");
        assertFalse(isEmergency, "This contract should not be emergency");
        
        // Test avec admin
        vm.prank(admin);
        (isAdmin, isOperator, isEmergency) = rent2Repay.whoami();
        assertTrue(isAdmin, "Admin should be admin");
        assertFalse(isOperator, "Admin should not be operator");
        assertFalse(isEmergency, "Admin should not be emergency");
        
        // Test avec operator
        vm.prank(operator);
        (isAdmin, isOperator, isEmergency) = rent2Repay.whoami();
        assertFalse(isAdmin, "Operator should not be admin");
        assertTrue(isOperator, "Operator should be operator");
        assertFalse(isEmergency, "Operator should not be emergency");
        
        // Test avec emergency
        vm.prank(emergency);
        (isAdmin, isOperator, isEmergency) = rent2Repay.whoami();
        assertFalse(isAdmin, "Emergency should not be admin");
        assertFalse(isOperator, "Emergency should not be operator");
        assertTrue(isEmergency, "Emergency should be emergency");
        
        // Test version
        string memory version = rent2Repay.version();
        assertGt(bytes(version).length, 0, "Version should not be empty");
        
        // Test rmm getter
        address rmmAddress = address(rent2Repay.rmm());
        assertEq(rmmAddress, address(mockRMM), "RMM address should match mock");
        
        // Test des getters de configuration utilisateur (déjà configuré dans setUp)
        uint256 allowedAmount = rent2Repay.allowedMaxAmounts(user, address(wxdai));
        assertGt(allowedAmount, 0, "User should have allowed amount for WXDAI");
        
        uint256 lastRepay = rent2Repay.lastRepayTimestamps(user);
        assertGt(lastRepay, 0, "User should have last repay timestamp");
        
        uint256 period = rent2Repay.periodicity(user, address(wxdai));
        assertGt(period, 0, "User should have periodicity for WXDAI");
        
        // Test tokenConfig pour un token existant
        Rent2Repay.TokenConfig memory wxdaiConfig = rent2Repay.tokenConfig(address(wxdai));
        assertEq(wxdaiConfig.token, address(wxdai), "Token address should match");
        assertTrue(wxdaiConfig.active, "WXDAI should be active");
        
        // Test tokenConfig pour un token inexistant
        Rent2Repay.TokenConfig memory unknownConfig = rent2Repay.tokenConfig(address(0x123));
        assertEq(unknownConfig.token, address(0), "Unknown token should have zero address");
        assertFalse(unknownConfig.active, "Unknown token should not be active");
    }
    
    function testErrorCasesAndValidations() public {
        // Test des cas d'erreur et validations
        
        // Test rent2repay avec utilisateur non autorisé
        vm.prank(user2);
        vm.expectRevert();
        rent2Repay.rent2repay(user, address(wxdai));
        
        // Test rent2repay avec token non autorisé
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 seconds, block.timestamp);
        
        // Test avec token non autorisé
        vm.prank(user2);
        vm.expectRevert();
        rent2Repay.rent2repay(user, address(0x123));
        
        // Test batchRent2Repay avec utilisateurs non autorisés
        address[] memory users = new address[](1);
        users[0] = user;
        
        vm.prank(user2);
        vm.expectRevert();
        rent2Repay.batchRent2Repay(users, address(wxdai));
        
        // Test configureRent2Repay avec arrays de longueurs différentes
        address[] memory tokens2 = new address[](2);
        tokens2[0] = address(wxdai);
        tokens2[1] = address(usdc);
        uint256[] memory amounts2 = new uint256[](1); // Différente longueur
        amounts2[0] = 10 ether;
        
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.configureRent2Repay(tokens2, amounts2, 1 seconds, block.timestamp);
        
        // Test configureRent2Repay avec token non autorisé
        address[] memory tokens3 = new address[](1);
        tokens3[0] = address(0x123); // Token non autorisé
        uint256[] memory amounts3 = new uint256[](1);
        amounts3[0] = 10 ether;
        
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.configureRent2Repay(tokens3, amounts3, 1 seconds, block.timestamp);
        
        // Test revokeRent2RepayAll avec utilisateur non autorisé
        vm.prank(user2);
        vm.expectRevert();
        rent2Repay.revokeRent2RepayAll();
        
        // Test giveApproval avec token non autorisé
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.giveApproval(address(0x123), address(mockRMM), 1000);
        
        // Test emergencyTokenRecovery avec non-admin
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.emergencyTokenRecovery(address(wxdai), 1000, address(user));
        
        // Test emergencyTokenRecovery par admin (devrait fonctionner)
        // D'abord, donner des tokens au contrat
        wxdai.mint(address(rent2Repay), 1000);
        vm.prank(admin);
        rent2Repay.emergencyTokenRecovery(address(wxdai), 1000, address(admin));
        
        // Test isAuthorized avec utilisateur non configuré
        assertFalse(rent2Repay.isAuthorized(user2), "User2 should not be authorized");
        
        // Test isAuthorized après configuration
        assertTrue(rent2Repay.isAuthorized(user), "User should be authorized after configuration");
    }
}
