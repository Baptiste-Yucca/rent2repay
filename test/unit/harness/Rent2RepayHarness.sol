// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../../src/Rent2Repay.sol";

/**
 * @title Rent2RepayHarness
 * @notice Harness contract for testing internal functions of Rent2Repay
 * @dev This contract exposes internal/private functions for testing purposes
 */
contract Rent2RepayHarness is Rent2Repay {
    /// @dev Local copy du getter storage - same as the main contract
    /// @dev can oly be used to  coverage tests
    function _getHarnessStorage() private pure returns (Rent2RepayStorage storage s) {
        assembly {
            s.slot := 0x52C63247E1F47d19d5ce046630c49f7C67dcaEcfb71ba98eedaab2ebca6e0
        }
    }

    function exposed_validTokenAddress(address token) external validTokenAddress(token) {
        // rien, on veut juste tester le modifier
    }

    function exposed_onlyAuthorizedToken(address token) external onlyAuthorizedToken(token) {
        // rien, on veut juste tester le modifier
    }

    /**
     * @notice Exposes the internal _transferFees function for testing
     * @param token The token address
     * @param daoFees The DAO fees amount
     * @param senderTips The sender tips amount
     */
    function exposed_transferFees(address token, uint256 daoFees, uint256 senderTips) external {
        Rent2RepayStorage storage s = _getHarnessStorage();
        _transferFees(s, token, daoFees, senderTips);
    }

    /**
     * @notice Exposes the internal _processUserRepayment function for testing
     * @param user The user address
     * @param token The token address
     * @return adjustedDaoFees The DAO fees after adjustment
     * @return senderTips The sender tips amount
     * @return actualAmountRepaid The actual amount repaid to RMM
     */
    function exposed_processUserRepayment(address user, address token)
        external
        returns (uint256 adjustedDaoFees, uint256 senderTips, uint256 actualAmountRepaid)
    {
        Rent2RepayStorage storage s = _getHarnessStorage();
        return _processUserRepayment(s, user, token);
    }

    /**
     * @notice Exposes the internal _handleTokenTransferAndFees function for testing
     * @param user The user address
     * @param token The token address
     * @return daoFees The calculated DAO fees
     * @return senderTips The calculated sender tips
     * @return amountForRepayment The amount to be used for repayment
     */
    function exposed_handleTokenTransferAndFees(address user, address token)
        external
        returns (uint256 daoFees, uint256 senderTips, uint256 amountForRepayment)
    {
        Rent2RepayStorage storage s = _getHarnessStorage();
        return _handleTokenTransferAndFees(s, user, token);
    }

    /**
     * @notice Exposes the internal _handleRmmRepayment function for testing
     * @param user The user address
     * @param token The token address
     * @param daoFees The DAO fees amount
     * @param amountForRepayment The amount to be used for repayment
     * @return actualAmountRepaid The actual amount repaid to RMM
     * @return adjustedDaoFees The DAO fees after adjustment
     */
    function exposed_handleRmmRepayment(address user, address token, uint256 daoFees, uint256 amountForRepayment)
        external
        returns (uint256 actualAmountRepaid, uint256 adjustedDaoFees)
    {
        Rent2RepayStorage storage s = _getHarnessStorage();
        return _handleRmmRepayment(s, user, token, daoFees, amountForRepayment);
    }

    /**
     * @notice Exposes the internal _calculateFees function for testing
     * @param amount The amount to calculate fees for
     * @param user The user address to check for DAO fee reduction
     * @return daoFees The DAO fees amount
     * @return senderTips The sender tips amount
     * @return amountForRepayment The amount remaining for repayment
     */
    function exposed_calculateFees(uint256 amount, address user)
        external
        view
        returns (uint256 daoFees, uint256 senderTips, uint256 amountForRepayment)
    {
        Rent2RepayStorage storage s = _getHarnessStorage();
        return _calculateFees(s, amount, user);
    }

    /**
     * @notice Exposes the internal _isNewPeriod function for testing
     * @param _user The user address
     * @param _token The token address
     * @return true if more than a week has passed since lastTimestamp
     */
    function exposed_isNewPeriod(address _user, address _token) external view returns (bool) {
        return _isNewPeriod(_user, _token);
    }

    /**
     * @notice Exposes the internal _removeUserAllTokens function for testing
     * @param user The user to remove
     */
    function exposed_removeUserAllTokens(address user) external {
        _removeUserAllTokens(user);
    }

    /**
     * @notice Exposes the internal _authorizeTokenPair function for testing
     * @param token The token address to authorize
     * @param supplyToken The supply token address associated with the token
     */
    function exposed_authorizeTokenPair(address token, address supplyToken, address debtToken) external {
        _authorizeTokenPair(token, supplyToken, debtToken);
    }

    /**
     * @notice Fake updateDaoFees function that bypasses validation for testing
     * @param newFeesBps New DAO fees in basis points (can be > 10000 for testing)
     */
    function fake_updateDaoFees(uint256 newFeesBps) external {
        // Bypass the normal validation by temporarily setting senderTips to 0
        // This allows us to set daoFees to any value, then we can set senderTips back
        // We'll use internal calls to avoid authorization issues
        uint256 originalSenderTips = this.senderTipsBps();

        // Temporarily set senderTips to 0 to bypass validation
        this.updateSenderTips(0);

        // Now we can set daoFees to any value
        this.updateDaoFees(newFeesBps);

        // Restore original senderTips
        this.updateSenderTips(originalSenderTips);
    }

    /**
     * @notice Fake updateSenderTips function that bypasses validation for testing
     * @param newTipsBps New sender tips in basis points (can be > 10000 for testing)
     */
    function fake_updateSenderTips(uint256 newTipsBps) external {
        // Bypass the normal validation by temporarily setting daoFees to 0
        // This allows us to set senderTips to any value, then we can set daoFees back
        // We'll use internal calls to avoid authorization issues
        uint256 originalDaoFees = this.daoFeesBps();

        // Temporarily set daoFees to 0 to bypass validation
        this.updateDaoFees(0);

        // Now we can set senderTips to any value
        this.updateSenderTips(newTipsBps);

        // Restore original daoFees
        this.updateDaoFees(originalDaoFees);
    }
}
