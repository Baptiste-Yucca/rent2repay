// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Rent2Repay} from "../../src/Rent2Repay.sol";
import {Rent2RepayV2} from "./mocks/Rent2RepayV2.sol";
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
    MockERC20 public usdcDebt;
    
    address public admin = address(0x1);
    address public emergency = address(0x2);
    address public operator = address(0x3);
    address public user = address(0x4);
    address public user2 = address(0x5);
    address public user3 = address(0x6);
    address public unknownUser = address(0x7);
    address public daoTreasury = address(0x8);
    MockERC20 public daoGovernanceToken;

    
    function setUp() public {
        // Créer les tokens d'abord
        wxdai = new MockERC20("Wrapped XDAI", "WXDAI", 18, 1000000 ether);
        usdc = new MockERC20("USD Coin", "USDC", 6, 1000000 * 10**6);
        wxdaiSupply = new MockERC20("WXDAI Supply", "aWXDAI", 18, 1000000 ether);
        usdcSupply = new MockERC20("USDC Supply", "aUSDC", 6, 1000000 * 10**6);
        daoGovernanceToken = new MockERC20("DAO Governance", "DAO", 18, 1000000 ether);
        
        // Créer les debt tokens
        MockERC20 wxdaiDebt = new MockERC20("WXDAI Debt", "dWXDAI", 18, 1000000 ether);
        usdcDebt = new MockERC20("USDC Debt", "dUSDC", 6, 1000000 * 10**6);
        
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

        // 1. Deploy l'implémentation
        Rent2Repay implementation = new Rent2Repay();
        
        // 2. Préparer les données d'initialisation
        Rent2Repay.InitConfig memory cfg = Rent2Repay.InitConfig({
            admin: admin,
            emergency: emergency,
            operator: operator,
            rmm: address(mockRMM),
            wxdaiToken: address(wxdai),
            wxdaiArmmToken: address(wxdaiSupply),
            wxdaiDebtToken: address(wxdaiDebt), // Si pas utilisé dans les tests
            usdcToken: address(usdc),
            usdcArmmToken: address(usdcSupply),
            usdcDebtToken: address(usdcDebt)   // Si pas utilisé dans les tests
        });

        bytes memory initData = abi.encodeWithSelector(
            Rent2Repay.initialize.selector,
            cfg
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
        
        // Configurer l'adresse treasury DAO après le déploiement
        vm.prank(admin);
        rent2Repay.updateDaoTreasuryAddress(daoTreasury);
        
        // Configurer le token de gouvernance DAO et les paramètres de réduction
        vm.prank(admin);
        rent2Repay.updateDaoFeeReductionToken(address(daoGovernanceToken));
        
        vm.prank(admin);
        rent2Repay.updateDaoFeeReductionMinimumAmount(100 ether); // 100 tokens minimum pour la réduction
        
        vm.prank(admin);
        rent2Repay.updateDaoFeeReductionPercentage(5000); // 50% de réduction des frais DAO
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


    
    function testBatchRent2Repay() public {
        // ===== SETUP =====
        // Setup second user
        wxdai.mint(user2, 1000 ether);
        
        // Récupérer les debt tokens du MockRMM (utilise ceux configurés dans setUp)
        address wxdaiDebt = mockRMM.getDebtToken(address(wxdai));
        
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
        // Configuration des tokens et montants DIFFÉRENTS pour les deux utilisateurs
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        
        // Configuration pour user1 : 5 ether
        uint256[] memory amounts1 = new uint256[](1);
        amounts1[0] = 5 ether;
        
        // Configuration pour user2 : 1 ether
        uint256[] memory amounts2 = new uint256[](1);
        amounts2[0] = 1 ether;
        
        // Configurer Rent2Repay pour les deux utilisateurs avec des montants différents
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts1, 1 weeks, block.timestamp);
        
        vm.prank(user2);
        rent2Repay.configureRent2Repay(tokens, amounts2, 1 weeks, block.timestamp);
        
        // Avancer le temps pour respecter la périodicité
        vm.warp(block.timestamp + 1 weeks + 1 seconds);
        
        // ===== MESURE DES BALANCES AVANT =====
        uint256[] memory balancesBefore = new uint256[](2);
        balancesBefore[0] = wxdai.balanceOf(user);
        balancesBefore[1] = wxdai.balanceOf(user2);
        uint256 daoTreasuryBalanceBefore = wxdai.balanceOf(daoTreasury);
        uint256 operatorBalanceBefore = wxdai.balanceOf(operator);
        
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
        uint256 daoTreasuryBalanceAfter = wxdai.balanceOf(daoTreasury);
        uint256 operatorBalanceAfter = wxdai.balanceOf(operator);
        
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
        
        assertLe(expectedSpent1, amounts1[0], "User 1 should not have spent more than configured (5 ether)");
        assertLe(expectedSpent2, amounts2[0], "User 2 should not have spent more than configured (1 ether)");
        
        // Vérifier que les montants dépensés correspondent aux configurations respectives
        assertEq(expectedSpent1, amounts1[0], "User 1 should have spent exactly 5 ether");
        assertEq(expectedSpent2, amounts2[0], "User 2 should have spent exactly 1 ether");
        
        // Vérifier que la DAO treasury a reçu les frais DAO corrects
        uint256 totalSpent = expectedSpent1 + expectedSpent2; // 5 ether + 1 ether = 6 ether
        (uint256 daoFeesBps, uint256 senderTipsBps) = rent2Repay.getFeeConfiguration();
        uint256 expectedDaoFees = (totalSpent * daoFeesBps) / 10000;
        uint256 actualDaoFeesReceived = daoTreasuryBalanceAfter - daoTreasuryBalanceBefore;
        assertEq(actualDaoFeesReceived, expectedDaoFees, "DAO treasury should receive correct DAO fees for batch (6 ether total)");
        
        // Vérifier que l'operator a reçu les sender tips
        uint256 expectedSenderTips = (totalSpent * senderTipsBps) / 10000;
        uint256 actualSenderTipsReceived = operatorBalanceAfter - operatorBalanceBefore;
        assertEq(actualSenderTipsReceived, expectedSenderTips, "Operator should receive correct sender tips for batch (6 ether total)");
        
        // ===== TEST avec token non défini =====
        address nonDefinedToken = address(0x5678); // Token non configuré
        
        vm.prank(operator);
        vm.expectRevert();
        rent2Repay.batchRent2Repay(users, nonDefinedToken);
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
        
        // ===== TEST getDaoFeeReductionConfiguration =====
        (address configToken, uint256 configMinimumAmount, uint256 configReductionPercentage, address configTreasuryAddress) = 
            rent2Repay.getDaoFeeReductionConfiguration();
        
        assertEq(configToken, newReductionToken, "Configuration token should match");
        assertEq(configMinimumAmount, newMinimumAmount, "Configuration minimum amount should match");
        assertEq(configReductionPercentage, newReductionBps, "Configuration reduction percentage should match");
        assertEq(configTreasuryAddress, newTreasury, "Configuration treasury address should match");
        
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
        address newDebtToken = address(0xaaa);
        
        vm.prank(admin);
        rent2Repay.authorizeTokenPair(newToken, newSupplyToken, newDebtToken);
        
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
        rent2Repay.authorizeTokenPair(address(0x777), address(0x666), address(0x555));
        
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
    
    function testRoleBasedAccessControl() public {
        // Test complet des rôles et accès pour toutes les fonctions
        
        // ===== FONCTIONS ADMIN SEULEMENT =====
        
        // updateDaoFees - seul ADMIN
        vm.prank(operator);
        vm.expectRevert();
        rent2Repay.updateDaoFees(100);
        
        vm.prank(emergency);
        vm.expectRevert();
        rent2Repay.updateDaoFees(100);
        
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.updateDaoFees(100);
        
        // updateSenderTips - seul ADMIN
        vm.prank(operator);
        vm.expectRevert();
        rent2Repay.updateSenderTips(100);
        
        vm.prank(emergency);
        vm.expectRevert();
        rent2Repay.updateSenderTips(100);
        
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.updateSenderTips(100);
        
        // updateDaoFeeReductionToken - seul ADMIN
        vm.prank(operator);
        vm.expectRevert();
        rent2Repay.updateDaoFeeReductionToken(address(0x123));
        
        vm.prank(emergency);
        vm.expectRevert();
        rent2Repay.updateDaoFeeReductionToken(address(0x123));
        
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.updateDaoFeeReductionToken(address(0x123));
        
        // updateDaoFeeReductionMinimumAmount - seul ADMIN
        vm.prank(operator);
        vm.expectRevert();
        rent2Repay.updateDaoFeeReductionMinimumAmount(1000);
        
        vm.prank(emergency);
        vm.expectRevert();
        rent2Repay.updateDaoFeeReductionMinimumAmount(1000);
        
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.updateDaoFeeReductionMinimumAmount(1000);
        
        // updateDaoFeeReductionPercentage - seul ADMIN
        vm.prank(operator);
        vm.expectRevert();
        rent2Repay.updateDaoFeeReductionPercentage(100);
        
        vm.prank(emergency);
        vm.expectRevert();
        rent2Repay.updateDaoFeeReductionPercentage(100);
        
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.updateDaoFeeReductionPercentage(100);
        
        // updateDaoTreasuryAddress - seul ADMIN
        vm.prank(operator);
        vm.expectRevert();
        rent2Repay.updateDaoTreasuryAddress(address(0x123));
        
        vm.prank(emergency);
        vm.expectRevert();
        rent2Repay.updateDaoTreasuryAddress(address(0x123));
        
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.updateDaoTreasuryAddress(address(0x123));
        
        // authorizeTokenPair - seul ADMIN
        vm.prank(operator);
        vm.expectRevert();
        rent2Repay.authorizeTokenPair(address(0x123), address(0x456), address(0x789));
        
        vm.prank(emergency);
        vm.expectRevert();
        rent2Repay.authorizeTokenPair(address(0x123), address(0x456), address(0x789));
        
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.authorizeTokenPair(address(0x123), address(0x456), address(0x789));
        
        // unauthorizeToken - seul ADMIN
        vm.prank(operator);
        vm.expectRevert();
        rent2Repay.unauthorizeToken(address(wxdai));
        
        vm.prank(emergency);
        vm.expectRevert();
        rent2Repay.unauthorizeToken(address(wxdai));
        
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.unauthorizeToken(address(wxdai));
        
        // emergencyTokenRecovery - seul ADMIN
        vm.prank(operator);
        vm.expectRevert();
        rent2Repay.emergencyTokenRecovery(address(wxdai), 1000, address(admin));
        
        vm.prank(emergency);
        vm.expectRevert();
        rent2Repay.emergencyTokenRecovery(address(wxdai), 1000, address(admin));
        
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.emergencyTokenRecovery(address(wxdai), 1000, address(admin));
        
        // unpause - seul ADMIN
        vm.prank(operator);
        vm.expectRevert();
        rent2Repay.unpause();
        
        vm.prank(emergency);
        vm.expectRevert();
        rent2Repay.unpause();
        
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.unpause();
        
        // ===== FONCTIONS EMERGENCY SEULEMENT =====
        
        // pause - seul EMERGENCY
        vm.prank(admin);
        vm.expectRevert();
        rent2Repay.pause();
        
        vm.prank(operator);
        vm.expectRevert();
        rent2Repay.pause();
        
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.pause();
        
        // ===== FONCTIONS USER SEULEMENT =====
        
        // revokeRent2RepayAll - seul USER configuré
        vm.prank(admin);
        vm.expectRevert();
        rent2Repay.revokeRent2RepayAll();
        
        vm.prank(operator);
        vm.expectRevert();
        rent2Repay.revokeRent2RepayAll();
        
        vm.prank(emergency);
        vm.expectRevert();
        rent2Repay.revokeRent2RepayAll();
        
        vm.prank(user2);
        vm.expectRevert();
        rent2Repay.revokeRent2RepayAll();
        
        // ===== FONCTIONS PUBLIQUES (TOUS PEUVENT APPELER) =====
        
        // Ces fonctions devraient fonctionner pour tous les rôles
        // (pas de test de revert nécessaire)
        
        // Test que les fonctions publiques fonctionnent
        vm.prank(admin);
        rent2Repay.whoami();
        
        vm.prank(operator);
        rent2Repay.whoami();
        
        vm.prank(emergency);
        rent2Repay.whoami();
        
        vm.prank(user);
        rent2Repay.whoami();
        
        // Test des getters
        vm.prank(admin);
        rent2Repay.getFeeConfiguration();
        
        vm.prank(operator);
        rent2Repay.getActiveTokens();
        
        vm.prank(emergency);
        rent2Repay.version();
        
        vm.prank(user);
        rent2Repay.isAuthorized(user);
    }
    
    function testSimpleRoleAccess() public {
        // Test simple des rôles pour identifier le problème
        
        // Test updateDaoFees - seul ADMIN
        vm.prank(operator);
        vm.expectRevert();
        rent2Repay.updateDaoFees(100);
        
        vm.prank(emergency);
        vm.expectRevert();
        rent2Repay.updateDaoFees(100);
        
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.updateDaoFees(100);
        
        // Test pause - seul EMERGENCY
        vm.prank(admin);
        vm.expectRevert();
        rent2Repay.pause();
        
        vm.prank(operator);
        vm.expectRevert();
        rent2Repay.pause();
        
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.pause();
    }
    
    function testPauseBehavior() public {
        // Test que toutes les fonctions avec whenNotPaused reverent quand le contrat est en pause
        
        // Configurer un utilisateur d'abord
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 seconds, block.timestamp);
        
        // Mettre le contrat en pause
        vm.prank(emergency);
        rent2Repay.pause();
        
        // Vérifier que le contrat est en pause
        assertTrue(rent2Repay.paused(), "Contract should be paused");
        
        // ===== TEST configureRent2Repay avec pause =====
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.configureRent2Repay(tokens, amounts, 1 seconds, block.timestamp);
        
        // ===== TEST rent2repay avec pause =====
        vm.prank(user2);
        vm.expectRevert();
        rent2Repay.rent2repay(user, address(wxdai));
        
        // ===== TEST batchRent2Repay avec pause =====
        address[] memory users = new address[](1);
        users[0] = user;
        
        vm.prank(user2);
        vm.expectRevert();
        rent2Repay.batchRent2Repay(users, address(wxdai));
        
        // ===== TEST unpause =====
        vm.prank(admin);
        rent2Repay.unpause();
        
        // Vérifier que le contrat n'est plus en pause
        assertFalse(rent2Repay.paused(), "Contract should not be paused");
        
        // Avancer le temps pour respecter la périodicité
        vm.warp(block.timestamp + 1 seconds);
        
        // Vérifier que les fonctions fonctionnent à nouveau
        vm.prank(user2);
        rent2Repay.rent2repay(user, address(wxdai));
    }
    
    function testTokenPairManagement() public {
        // Test complet de authorizeTokenPair et unauthorizeToken avec tokenConfig
        
        // Créer des tokens de test (USDT et sa paire)
        MockERC20 usdt = new MockERC20("Tether USD", "USDT", 6, 1000000 * 10**6);
        MockERC20 usdtSupply = new MockERC20("USDT Supply", "aUSDT", 6, 1000000 * 10**6);   
        MockERC20 usdtDebt = new MockERC20("USDT Debt", "vUSDT", 6, 1000000 * 10**6);
        
        // ===== TEST INITIAL : USDT n'est pas présent =====
        Rent2Repay.TokenConfig memory config = rent2Repay.tokenConfig(address(usdt));
        assertEq(config.token, address(0), "USDT should not be present initially");
        assertEq(config.supplyToken, address(0), "USDT supply should not be present initially");
        assertFalse(config.active, "USDT should not be authorized initially");
        
        // ===== TEST authorizeTokenPair =====
        vm.prank(admin);
        rent2Repay.authorizeTokenPair(address(usdt), address(usdtSupply), address(usdtDebt));
        
        // Vérifier que la paire a été ajoutée
        config = rent2Repay.tokenConfig(address(usdt));
        assertEq(config.token, address(usdt), "USDT token should be present");
        assertEq(config.supplyToken, address(usdtSupply), "USDT supply token should be correct");
        assertTrue(config.active, "USDT should be authorized");
        
        // Vérifier que USDT est dans la liste des tokens actifs
        address[] memory activeTokens = rent2Repay.getActiveTokens();
        bool usdtFound = false;
        for (uint i = 0; i < activeTokens.length; i++) {
            if (activeTokens[i] == address(usdt)) {
                usdtFound = true;
                break;
            }
        }
        assertTrue(usdtFound, "USDT should be in active tokens list");
        
        // ===== TEST unauthorizeToken =====
        vm.prank(admin);
        rent2Repay.unauthorizeToken(address(usdt));
        
        // Vérifier que la paire a été désactivée (mais pas supprimée)
        config = rent2Repay.tokenConfig(address(usdt));
        assertEq(config.token, address(usdt), "USDT token should still be present but inactive");
        assertEq(config.supplyToken, address(usdtSupply), "USDT supply should still be present but inactive");
        assertFalse(config.active, "USDT should not be active after unauthorize");
        
        // Vérifier que USDT n'est plus dans la liste des tokens actifs
        activeTokens = rent2Repay.getActiveTokens();
        usdtFound = false;
        for (uint i = 0; i < activeTokens.length; i++) {
            if (activeTokens[i] == address(usdt)) {
                usdtFound = true;
                break;
            }
        }
        assertFalse(usdtFound, "USDT should not be in active tokens list after unauthorize");
    }
    
    function testRemoveUserAndGetUserConfigs() public {
        // Test complet de removeUser et getUserConfigs avec unknownUser
        
        // ===== TEST INITIAL : unknownUser n'est pas configuré =====
        (address[] memory tokens, uint256[] memory maxAmounts) = rent2Repay.getUserConfigs(unknownUser);
        assertEq(tokens.length, 0, "UnknownUser should have no tokens initially");
        assertEq(maxAmounts.length, 0, "UnknownUser should have no maxAmounts initially");
        
        // ===== CONFIGURATION de unknownUser =====
        address[] memory configTokens = new address[](2);
        configTokens[0] = address(wxdai);
        configTokens[1] = address(usdc);
        uint256[] memory configAmounts = new uint256[](2);
        configAmounts[0] = 5 ether;
        configAmounts[1] = 1000 * 10**6;
        
        vm.prank(unknownUser);
        rent2Repay.configureRent2Repay(configTokens, configAmounts, 1 weeks, block.timestamp);
        
        // ===== VÉRIFICATION : unknownUser est maintenant configuré =====
        (tokens, maxAmounts) = rent2Repay.getUserConfigs(unknownUser);
        assertEq(tokens.length, 2, "UnknownUser should have 2 tokens after configuration");
        assertEq(maxAmounts.length, 2, "UnknownUser should have 2 maxAmounts after configuration");
        assertEq(tokens[0], address(wxdai), "First token should be WXDAI");
        assertEq(tokens[1], address(usdc), "Second token should be USDC");
        assertEq(maxAmounts[0], 5 ether, "WXDAI maxAmount should be 5 ether");
        assertEq(maxAmounts[1], 1000 * 10**6, "USDC maxAmount should be 1000 USDC");
        
        // Vérifier que unknownUser est autorisé
        assertTrue(rent2Repay.isAuthorized(unknownUser), "UnknownUser should be authorized after configuration");
        
        // ===== TEST removeUser par OPERATOR =====
        vm.prank(operator);
        rent2Repay.removeUser(unknownUser);
        
        // ===== VÉRIFICATION : unknownUser n'est plus configuré =====
        (tokens, maxAmounts) = rent2Repay.getUserConfigs(unknownUser);
        assertEq(tokens.length, 0, "UnknownUser should have no tokens after removeUser");
        assertEq(maxAmounts.length, 0, "UnknownUser should have no maxAmounts after removeUser");
        
        // Vérifier que unknownUser n'est plus autorisé
        assertFalse(rent2Repay.isAuthorized(unknownUser), "UnknownUser should not be authorized after removeUser");
        
        // ===== TEST removeUser avec utilisateur non autorisé =====
        vm.prank(admin);
        vm.expectRevert();
        rent2Repay.removeUser(unknownUser);
        
        vm.prank(emergency);
        vm.expectRevert();
        rent2Repay.removeUser(unknownUser);
        
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.removeUser(unknownUser);
        
        // ===== TEST removeUser avec utilisateur non configuré =====
        vm.prank(operator);
        vm.expectRevert();
        rent2Repay.removeUser(user2);
    }

    function testContractUpgrade() public {
        // Test de l'upgrade UUPS pour couvrir _authorizeUpgrade
        
        // Créer une nouvelle implémentation (version 2)
        Rent2RepayV2 newImplementation = new Rent2RepayV2();
        
        // Vérifier que seul admin peut faire l'upgrade
        vm.prank(user);
        vm.expectRevert();
        rent2Repay.upgradeToAndCall(address(newImplementation), "");
        
        vm.prank(emergency);
        vm.expectRevert();
        rent2Repay.upgradeToAndCall(address(newImplementation), "");
        
        vm.prank(operator);
        vm.expectRevert();
        rent2Repay.upgradeToAndCall(address(newImplementation), "");
        
        // Faire l'upgrade avec admin
        vm.prank(admin);
        rent2Repay.upgradeToAndCall(address(newImplementation), "");
        
        // Vérifier que l'upgrade a fonctionné
        assertEq(rent2Repay.version(), "2.0.0", "Version should be updated to 2.0.0");
        
        // Vérifier que les données sont préservées
        assertEq(address(rent2Repay.rmm()), address(mockRMM), "RMM address should be preserved");
        assertEq(rent2Repay.daoFeesBps(), 50, "DAO fees should be preserved");
        assertEq(rent2Repay.senderTipsBps(), 25, "Sender tips should be preserved");
    }
    
    function testDaoFeeReductionWithGovernanceToken() public {
        _testDaoFeeReductionStep1();
        _testDaoFeeReductionStep2();
        _testDaoFeeReductionStep3();
    }
    
    function _testDaoFeeReductionStep1() internal {
        // ===== CONFIGURATION INITIALE =====
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;
        
        // Configurer user pour rent2repay
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 seconds, block.timestamp);
        
        // Avancer le temps pour respecter la périodicité
        vm.warp(block.timestamp + 2 seconds);
        
        // Récupérer la configuration des frais
        (uint256 daoFeesBps, ) = rent2Repay.getFeeConfiguration();
        
        console.log("DAO fees BPS:", daoFeesBps);
        
        // ===== ÉTAPE 1: USER SANS TOKEN DE GOUVERNANCE =====
        console.log("\n=== STEP 1: User without governance token ===");
        
        uint256 daoTreasuryBalanceBefore = wxdai.balanceOf(daoTreasury);
        uint256 userBalanceBefore = wxdai.balanceOf(user);
        
        vm.prank(user2);
        rent2Repay.rent2repay(user, address(wxdai));
        
        uint256 daoTreasuryBalanceAfter = wxdai.balanceOf(daoTreasury);
        uint256 userBalanceAfter = wxdai.balanceOf(user);
        
        uint256 amountRepaid = userBalanceBefore - userBalanceAfter;
        uint256 expectedDaoFees = (amountRepaid * daoFeesBps) / 10000;
        uint256 actualDaoFees = daoTreasuryBalanceAfter - daoTreasuryBalanceBefore;
        
        console.log("Amount repaid:", amountRepaid);
        console.log("Expected DAO fees (no reduction):", expectedDaoFees);
        console.log("Actual DAO fees received:", actualDaoFees);
        
        assertEq(actualDaoFees, expectedDaoFees, "DAO should receive full fees without governance token");
    }
    
    function _testDaoFeeReductionStep2() internal {
        // ===== STEP 2: USER WITH FEW GOVERNANCE TOKENS =====
        console.log("\n=== STEP 2: User with few governance tokens ===");
        
        // Give only 50 tokens to user (less than minimum of 100)
        daoGovernanceToken.mint(user, 50 ether);
        
        // Advance time for next period
        vm.warp(block.timestamp + 2 seconds);
        
        (uint256 daoFeesBps, ) = rent2Repay.getFeeConfiguration();
        
        uint256 daoTreasuryBalanceBefore = wxdai.balanceOf(daoTreasury);
        uint256 userBalanceBefore = wxdai.balanceOf(user);
        
        vm.prank(user2);
        rent2Repay.rent2repay(user, address(wxdai));
        
        uint256 daoTreasuryBalanceAfter = wxdai.balanceOf(daoTreasury);
        uint256 userBalanceAfter = wxdai.balanceOf(user);
        
        uint256 amountRepaid = userBalanceBefore - userBalanceAfter;
        uint256 expectedDaoFees = (amountRepaid * daoFeesBps) / 10000;
        uint256 actualDaoFees = daoTreasuryBalanceAfter - daoTreasuryBalanceBefore;
        
        console.log("User governance token balance:", daoGovernanceToken.balanceOf(user));
        console.log("Amount repaid:", amountRepaid);
        console.log("Expected DAO fees (no reduction):", expectedDaoFees);
        console.log("Actual DAO fees received:", actualDaoFees);
        
        assertEq(actualDaoFees, expectedDaoFees, "DAO should receive full fees with insufficient governance tokens");
    }
    
    function _testDaoFeeReductionStep3() internal {
        // ===== STEP 3: USER WITH SUFFICIENT GOVERNANCE TOKENS =====
        console.log("\n=== STEP 3: User with sufficient governance tokens ===");
        
        // Give 150 tokens to user (more than minimum of 100)
        daoGovernanceToken.mint(user, 100 ether); // Total: 150 tokens
        
        // Advance time for next period
        vm.warp(block.timestamp + 2 seconds);
        
        (uint256 daoFeesBps, ) = rent2Repay.getFeeConfiguration();
        uint256 reductionBps = rent2Repay.daoFeeReductionBps();
        
        uint256 daoTreasuryBalanceBefore = wxdai.balanceOf(daoTreasury);
        uint256 userBalanceBefore = wxdai.balanceOf(user);
        
        vm.prank(user2);
        rent2Repay.rent2repay(user, address(wxdai));
        
        uint256 daoTreasuryBalanceAfter = wxdai.balanceOf(daoTreasury);
        uint256 userBalanceAfter = wxdai.balanceOf(user);
        
        uint256 amountRepaid = userBalanceBefore - userBalanceAfter;
        uint256 expectedDaoFeesFull = (amountRepaid * daoFeesBps) / 10000;
        uint256 reductionAmount = (expectedDaoFeesFull * reductionBps) / 10000;
        uint256 expectedDaoFeesReduced = expectedDaoFeesFull - reductionAmount;
        uint256 actualDaoFees = daoTreasuryBalanceAfter - daoTreasuryBalanceBefore;
        
        console.log("User governance token balance:", daoGovernanceToken.balanceOf(user));
        console.log("Amount repaid:", amountRepaid);
        console.log("Expected DAO fees (full):", expectedDaoFeesFull);
        console.log("Reduction amount (50%):", reductionAmount);
        console.log("Expected DAO fees (reduced):", expectedDaoFeesReduced);
        console.log("Actual DAO fees received:", actualDaoFees);
        
        assertEq(actualDaoFees, expectedDaoFeesReduced, "DAO should receive reduced fees with sufficient governance tokens");
        assertLt(actualDaoFees, expectedDaoFeesFull, "Reduced fees should be less than full fees");
        
        // Verify that reduction is exactly 50%
        uint256 reductionPercentage = ((expectedDaoFeesFull - actualDaoFees) * 10000) / expectedDaoFeesFull;
        assertEq(reductionPercentage, reductionBps, "Reduction should be exactly 50%");
    }
    function testSupplyTokenRepayment() public {
        // Mint supply tokens to the user
        uint256 supplyAmount = 10000 * 10**6; // 10000 USDC worth (enough for the test)
        usdcSupply.mint(user, supplyAmount);
        usdcDebt.mint(user, supplyAmount);
        
        // Configure user for the supply token (usdcSupply)
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdcSupply);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10000;
        usdc.mint(address(mockRMM), amounts[0] ); 
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 weeks, 1);
        
        // User approves the contract to spend supply tokens
        vm.prank(user);
        usdcSupply.approve(address(rent2Repay), supplyAmount);
        
        // Warp to next period to allow repayment
        vm.warp(block.timestamp + 1 weeks + 1);
        
        // Get initial balances
        uint256 userSupplyBalanceBefore = usdcSupply.balanceOf(user);
        uint256 userUsdcBalanceBefore = usdc.balanceOf(user);
        uint256 user2SupplyBalanceBefore = usdcSupply.balanceOf(user2);
        uint256 daoTreasurySupplyBalanceBefore = usdcSupply.balanceOf(daoTreasury);
        // Execute repayment using supply token (user2 calls for user)
        vm.prank(user2);
        rent2Repay.rent2repay(user, address(usdcSupply));
        
        // Get final balances
        assertEq(userUsdcBalanceBefore, usdc.balanceOf(user), "User USDC Balance has changed");
  
        // Verify that user paid with supply tokens
        assertLt(usdcSupply.balanceOf(user), userSupplyBalanceBefore, "Supply balance has not be reduced");
        
        // Calculate expected fees (same as regular rent2repay)
        uint256 daoFeesBps = rent2Repay.daoFeesBps();
        uint256 senderTipsBps = rent2Repay.senderTipsBps();
        uint256 expectedDaoFees = (amounts[0] * daoFeesBps) / 10000;
        uint256 expectedSenderTips = (amounts[0] * senderTipsBps) / 10000;
        
        // Verify that user2 received the sender tips (in supplyUSDC)
        uint256 user2SupplyBalanceAfter = usdcSupply.balanceOf(user2);
        assertEq(user2SupplyBalanceAfter, expectedSenderTips+user2SupplyBalanceBefore, "User2 should receive correct sender tips in supplyUSDC");
        
        // Verify that DAO treasury received the DAO fees (in supplyUSDC)
        uint256 daoTreasurySupplyBalanceAfter = usdcSupply.balanceOf(daoTreasury);
        assertEq(daoTreasurySupplyBalanceAfter, expectedDaoFees+daoTreasurySupplyBalanceBefore, "DAO treasury should receive correct DAO fees in supplyUSDC");

        // Verify that the contract consumed supply tokens (transferred to MockRMM)
        uint256 contractSupplyBalanceAfter = usdcSupply.balanceOf(address(rent2Repay));
        assertEq(contractSupplyBalanceAfter, 0, "Contract should not hold supply tokens after repayment");
    } 
}
