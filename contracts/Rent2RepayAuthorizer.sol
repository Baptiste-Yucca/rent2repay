// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Rent2RepayAuthorizer
 * @notice A contract that manages authorization for the Rent2Repay mechanism
 * @dev This contract allows users to configure weekly spending limits for automated loan repayments
 * Users can set a maximum amount that can be spent per week and the contract tracks usage
 */
contract Rent2RepayAuthorizer {
    /// @notice Constant for one week in seconds
    uint256 private constant _WEEK_IN_SECONDS = 7 * 24 * 60 * 60;

    /// @notice Maps user addresses to their weekly maximum amount
    mapping(address => uint256) public weeklyMaxAmounts;
    
    /// @notice Maps user addresses to their last repayment timestamp
    mapping(address => uint256) public lastRepayTimestamps;
    
    /// @notice Maps user addresses to their current week spent amount
    mapping(address => uint256) public currentWeekSpent;

    /// @notice Emitted when a user configures the Rent2Repay mechanism
    /// @param user The user address that configured the system
    /// @param weeklyMaxAmount The weekly maximum amount set by the user
    event Rent2RepayConfigured(address indexed user, uint256 weeklyMaxAmount);

    /// @notice Emitted when a user revokes their Rent2Repay authorization
    /// @param user The user address that revoked authorization
    event Rent2RepayRevoked(address indexed user);

    /// @notice Emitted when a repayment is executed
    /// @param user The user for whom the repayment was executed
    /// @param amount The amount that was repaid
    /// @param remainingThisWeek The remaining amount available this week
    event RepaymentExecuted(
        address indexed user, 
        uint256 amount, 
        uint256 remainingThisWeek
    );

    /// @notice Custom errors for better gas efficiency
    error AmountMustBeGreaterThanZero();
    error UserNotAuthorized();
    error WeeklyLimitExceeded();

    /**
     * @notice Validates that an amount is greater than zero
     * @param amount The amount to validate
     */
    modifier validAmount(uint256 amount) {
        if (amount == 0) revert AmountMustBeGreaterThanZero();
        _;
    }

    /**
     * @notice Validates that a user is authorized
     * @param user The user address to validate
     */
    modifier onlyAuthorized(address user) {
        if (!isAuthorized(user)) revert UserNotAuthorized();
        _;
    }

    /**
     * @notice Configures the Rent2Repay mechanism for the caller
     * @dev Sets up weekly spending limits for automated repayments
     * @param weeklyMaxAmount Maximum amount authorized per week (must be > 0)
     */
    function configureRent2Repay(uint256 weeklyMaxAmount) 
        external 
        validAmount(weeklyMaxAmount) 
    {
        weeklyMaxAmounts[msg.sender] = weeklyMaxAmount;
        lastRepayTimestamps[msg.sender] = 0;
        currentWeekSpent[msg.sender] = 0;
        
        emit Rent2RepayConfigured(msg.sender, weeklyMaxAmount);
    }

    /**
     * @notice Revokes the Rent2Repay authorization for the caller
     * @dev Completely removes the user's configuration and authorization
     */
    function revokeRent2Repay() external onlyAuthorized(msg.sender) {
        delete weeklyMaxAmounts[msg.sender];
        delete lastRepayTimestamps[msg.sender];
        delete currentWeekSpent[msg.sender];
        
        emit Rent2RepayRevoked(msg.sender);
    }

    /**
     * @notice Checks if a user has authorized the Rent2Repay mechanism
     * @param user Address of the user to check
     * @return true if authorized (weeklyMaxAmount > 0), false otherwise
     */
    function isAuthorized(address user) public view returns (bool) {
        return weeklyMaxAmounts[user] > 0;
    }

    /**
     * @notice Calculates the available amount for repayment this week
     * @dev If more than a week has passed since last repayment, resets the weekly counter
     * @param user Address of the user
     * @return Available amount for repayment this week
     */
    function getAvailableAmountThisWeek(address user) public view returns (uint256) {
        uint256 maxAmount = weeklyMaxAmounts[user];
        
        if (maxAmount == 0) {
            return 0; // User not authorized
        }

        return _isNewWeek(lastRepayTimestamps[user]) 
            ? maxAmount 
            : maxAmount - currentWeekSpent[user];
    }

    /**
     * @notice Validates and updates repayment limits before a repayment
     * @dev This function should be called before executing any repayment to ensure 
     * limits are respected
     * @param user Address of the user for whom to execute the repayment
     * @param amount Amount to be repaid
     * @return true if the repayment is authorized and limits updated
     */
    function validateAndUpdateRepayment(address user, uint256 amount) 
        external 
        validAmount(amount) 
        onlyAuthorized(user) 
        returns (bool) 
    {
        // Reset weekly counter if a new week has started
        if (_isNewWeek(lastRepayTimestamps[user])) {
            currentWeekSpent[user] = 0;
        }

        // Check if the amount is within the limit
        uint256 newSpentAmount = currentWeekSpent[user] + amount;
        if (newSpentAmount > weeklyMaxAmounts[user]) revert WeeklyLimitExceeded();

        // Update the values
        currentWeekSpent[user] = newSpentAmount;
        lastRepayTimestamps[user] = block.timestamp;

        emit RepaymentExecuted(user, amount, weeklyMaxAmounts[user] - newSpentAmount);
        
        return true;
    }

    /**
     * @notice Retrieves a user's configuration
     * @param user Address of the user
     * @return weeklyMaxAmount The maximum amount per week
     * @return lastRepayTimestamp Timestamp of the last repayment
     * @return currentSpent Amount spent in the current week
     */
    function getUserConfig(address user) 
        external 
        view 
        returns (uint256, uint256, uint256) 
    {
        return (
            weeklyMaxAmounts[user], 
            lastRepayTimestamps[user], 
            currentWeekSpent[user]
        );
    }

    /**
     * @notice Internal function to check if a new week has started
     * @param lastTimestamp The last recorded timestamp
     * @return true if more than a week has passed since lastTimestamp
     */
    function _isNewWeek(uint256 lastTimestamp) internal view returns (bool) {
        return block.timestamp >= lastTimestamp + _WEEK_IN_SECONDS;
    }
} 