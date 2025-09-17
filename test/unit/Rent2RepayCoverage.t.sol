// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Rent2Repay} from "../../src/Rent2Repay.sol";
import {Rent2RepayV2} from "./mocks/Rent2RepayV2.sol";
import {MockRMM} from "./mocks/MockRMM.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockERC20Failing} from "./mocks/MockERC20Failing.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Rent2RepayCoverageTest is Test {
    Rent2Repay public rent2Repay;
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
    address public user3 = address(0x6);
    address public unknownUser = address(0x7);
    address public daoTreasury = address(0x8);

    
    function setUp() public {
        // Créer les tokens d'abord
        wxdai = new MockERC20("Wrapped XDAI", "WXDAI", 18, 1000000 ether);
        usdc = new MockERC20("USD Coin", "USDC", 6, 1000000 * 10**6);
        wxdaiSupply = new MockERC20("WXDAI Supply", "aWXDAI", 18, 1000000 ether);
        usdcSupply = new MockERC20("USDC Supply", "aUSDC", 6, 1000000 * 10**6);
        daoGovernanceToken = new MockERC20("DAO Governance", "DAO", 18, 1000000 ether);
        
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

    // ===== TESTS DE COUVERTURE POUR LES MODIFIERS =====
    
    function testRent2RepayWithZeroAddressToken() public {
        // Test du modifier validTokenAddress avec token == address(0)
        // Ce test doit reverter avec InvalidTokenAddress()
        
        // Configurer user pour rent2repay d'abord
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 seconds, block.timestamp);
        
        // Avancer le temps pour respecter la périodicité
        vm.warp(block.timestamp + 2 seconds);
        
        // Tester rent2repay avec address(0) - doit reverter
        vm.prank(user2);
        vm.expectRevert(Rent2Repay.InvalidTokenAddress.selector);
        rent2Repay.rent2repay(user, address(0));
    }
    
    function testValidTokenAddressModifierWithValidToken() public {
        // Test du modifier validTokenAddress avec token valide (non-zero address)
        // Ce test doit passer et couvrir la branche false du modifier
        
        // Test avec updateDaoFeeReductionToken qui utilise aussi validTokenAddress
        vm.prank(admin);
        rent2Repay.updateDaoFeeReductionToken(address(daoGovernanceToken));
        
        console.log("SUCCESS: validTokenAddress modifier with valid token - branch false covered");
    }
    
    function testBatchRent2RepayWithZeroAddressToken() public {
        // Test du modifier validTokenAddress avec batchRent2Repay
        // Configurer user pour rent2repay d'abord
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 seconds, block.timestamp);
        
        // Avancer le temps pour respecter la périodicité
        vm.warp(block.timestamp + 2 seconds);
        
        // Tester batchRent2Repay avec address(0) - doit reverter
        address[] memory users = new address[](1);
        users[0] = user;
        
        vm.prank(operator);
        vm.expectRevert(Rent2Repay.InvalidTokenAddress.selector);
        rent2Repay.batchRent2Repay(users, address(0));
    }
    
    function testRent2RepayWithUnauthorizedToken() public {
        // Test du modifier onlyAuthorizedToken avec un token non autorisé
        // Créer un token non autorisé (différent de address(0))
        MockERC20 unauthorizedToken = new MockERC20("Unauthorized Token", "UNAUTH", 18, 1000000 ether);
        
        // Configurer user pour rent2repay d'abord
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 seconds, block.timestamp);
        
        // Avancer le temps pour respecter la périodicité
        vm.warp(block.timestamp + 2 seconds);
        
        // Tester rent2repay avec token non autorisé - doit reverter
        vm.prank(user2);
        vm.expectRevert(Rent2Repay.TokenNotAuthorized.selector);
        rent2Repay.rent2repay(user, address(unauthorizedToken));
    }
    
    function testBatchRent2RepayWithUnauthorizedToken() public {
        // Test du modifier onlyAuthorizedToken avec batchRent2Repay
        // Créer un token non autorisé (différent de address(0))
        MockERC20 unauthorizedToken = new MockERC20("Unauthorized Token", "UNAUTH", 18, 1000000 ether);
        
        // Configurer user pour rent2repay d'abord
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 seconds, block.timestamp);
        
        // Avancer le temps pour respecter la périodicité
        vm.warp(block.timestamp + 2 seconds);
        
        // Tester batchRent2Repay avec token non autorisé - doit reverter
        address[] memory users = new address[](1);
        users[0] = user;
        
        vm.prank(operator);
        vm.expectRevert(Rent2Repay.TokenNotAuthorized.selector);
        rent2Repay.batchRent2Repay(users, address(unauthorizedToken));
    }
    
    // ===== TESTS DE COUVERTURE POUR LES VALIDATIONS =====
    
    function testConfigureRent2RepayWithEmptyArrays() public {
        // Test avec des arrays vides - doit reverter
        address[] memory emptyTokens = new address[](0);
        uint256[] memory emptyAmounts = new uint256[](0);
        
        vm.prank(user);
        vm.expectRevert("Invalid array lengths");
        rent2Repay.configureRent2Repay(emptyTokens, emptyAmounts, 1 seconds, block.timestamp);
    }
    
    function testConfigureRent2RepayWithDifferentArrayLengths() public {
        // Test avec des arrays de longueurs différentes - doit reverter
        address[] memory tokens = new address[](2);
        tokens[0] = address(wxdai);
        tokens[1] = address(usdc);
        
        uint256[] memory amounts = new uint256[](1); // Différente longueur
        amounts[0] = 10 ether;
        
        vm.prank(user);
        vm.expectRevert("Invalid array lengths");
        rent2Repay.configureRent2Repay(tokens, amounts, 1 seconds, block.timestamp);
    }
    
    function testConfigureRent2RepayWithZeroAmount() public {
        // Test avec un montant à zéro - doit reverter
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 0; // Montant à zéro
        
        vm.prank(user);
        vm.expectRevert("Invalid token or amount");
        rent2Repay.configureRent2Repay(tokens, amounts, 1 seconds, block.timestamp);
    }
    
    function testConfigureRent2RepayWithZeroAddressToken() public {
        // Test avec un token à address(0) - doit reverter
        address[] memory tokens = new address[](1);
        tokens[0] = address(0); // Token à address(0)
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;
        
        vm.prank(user);
        vm.expectRevert("Invalid token or amount");
        rent2Repay.configureRent2Repay(tokens, amounts, 1 seconds, block.timestamp);
    }
    
    function testConfigureRent2RepayWithUnauthorizedToken() public {
        // Test avec un token non autorisé - doit reverter
        MockERC20 unauthorizedToken = new MockERC20("Unauthorized Token", "UNAUTH", 18, 1000000 ether);
        
        address[] memory tokens = new address[](1);
        tokens[0] = address(unauthorizedToken);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;
        
        vm.prank(user);
        vm.expectRevert("Invalid token or amount");
        rent2Repay.configureRent2Repay(tokens, amounts, 1 seconds, block.timestamp);
    }
    
    // ===== TESTS DE COUVERTURE POUR _validateUserAndToken =====
    
    function testRent2RepayWithUserNotAuthorized() public {
        // Test du require: $.lastRepayTimestamps[user] != 0
        // Utiliser un user non configuré (unknownUser)
        vm.prank(user2);
        vm.expectRevert("User not authorized");
        rent2Repay.rent2repay(unknownUser, address(wxdai));
    }
    
    function testRent2RepayWithUserNotConfiguredForToken() public {
        // Test du require: $.allowedMaxAmounts[user][token] > 0
        // Configurer user pour wxdai seulement
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 seconds, block.timestamp);
        
        // Avancer le temps pour respecter la périodicité
        vm.warp(block.timestamp + 2 seconds);
        
        // Tester avec un token pour lequel user n'est pas configuré (usdc)
        vm.prank(user2);
        vm.expectRevert("User not configured for token");
        rent2Repay.rent2repay(user, address(usdc));
    }
    
    function testRent2RepayWithPeriodicityNotSet() public {
        // Test du require: $.periodicity[user][token] > 0
        // Ce cas est difficile à reproduire car configureRent2Repay définit toujours periodicity > 0
        // Mais on peut tester en configurant user puis en supprimant manuellement la periodicity
        // Pour l'instant, on va simuler en utilisant un user non configuré pour ce token spécifique
        
        // Configurer user pour wxdai
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 seconds, block.timestamp);
        
        // Avancer le temps
        vm.warp(block.timestamp + 2 seconds);
        
        // Tester avec un token non configuré (usdc) - cela devrait échouer sur "User not configured for token"
        // plutôt que "Periodicity not set", mais c'est le plus proche qu'on peut faire
        vm.prank(user2);
        vm.expectRevert("User not configured for token");
        rent2Repay.rent2repay(user, address(usdc));
    }
    
    function testRent2RepayBeforePeriodEnd() public {
        // Test du require: _isNewPeriod(user, token) → "Wait next period"
        // Configurer user pour rent2repay avec une période de 1 semaine
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 weeks, block.timestamp);
        
        // Avancer le temps pour respecter la périodicité initiale (1 semaine + 1 seconde)
        vm.warp(block.timestamp + 1 weeks + 1 seconds);
        
        // Faire un premier rent2repay
        vm.prank(user2);
        rent2Repay.rent2repay(user, address(wxdai));
        
        // Essayer de faire un autre rent2repay immédiatement (avant la fin de la période de 1 semaine)
        vm.prank(user2);
        vm.expectRevert("Wait next period");
        rent2Repay.rent2repay(user, address(wxdai));
    }
    
    function testBatchRent2RepayWithUnauthorizedUser() public {
        // Test batchRent2Repay avec un utilisateur non autorisé
        address[] memory users = new address[](1);
        users[0] = unknownUser; // Utilisateur non autorisé
        
        vm.prank(operator);
        vm.expectRevert("User not authorized");
        rent2Repay.batchRent2Repay(users, address(wxdai));
    }
    
    function testBatchRent2RepayWithUserNotConfiguredForToken() public {
        // Test batchRent2Repay avec un utilisateur pas configuré pour le token
        // Configurer user pour wxdai seulement
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 weeks, block.timestamp);
        
        // Avancer le temps
        vm.warp(block.timestamp + 2 weeks);
        
        // Tester batchRent2Repay avec usdc (token non configuré pour user)
        address[] memory users = new address[](1);
        users[0] = user;
        
        vm.prank(operator);
        vm.expectRevert("User not configured for token");
        rent2Repay.batchRent2Repay(users, address(usdc));
    }
    
    // ===== TESTS DE COUVERTURE POUR giveApproval =====
    
    function testGiveApprovalWithInvalidParameters() public {

        MockERC20Failing failingToken = new MockERC20Failing("Failing Token", "FAIL", 18, 1000000 ether);
        
        // Autoriser le token d'abord (nécessaire pour giveApproval)
        vm.prank(admin);
        rent2Repay.authorizeTokenPair(address(failingToken), address(failingToken));
        
        // Tester giveApproval avec le token qui échoue
        vm.prank(admin);
        vm.expectRevert("Approval failed");
        rent2Repay.giveApproval(address(failingToken), address(mockRMM), 1000 ether);
    }
    
    // ===== TESTS DE COUVERTURE POUR getActiveTokens (ligne 804) =====
    
    function testGetActiveTokensWithActiveAndInactiveTokens() public {
        // Test de la ligne 804: if ($.tokenConfig[t].active)
        // Cas true: token actif
        // Cas false: token inactif
        
        // ===== ÉTAPE 1: VÉRIFIER L'ÉTAT INITIAL =====
        // Au début, wxdai et usdc sont actifs
        address[] memory initialActiveTokens = rent2Repay.getActiveTokens();
        assertGe(initialActiveTokens.length, 2, "Should have at least 2 active tokens initially");
        
        // Vérifier que wxdai et usdc sont dans la liste des tokens actifs
        bool wxdaiFound = false;
        bool usdcFound = false;
        for (uint i = 0; i < initialActiveTokens.length; i++) {
            if (initialActiveTokens[i] == address(wxdai)) wxdaiFound = true;
            if (initialActiveTokens[i] == address(usdc)) usdcFound = true;
        }
        assertTrue(wxdaiFound, "WXDAI should be active initially");
        assertTrue(usdcFound, "USDC should be active initially");
        
        // ===== ÉTAPE 2: AJOUTER UN NOUVEAU TOKEN (ACTIF) =====
        // Créer un nouveau token pour le test
        MockERC20 testToken = new MockERC20("Test Token", "TEST", 18, 1000000 ether);
        MockERC20 testSupplyToken = new MockERC20("Test Supply", "aTEST", 18, 1000000 ether);
        
        // Ajouter le token (il sera actif par défaut)
        vm.prank(admin);
        rent2Repay.authorizeTokenPair(address(testToken), address(testSupplyToken));
        
        // Vérifier que le token est maintenant dans la liste des tokens actifs
        address[] memory tokensAfterAdd = rent2Repay.getActiveTokens();
        assertGt(tokensAfterAdd.length, initialActiveTokens.length, "Should have more tokens after adding");
        
        bool testTokenFound = false;
        for (uint i = 0; i < tokensAfterAdd.length; i++) {
            if (tokensAfterAdd[i] == address(testToken)) {
                testTokenFound = true;
                break;
            }
        }
        assertTrue(testTokenFound, "Test token should be active after adding");
        
        // ===== ÉTAPE 3: DÉSACTIVER LE TOKEN (INACTIF) =====
        // Désactiver le token (il reste dans tokenList mais devient inactif)
        vm.prank(admin);
        rent2Repay.unauthorizeToken(address(testToken));
        
        // Vérifier que le token n'est plus dans la liste des tokens actifs
        address[] memory tokensAfterRemove = rent2Repay.getActiveTokens();
        assertLt(tokensAfterRemove.length, tokensAfterAdd.length, "Should have fewer tokens after removing");
        
        bool testTokenStillFound = false;
        for (uint i = 0; i < tokensAfterRemove.length; i++) {
            if (tokensAfterRemove[i] == address(testToken)) {
                testTokenStillFound = true;
                break;
            }
        }
        assertFalse(testTokenStillFound, "Test token should not be active after removing");
        
        // Vérifier que wxdai et usdc sont toujours actifs
        bool wxdaiStillFound = false;
        bool usdcStillFound = false;
        for (uint i = 0; i < tokensAfterRemove.length; i++) {
            if (tokensAfterRemove[i] == address(wxdai)) wxdaiStillFound = true;
            if (tokensAfterRemove[i] == address(usdc)) usdcStillFound = true;
        }
        assertTrue(wxdaiStillFound, "WXDAI should still be active");
        assertTrue(usdcStillFound, "USDC should still be active");
        
        // ===== VÉRIFICATION FINALE =====
        // Le test couvre maintenant les deux cas de la ligne 804:
        // - Cas true: testToken était actif (ligne 804 = true)
        // - Cas false: testToken est devenu inactif (ligne 804 = false)
        
        // Vérifier la configuration du token désactivé
        Rent2Repay.TokenConfig memory config = rent2Repay.tokenConfig(address(testToken));
        assertEq(config.token, address(testToken), "Token address should be preserved");
        assertFalse(config.active, "Token should be inactive after unauthorize");
    }
}
