// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IRMM.sol";

/**
 * @title Rent2Repay
 * @notice A contract that manages authorization for the Rent2Repay mechanism
 * @dev This contract allows users to configure weekly spending limits for automated loan repayments
 * Users can set a maximum amount that can be spent per week and the contract tracks usage
 */
contract Rent2Repay is AccessControl, Pausable {
    /// @notice Constant for one week in seconds
    uint256 private constant _WEEK_IN_SECONDS = 7 * 24 * 60 * 60;

    /// @notice Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice RMM contract interface
    IRMM public immutable rmm;
    
    /// @notice Default asset for repayments (can be configured)
    address public repaymentAsset;
    
    /// @notice Default interest rate mode (2 = Variable rate)
    uint256 public constant DEFAULT_INTEREST_RATE_MODE = 2;

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

    /// @notice Emitted when an operator forcibly removes a user
    /// @param operator The operator who removed the user
    /// @param user The user that was removed
    event UserRemovedByOperator(address indexed operator, address indexed user);

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
    error OnlyUserCanRevokeOwn();
    error InvalidUserAddress();
    error CannotRepayForSelf();
    error ContractPaused();

    /**
     * @notice Constructor that sets up roles and RMM integration
     * @param admin Address that will have admin privileges
     * @param emergency Address that will have emergency privileges
     * @param operator Address that will have operator privileges
     * @param _rmm Address of the RMM contract
     * @param _repaymentAsset Address of the asset used for repayments
     */
    constructor(
        address admin, 
        address emergency, 
        address operator,
        address _rmm,
        address _repaymentAsset
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(EMERGENCY_ROLE, emergency);
        _grantRole(OPERATOR_ROLE, operator);
        
        rmm = IRMM(_rmm);
        repaymentAsset = _repaymentAsset;
    }

    /**
     * @notice Validates that an amount is greater than zero
     * @param amount The amount to validate
     */
    modifier validAmount(uint256 amount) {
        if (amount == 0) revert AmountMustBeGreaterThanZero();
        _;
    }

    /**
     * @notice Validates that a user has configured Rent2Repay
     * @param user The user address to validate
     */
    modifier userIsAuthorized(address user) {
        if (!isAuthorized(user)) revert UserNotAuthorized();
        _;
    }

    /**
     * @notice Validates that an address is not the zero address
     * @param addr The address to validate
     */
    modifier validAddress(address addr) {
        if (addr == address(0)) revert InvalidUserAddress();
        _;
    }

    /**
     * @notice Validates that the caller is not trying to repay for themselves
     * @param user The user address to validate
     */
    modifier notSelf(address user) {
        if (user == msg.sender) revert CannotRepayForSelf();
        _;
    }

    /**
     * @notice Configures the Rent2Repay mechanism for the caller
     * @dev Sets up weekly spending limits for automated repayments
     * @param weeklyMaxAmount Maximum amount authorized per week (must be > 0)
     */
    function configureRent2Repay(uint256 weeklyMaxAmount) 
        external 
        whenNotPaused
        validAmount(weeklyMaxAmount) 
    {
        weeklyMaxAmounts[msg.sender] = weeklyMaxAmount;
        lastRepayTimestamps[msg.sender] = 0;
        currentWeekSpent[msg.sender] = 0;
        
        emit Rent2RepayConfigured(msg.sender, weeklyMaxAmount);
    }

    /**
     * @notice Revokes the Rent2Repay authorization for the caller
     * @dev Only the user themselves can revoke their own authorization
     */
    function revokeRent2Repay() external userIsAuthorized(msg.sender) {
        _removeUser(msg.sender);
        emit Rent2RepayRevoked(msg.sender);
    }

    /**
     * @notice Allows operators to remove a user from the system
     * @dev Only operators can force-remove users
     * @param user The user to remove
     */
    function removeUser(address user) 
        external 
        onlyRole(OPERATOR_ROLE) 
        userIsAuthorized(user) 
    {
        _removeUser(user);
        emit UserRemovedByOperator(msg.sender, user);
    }

    /**
     * @notice Pauses the contract - only emergency role can do this
     */
    function pause() external onlyRole(EMERGENCY_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses the contract - only emergency role can do this
     */
    function unpause() external onlyRole(EMERGENCY_ROLE) {
        _unpause();
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
     * @notice Executes automatic repayment for a user
     * @dev This function can be called by anyone to execute automatic repayments
     * @param user Address of the user for whom to execute the repayment
     * @param amount Amount to be repaid
     * @return true if the repayment is authorized and limits updated
     */
    function rent2repay(address user, uint256 amount) 
        external 
        whenNotPaused
        validAddress(user)
        notSelf(user)
        validAmount(amount) 
        userIsAuthorized(user) 
        returns (bool) 
    {
        // Reset weekly counter if a new week has started
        if (_isNewWeek(lastRepayTimestamps[user])) {
            currentWeekSpent[user] = 0;
        }

        // Check if the amount is within the limit
        uint256 newSpentAmount = currentWeekSpent[user] + amount;
        if (newSpentAmount > weeklyMaxAmounts[user]) revert WeeklyLimitExceeded();

        // Additional security: prevent overflow attacks
        require(newSpentAmount >= currentWeekSpent[user], "Overflow protection");

        // Transfer and approve tokens for RMM
        IERC20(repaymentAsset).transferFrom(msg.sender, address(this), amount);
        IERC20(repaymentAsset).approve(address(rmm), amount);

        // Call RMM repay function
        uint256 actualAmountRepaid = rmm.repay(
            repaymentAsset,
            amount,
            DEFAULT_INTEREST_RATE_MODE,
            user
        );

        // Update the values only after successful repayment
        currentWeekSpent[user] = newSpentAmount;
        lastRepayTimestamps[user] = block.timestamp;

        // Emit event with remaining amount
        emit RepaymentExecuted(
            user, 
            actualAmountRepaid, 
            weeklyMaxAmounts[user] - newSpentAmount
        );
        
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
     * @notice Internal function to remove a user from the system
     * @param user The user to remove
     */
    function _removeUser(address user) internal {
        delete weeklyMaxAmounts[user];
        delete lastRepayTimestamps[user];
        delete currentWeekSpent[user];
    }

    /**
     * @notice Internal function to check if a new week has started
     * @param lastTimestamp The last recorded timestamp
     * @return true if more than a week has passed since lastTimestamp
     */
    function _isNewWeek(uint256 lastTimestamp) internal view returns (bool) {
        return block.timestamp >= lastTimestamp + _WEEK_IN_SECONDS;
    }

    /**
     * @notice Allows admins to update the repayment asset
     * @param newRepaymentAsset The new asset address to use for repayments
     */
    function setRepaymentAsset(address newRepaymentAsset) 
        external 
        onlyRole(ADMIN_ROLE) 
        validAddress(newRepaymentAsset)
    {
        repaymentAsset = newRepaymentAsset;
    }

    /**
     * @notice Emergency function to recover tokens sent to this contract
     * @param token The token to recover
     * @param amount The amount to recover
     * @param to The address to send recovered tokens to
     */
    function emergencyTokenRecovery(
        address token, 
        uint256 amount, 
        address to
    ) 
        external 
        onlyRole(EMERGENCY_ROLE) 
        validAddress(token)
        validAddress(to)
    {
        IERC20(token).transfer(to, amount);
    }
} 