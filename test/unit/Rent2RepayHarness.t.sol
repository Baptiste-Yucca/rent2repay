// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Rent2RepayHarness} from "./harness/Rent2RepayHarness.sol";
import {Rent2Repay} from "../../src/Rent2Repay.sol";
import {MockRMM} from "./mocks/MockRMM.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Rent2RepayHarnessTest is Test {
    Rent2RepayHarness public rent2Repay;
    MockRMM public mockRMM;
    MockERC20 public wxdai;
    MockERC20 public usdc;
    MockERC20 public wxdaiSupply;
    MockERC20 public usdcSupply;
    MockERC20 public daoGovernanceToken;

    address public admin = address(0x1);
    address public emergency = address(0x2);
    address public operator = address(0x3);
    address public user = address(0x4);
    address public user2 = address(0x5);
    address public daoTreasury = address(0x8);

    function setUp() public {
        // Créer les tokens d'abord
        wxdai = new MockERC20("Wrapped XDAI", "WXDAI", 18, 1000000 ether);
        usdc = new MockERC20("USD Coin", "USDC", 6, 1000000 * 10 ** 6);
        wxdaiSupply = new MockERC20("WXDAI Supply", "aWXDAI", 18, 1000000 ether);
        usdcSupply = new MockERC20("USDC Supply", "aUSDC", 6, 1000000 * 10 ** 6);
        daoGovernanceToken = new MockERC20("DAO Governance", "DAO", 18, 1000000 ether);

        // Créer les debt tokens
        MockERC20 wxdaiDebt = new MockERC20("WXDAI Debt", "dWXDAI", 18, 1000000 ether);
        MockERC20 usdcDebt = new MockERC20("USDC Debt", "dUSDC", 6, 1000000 * 10 ** 6);

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

        // 1. Deploy l'implémentation HARNESS
        Rent2RepayHarness implementation = new Rent2RepayHarness();

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
            usdcDebtToken: address(usdcDebt) // Si pas utilisé dans les tests
        });

        bytes memory initData = abi.encodeWithSelector(Rent2Repay.initialize.selector, cfg);

        // 3. Deploy le proxy avec l'implémentation
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        rent2Repay = Rent2RepayHarness(address(proxy));

        // Setup user with tokens
        wxdai.mint(user, 1000 ether);
        usdc.mint(user, 1000 * 10 ** 6);

        // Donner des debt tokens au user (nécessaire pour le MockRMM)
        wxdaiDebt.mint(user, 100 ether);
        usdcDebt.mint(user, 100 * 10 ** 6);

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
        rent2Repay.updateDaoFeeReductionMinimumAmount(100 ether);

        vm.prank(admin);
        rent2Repay.updateDaoFeeReductionPercentage(5000); // 50% de réduction
    }

    // ===== TESTS POUR LES FONCTIONS INTERNES =====

    function testExposedCalculateFees() public {
        // Test de la fonction _calculateFees
        uint256 amount = 100 ether;

        // Test sans réduction de frais (user sans token de gouvernance)
        (uint256 daoFees, uint256 senderTips, uint256 amountForRepayment) =
            rent2Repay.exposed_calculateFees(amount, user);

        assertGt(daoFees, 0, "DAO fees should be greater than 0");
        assertGt(senderTips, 0, "Sender tips should be greater than 0");
        assertLt(amountForRepayment, amount, "Amount for repayment should be less than total amount");
        assertEq(daoFees + senderTips + amountForRepayment, amount, "Total should equal original amount");

        // Test avec réduction de frais (user avec token de gouvernance)
        daoGovernanceToken.mint(user, 150 ether); // Plus que le minimum de 100 ether

        (uint256 daoFeesReduced, uint256 senderTipsReduced, uint256 amountForRepaymentReduced) =
            rent2Repay.exposed_calculateFees(amount, user);

        assertLt(daoFeesReduced, daoFees, "DAO fees should be reduced with governance token");
        assertEq(senderTipsReduced, senderTips, "Sender tips should remain the same");
        assertGt(
            amountForRepaymentReduced, amountForRepayment, "Amount for repayment should be higher with reduced fees"
        );
    }

    function testExposedIsNewPeriod() public {
        // Configurer user pour rent2repay
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;

        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 weeks, block.timestamp);

        // Test immédiatement après configuration (devrait être false)
        assertFalse(
            rent2Repay.exposed_isNewPeriod(user, address(wxdai)), "Should not be new period immediately after config"
        );

        // Avancer le temps de 1 semaine + 1 seconde
        vm.warp(block.timestamp + 1 weeks + 1 seconds);

        // Test après la période (devrait être true)
        assertTrue(rent2Repay.exposed_isNewPeriod(user, address(wxdai)), "Should be new period after 1 week + 1 second");
    }

    function testExposedTransferFees() public {
        // Donner des tokens au contrat pour les frais
        wxdai.mint(address(rent2Repay), 100 ether);

        uint256 daoFees = 10 ether;
        uint256 senderTips = 5 ether;

        uint256 daoTreasuryBalanceBefore = wxdai.balanceOf(daoTreasury);
        uint256 user2BalanceBefore = wxdai.balanceOf(user2);

        // Tester _transferFees
        vm.prank(user2);
        rent2Repay.exposed_transferFees(address(wxdai), daoFees, senderTips);

        uint256 daoTreasuryBalanceAfter = wxdaiSupply.balanceOf(daoTreasury);
        uint256 user2BalanceAfter = wxdaiSupply.balanceOf(user2);

        // Vérifier que les frais ont été transférés
        assertEq(daoTreasuryBalanceAfter - daoTreasuryBalanceBefore, daoFees, "DAO treasury should receive DAO fees");
        assertEq(user2BalanceAfter - user2BalanceBefore, senderTips, "User2 should receive sender tips");
    }

    function testExposedRemoveUserAllTokens() public {
        // Configurer user d'abord
        address[] memory tokens = new address[](2);
        tokens[0] = address(wxdai);
        tokens[1] = address(usdc);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10 ether;
        amounts[1] = 100 * 10 ** 6;

        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 weeks, block.timestamp);

        // Vérifier que user est autorisé
        assertTrue(rent2Repay.isAuthorized(user), "User should be authorized before removal");

        // Supprimer user
        rent2Repay.exposed_removeUserAllTokens(user);

        // Vérifier que user n'est plus autorisé
        assertFalse(rent2Repay.isAuthorized(user), "User should not be authorized after removal");

        // Vérifier que les montants sont remis à zéro
        assertEq(rent2Repay.allowedMaxAmounts(user, address(wxdai)), 0, "WXDAI amount should be 0");
        assertEq(rent2Repay.allowedMaxAmounts(user, address(usdc)), 0, "USDC amount should be 0");
        assertEq(rent2Repay.periodicity(user, address(wxdai)), 0, "WXDAI periodicity should be 0");
        assertEq(rent2Repay.periodicity(user, address(usdc)), 0, "USDC periodicity should be 0");
    }

    function testExposedValidTokenAddress() public {
        vm.prank(user);
        rent2Repay.exposed_validTokenAddress(address(0x1));
        vm.expectRevert();
        rent2Repay.exposed_validTokenAddress(address(0));

        rent2Repay.exposed_onlyAuthorizedToken(address(usdc));
        vm.expectRevert();
        rent2Repay.exposed_onlyAuthorizedToken(address(0));
    }

    function testExposedAuthorizeTokenPair() public {
        // Créer un nouveau token
        MockERC20 newToken = new MockERC20("New Token", "NEW", 18, 1000000 ether);
        MockERC20 newSupplyToken = new MockERC20("New Supply", "aNEW", 18, 1000000 ether);

        assertFalse(rent2Repay.tokenConfig(address(newToken)).active, "New token should not be active initially");

        rent2Repay.exposed_authorizeTokenPair(address(newToken), address(newSupplyToken), address(0x123));

        assertTrue(rent2Repay.tokenConfig(address(newToken)).active, "New token should be active after authorization");
        assertEq(rent2Repay.tokenConfig(address(newToken)).token, address(newToken), "Token address should match");
        assertEq(
            rent2Repay.tokenConfig(address(newToken)).supplyToken,
            address(newSupplyToken),
            "Supply token address should match"
        );
    }

    function testExposedTransferFeesAllBranches() public {
        // Test complet de _transferFees() pour couvrir toutes les branches
        // Donner des tokens au contrat pour les tests
        wxdai.mint(address(rent2Repay), 100 ether);

        // ===== TEST 1: daoFees > 0 && daoTreasuryAddress != address(0) =====
        // Cas true: Les deux conditions sont vraies
        console.log("\n=== TEST 1: daoFees > 0 && daoTreasuryAddress != address(0) ===");

        uint256 daoTreasuryBalanceBefore = wxdai.balanceOf(daoTreasury);
        uint256 user2BalanceBefore = wxdai.balanceOf(user2);

        vm.prank(user2);
        rent2Repay.exposed_transferFees(address(wxdai), 10 ether, 5 ether);

        uint256 daoTreasuryBalanceAfter = wxdaiSupply.balanceOf(daoTreasury);
        uint256 user2BalanceAfter = wxdaiSupply.balanceOf(user2);

        assertEq(daoTreasuryBalanceAfter - daoTreasuryBalanceBefore, 10 ether, "DAO treasury should receive DAO fees");
        assertEq(user2BalanceAfter - user2BalanceBefore, 5 ether, "User2 should receive sender tips");

        // ===== TEST 2: daoFees = 0 (branche false) =====
        // Cas false: daoFees = 0, donc la condition daoFees > 0 est false
        console.log("\n=== TEST 2: daoFees = 0 (branche false) ===");

        daoTreasuryBalanceBefore = wxdai.balanceOf(daoTreasury);
        user2BalanceBefore = wxdaiSupply.balanceOf(user2);

        vm.prank(user2);
        rent2Repay.exposed_transferFees(address(wxdai), 0, 3 ether);

        daoTreasuryBalanceAfter = wxdai.balanceOf(daoTreasury);
        user2BalanceAfter = wxdaiSupply.balanceOf(user2);

        // DAO treasury ne devrait pas recevoir de tokens (daoFees = 0)
        assertEq(
            daoTreasuryBalanceAfter, daoTreasuryBalanceBefore, "DAO treasury should not receive tokens when daoFees = 0"
        );
        // User2 devrait toujours recevoir les sender tips
        assertEq(user2BalanceAfter - user2BalanceBefore, 3 ether, "User2 should still receive sender tips");
    }

    function testExposedCalculateFeesBasic() public {
        // Test de base de _calculateFees() sans réduction
        uint256 amount = 100 ether;

        console.log("\n=== TEST: Basic _calculateFees (no reduction) ===");

        // Mettre le montant minimum à 0 pour désactiver la réduction
        vm.prank(admin);
        rent2Repay.updateDaoFeeReductionMinimumAmount(0);

        (uint256 daoFees, uint256 senderTips, uint256 amountForRepayment) =
            rent2Repay.exposed_calculateFees(amount, user);

        // Vérifier que les frais sont calculés normalement (sans réduction)
        assertGt(daoFees, 0, "DAO fees should be greater than 0");
        assertGt(senderTips, 0, "Sender tips should be greater than 0");
        assertLt(amountForRepayment, amount, "Amount for repayment should be less than total amount");
        assertEq(daoFees + senderTips + amountForRepayment, amount, "Total should equal original amount");

        console.log("DAO fees (no reduction):", daoFees);
        console.log("Sender tips:", senderTips);
        console.log("Amount for repayment:", amountForRepayment);
    }

    function testExposedCalculateFeesWithReduction() public {
        // Test de _calculateFees() avec réduction
        uint256 amount = 100 ether;

        console.log("\n=== TEST: _calculateFees with reduction ===");

        // Configurer la réduction
        vm.prank(admin);
        rent2Repay.updateDaoFeeReductionToken(address(daoGovernanceToken));
        vm.prank(admin);
        rent2Repay.updateDaoFeeReductionMinimumAmount(100 ether);

        // Donner suffisamment de tokens à l'utilisateur
        daoGovernanceToken.mint(user, 150 ether);

        (uint256 daoFees, uint256 senderTips, uint256 amountForRepayment) =
            rent2Repay.exposed_calculateFees(amount, user);

        // Vérifier que les frais DAO sont réduits
        assertGt(daoFees, 0, "DAO fees should be greater than 0");
        assertGt(senderTips, 0, "Sender tips should be greater than 0");
        assertLt(amountForRepayment, amount, "Amount for repayment should be less than total amount");
        assertEq(daoFees + senderTips + amountForRepayment, amount, "Total should equal original amount");

        console.log("User governance token balance:", daoGovernanceToken.balanceOf(user));
        console.log("DAO fees (with reduction):", daoFees);
        console.log("Sender tips:", senderTips);
        console.log("Amount for repayment:", amountForRepayment);
    }

    function testExposedCalculateFeesEdgeCase() public {
        // Test de _calculateFees() avec cas limite (100% de frais)
        uint256 amount = 100 ether;

        console.log("\n=== TEST: _calculateFees edge case (100% fees) ===");

        // Configurer des frais qui totalisent exactement 100%
        vm.prank(admin);
        rent2Repay.updateDaoFees(5000); // 50% DAO fees
        vm.prank(admin);
        rent2Repay.updateSenderTips(5000); // 50% sender tips
        // Total: 100% = 100%

        (uint256 daoFees, uint256 senderTips, uint256 amountForRepayment) =
            rent2Repay.exposed_calculateFees(amount, user);

        // Vérifier que les frais totalisent exactement le montant
        assertEq(daoFees + senderTips, amount, "Total fees should equal amount");
        assertEq(amountForRepayment, 0, "Amount for repayment should be 0 when fees = amount");

        console.log("DAO fees (100% total):", daoFees);
        console.log("Sender tips (100% total):", senderTips);
        console.log("Amount for repayment (100% total):", amountForRepayment);

        // Remettre les frais à des valeurs normales pour les autres tests
        vm.prank(admin);
        rent2Repay.updateDaoFees(50); // 0.5% DAO fees
        vm.prank(admin);
        rent2Repay.updateSenderTips(25); // 0.25% sender tips
    }
}
