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
    /// @notice Maps borrower addresses to their debt amounts
    mapping(address => uint256) public debts;

    /**
     * @notice Allows repayment of debt for a specific borrower
     * @dev Transfers tokens from the caller to this contract and reduces the borrower's debt
     * @param borrower The address of the borrower whose debt is being repaid
     * @param amount The amount of debt to repay
     * @custom:requirements The caller must have approved this contract to spend the tokens
     * @custom:requirements The borrower must have sufficient debt to repay
     */
    function repay(address borrower, uint256 amount) external {
        IERC20(msg.sender).transferFrom(msg.sender, address(this), amount);
        debts[borrower] -= amount;
    }

    /**
     * @notice Sets the debt amount for a specific borrower
     * @dev This function is used for testing purposes to simulate borrowing
     * @param borrower The address of the borrower
     * @param amount The debt amount to set
     */
    function setDebt(address borrower, uint256 amount) external {
        debts[borrower] = amount;
    }
} 