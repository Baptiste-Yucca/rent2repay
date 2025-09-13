// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Rent2RepayHarness} from "./harness/Rent2RepayHarness.sol";
import {Rent2Repay} from "../../src/Rent2Repay.sol";
import {MockRMM} from "./mocks/MockRMM.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Rent2RepayHarnessSimpleTest is Test {
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
        
        // Configurer le MockRMM
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
        
        // Deploy avec proxy normal
        Rent2RepayHarness implementation = new Rent2RepayHarness();
        bytes memory initData = abi.encodeWithSelector(
            Rent2Repay.initialize.selector,
            admin, emergency, operator, address(mockRMM),
            address(wxdai), address(wxdaiSupply),
            address(usdc), address(usdcSupply)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        rent2Repay = Rent2RepayHarness(address(proxy));
        
        // Setup user
        wxdai.mint(user, 1000 ether);
        wxdaiDebt.mint(user, 100 ether);
        usdcDebt.mint(user, 100 * 10**6);
        
        vm.prank(user);
        wxdai.approve(address(rent2Repay), type(uint256).max);
        vm.prank(user);
        wxdaiDebt.approve(address(mockRMM), type(uint256).max);
        vm.prank(user);
        usdcDebt.approve(address(mockRMM), type(uint256).max);
        
        // Configurer DAO
        vm.prank(admin);
        rent2Repay.updateDaoTreasuryAddress(daoTreasury);
        vm.prank(admin);
        rent2Repay.updateDaoFeeReductionToken(address(daoGovernanceToken));
        vm.prank(admin);
        rent2Repay.updateDaoFeeReductionMinimumAmount(100 ether);
        vm.prank(admin);
        rent2Repay.updateDaoFeeReductionPercentage(5000);
    }

    
    function testCalculateFeesWithValidFees() public {
        // Créer un nouveau contrat avec des frais valides pour comparaison
        Rent2RepayHarness implementation2 = new Rent2RepayHarness();
        bytes memory initData2 = abi.encodeWithSelector(
            Rent2Repay.initialize.selector,
            admin, emergency, operator, address(mockRMM),
            address(wxdai), address(wxdaiSupply),
            address(usdc), address(usdcSupply)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(implementation2), initData2);
        Rent2RepayHarness rent2RepayValid = Rent2RepayHarness(address(proxy2));
        
        // Définir des frais valides
        vm.prank(admin);
        rent2RepayValid.updateDaoFees(5000); // 50% DAO fees
        vm.prank(admin);
        rent2RepayValid.updateSenderTips(3000); // 30% sender tips
        // Total: 50% + 30% = 80% < 100% - VALIDE
        
        uint256 amount = 100 ether;
        
        console.log("\n=== TEST: totalFees < amount (cas valide) ===");
        console.log("DAO fees BPS:", rent2RepayValid.daoFeesBps());
        console.log("Sender tips BPS:", rent2RepayValid.senderTipsBps());
        console.log("Total BPS:", rent2RepayValid.daoFeesBps() + rent2RepayValid.senderTipsBps());
        
        // Vérifier que les frais sont < 100%
        assertLt(rent2RepayValid.daoFeesBps() + rent2RepayValid.senderTipsBps(), 10000, "Total fees should be < 100%");
        
        // Tester _calculateFees avec des frais valides
        (uint256 daoFees, uint256 senderTips, uint256 amountForRepayment) = 
            rent2RepayValid.exposed_calculateFees(amount, user);
        
        console.log("DAO fees:", daoFees);
        console.log("Sender tips:", senderTips);
        console.log("Amount for repayment:", amountForRepayment);
        
        // Vérifier que le calcul est correct
        assertGt(daoFees, 0, "DAO fees should be > 0");
        assertGt(senderTips, 0, "Sender tips should be > 0");
        assertLt(amountForRepayment, amount, "Amount for repayment should be < total");
        assertEq(daoFees + senderTips + amountForRepayment, amount, "Total should equal amount");
        
        console.log("SUCCESS: _calculateFees worked correctly with valid fees");
        console.log("COVERAGE: Branche 'totalFees <= amount' testee avec succes !");
    }
}
