// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRMM
 * @notice Interface for Risk Management Module (RMM) repayment functionality
 * @dev Based on the RMM contract functionality for debt repayment
 */
interface IRMM {
    /**
     * @notice Repays debt on behalf of a borrower
     * @param asset The address of the asset being repaid
     * @param amount The amount to repay (use type(uint256).max for full repayment)
     * @param interestRateMode The interest rate mode: 1 for Stable, 2 for Variable
     * @param onBehalfOf The address of the borrower whose debt is being repaid
     * @return The final amount repaid
     */
    function repay(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        address onBehalfOf
    ) external returns (uint256);

    /**
     * @notice Withdraws supply tokens on behalf of a user
     * @param asset The address of the asset being withdrawn
     * @param amount The amount to withdraw
     * @param to The address to send the withdrawn tokens to
     * @return The final amount withdrawn
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);
} 