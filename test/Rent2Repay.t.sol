// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
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
        
        // 1. Deploy l'implémentation
        Rent2Repay implementation = new Rent2Repay();
        
        // 2. Préparer les données d'initialisation
        bytes memory initData = abi.encodeWithSelector(
            Rent2Repay.initialize.selector,
            admin,
            emergency,
            operator,
            address(mockRMM),
            address(wxdai),
            address(wxdaiSupply),
            address(usdc),
            address(usdcSupply)
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
        address[] memory tokens = new address[](2);
        tokens[0] = address(wxdai);
        tokens[1] = address(usdc);
        
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10 ether;
        amounts[1] = 100 * 10**6;
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 weeks, block.timestamp);
        
        assertTrue(rent2Repay.isAuthorized(user));
        assertEq(rent2Repay.allowedMaxAmounts(user, address(wxdai)), 10 ether);
        assertEq(rent2Repay.allowedMaxAmounts(user, address(usdc)), 100 * 10**6);
    }
    
    function testRent2Repay() public {
        // Configure first
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 weeks, block.timestamp);
        
        // Execute rent2repay
        uint256 balanceBefore = wxdai.balanceOf(user);
        
        vm.prank(operator);
        rent2Repay.rent2repay(user, address(wxdai));
        
        uint256 balanceAfter = wxdai.balanceOf(user);
        assertLt(balanceAfter, balanceBefore);
    }
    
    function testBatchRent2Repay() public {
        // Setup second user
        address user2 = address(0x5);
        wxdai.mint(user2, 1000 ether);
        MockERC20 wxdaiDebt = new MockERC20("WXDAI Debt", "dWXDAI", 18, 1000000 ether);
        MockERC20 usdcDebt = new MockERC20("USDC Debt", "dUSDC", 6, 1000000 * 10**6);
        wxdaiDebt.mint(user2, 50 ether);
        usdcDebt.mint(user2, 50 * 10**6);
        
        vm.prank(user2);
        wxdai.approve(address(rent2Repay), type(uint256).max);
        
        // Configure both users
        address[] memory tokens = new address[](1);
        tokens[0] = address(wxdai);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 5 ether;
        
        vm.prank(user);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 weeks, block.timestamp);
        
        vm.prank(user2);
        rent2Repay.configureRent2Repay(tokens, amounts, 1 weeks, block.timestamp);
        
        // Execute batch
        address[] memory users = new address[](2);
        users[0] = user;
        users[1] = user2;
        
        vm.prank(operator);
        rent2Repay.batchRent2Repay(users, address(wxdai));
        
        // Both users should have been processed
        assertTrue(rent2Repay.isAuthorized(user));
        assertTrue(rent2Repay.isAuthorized(user2));
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
}
