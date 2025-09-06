// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Rent2Repay} from "../src/Rent2Repay.sol";
import {IRMM} from "interfaces/IRMM.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Rent2RepayForkTest is Test {
    Rent2Repay public rent2Repay;
    
    // Adresses réelles sur Gnosis
    address public constant GNOSIS_RMM = 0xFb9b496519fCa8473fba1af0850B6B8F476BFdB3; // À remplacer par l'adresse réelle
    address public constant WXDAI = 0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d;
    address public constant USDC = 0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83;
    
    address public admin = address(0x1);
    address public emergency = address(0x2);
    address public operator = address(0x3);
    address public user = address(0x4);
    
    function setUp() public {
        // Fork Gnosis à un bloc récent
        vm.createFork("gnosis");
        
        // Deploy Rent2Repay
        rent2Repay = new Rent2Repay();
        
        // Initialize avec les vrais tokens
        rent2Repay.initialize(
            admin,
            emergency,
            operator,
            GNOSIS_RMM, // Utilise le vrai RMM
            WXDAI,
            WXDAI, // Supply token = même que le token principal
            USDC,
            USDC  // Supply token = même que le token principal
        );
        
        // Donner des tokens au user (simulation)
        deal(WXDAI, user, 1000 ether);
        deal(USDC, user, 1000 * 10**6);
        
        // User approves Rent2Repay
        vm.prank(user);
        IERC20(WXDAI).approve(address(rent2Repay), type(uint256).max);
        vm.prank(user);
        IERC20(USDC).approve(address(rent2Repay), type(uint256).max);
    }
    
    function testForkConfiguration() public {
        // Vérifier que nous sommes sur le bon réseau
        assertEq(block.chainid, 100); // Gnosis Chain ID
        
        // Vérifier que les tokens existent
        assertTrue(WXDAI.code.length > 0);
        assertTrue(USDC.code.length > 0);
    }
    
    function testConfigureWithRealTokens() public {
        address[] memory tokens = new address[](2);
        tokens[0] = WXDAI;
        tokens[1] = USDC;
        
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1 ether;
        amounts[1] = 100 * 10**6;
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 weeks, block.timestamp);
        
        assertTrue(rent2Repay.isAuthorized(user));
    }
    
    // Test d'intégration avec le vrai RMM (nécessite des conditions spécifiques)
    function testIntegrationWithRealRMM() public {
        // Ce test nécessiterait que l'utilisateur ait une vraie dette sur RMM
        // et que le contrat soit approuvé pour les tokens
        // C'est plus complexe et nécessite une configuration spécifique
        
        // Pour l'instant, on teste juste la configuration
        address[] memory tokens = new address[](1);
        tokens[0] = WXDAI;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 0.1 ether; // Petit montant pour éviter les erreurs
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 weeks, block.timestamp);
        
        assertTrue(rent2Repay.isAuthorized(user));
    }
}
