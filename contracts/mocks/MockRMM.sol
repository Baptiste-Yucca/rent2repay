// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockRMM
 * @notice A mock Risk Management Module for testing debt repayment functionality
 * @dev This contract simulates a lending protocol's debt management for testing purposes
 * It tracks user debts and allows repayments via token transfers
 */
contract MockRMM {
    /// @notice Maps borrower addresses to their debt amounts per asset
    mapping(address => mapping(address => uint256)) public debts;
    
    /// @notice Event emitted when a repayment is made
    event RepaymentMade(
        address indexed asset, 
        uint256 amount, 
        address indexed onBehalfOf, 
        address indexed caller
    );

    /**
     * @notice Allows repayment of debt for a specific borrower
     * @dev Transfers tokens from the caller to this contract and reduces the borrower's debt
     * @param asset The asset being repaid (token address)
     * @param amount The amount of debt to repay
     * @param interestRateMode The interest rate mode (ignored in mock, for compatibility)
     * @param onBehalfOf The address of the borrower whose debt is being repaid
     * @return The final amount repaid
     */
    function repay(
        address asset, 
        uint256 amount, 
        uint256 interestRateMode,
        address onBehalfOf
    ) external returns (uint256) {
        IERC20 token = IERC20(asset);
        
        // Transfer tokens from caller to this contract
        bool success = token.transferFrom(msg.sender, address(this), amount);
        require(success, "Token transfer failed");
        
        // Reduce the borrower's debt (ensure sufficient debt exists)
        require(debts[onBehalfOf][asset] >= amount, "Insufficient debt to repay");
        debts[onBehalfOf][asset] -= amount;
        
        emit RepaymentMade(asset, amount, onBehalfOf, msg.sender);
        
        // Return the amount actually repaid
        return amount;
    }

    /**
     * @notice Sets the debt amount for a specific borrower and asset
     * @dev This function is used for testing purposes to simulate borrowing
     * @param borrower The address of the borrower
     * @param asset The asset for which to set debt
     * @param amount The debt amount to set
     */
    function setDebt(address borrower, address asset, uint256 amount) external {
        debts[borrower][asset] = amount;
    }
    
    /**
     * @notice Gets the debt amount for a specific borrower and asset
     * @param borrower The address of the borrower
     * @param asset The asset to check debt for
     * @return The debt amount
     */
    function getDebt(address borrower, address asset) external view returns (uint256) {
        return debts[borrower][asset];
    }
} 