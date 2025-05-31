// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IRMM.sol";

/**
 * @title Rent2Repay
 * @notice A contract that manages authorization for the Rent2Repay mechanism
 * with multi-token support
 * @dev This contract allows users to configure weekly spending limits per token
 * for automated repayments. Users can set a maximum amount per token that can be
 * spent per week and tracks usage separately
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
    
    /// @notice Default interest rate mode (2 = Variable rate)
    uint256 public constant DEFAULT_INTEREST_RATE_MODE = 2;

    /// @notice Maps user addresses to token addresses to their weekly maximum amount
    mapping(address => mapping(address => uint256)) public weeklyMaxAmounts;
    
    /// @notice Maps user addresses to their last repayment timestamp (shared across all tokens)
    mapping(address => uint256) public lastRepayTimestamps;
    
    /// @notice Maps user addresses to token addresses to their current week spent amount
    mapping(address => mapping(address => uint256)) public currentWeekSpent;

    /// @notice Maps token addresses to their authorization status
    mapping(address => bool) public authorizedTokens;
    
    /// @notice Array of all authorized token addresses
    address[] public tokenList;

    /// @notice Emitted when a user configures the Rent2Repay mechanism for a specific token
    /// @param user The user address that configured the system
    /// @param token The token address configured
    /// @param weeklyMaxAmount The weekly maximum amount set by the user for this token
    event Rent2RepayConfigured(
        address indexed user, 
        address indexed token, 
        uint256 weeklyMaxAmount
    );

    /// @notice Emitted when a user revokes their Rent2Repay authorization for a specific token
    /// @param user The user address that revoked authorization
    /// @param token The token address revoked
    event Rent2RepayRevoked(address indexed user, address indexed token);

    /// @notice Emitted when a user revokes all their Rent2Repay authorizations
    /// @param user The user address that revoked all authorizations
    event Rent2RepayRevokedAll(address indexed user);

    /// @notice Emitted when an operator forcibly removes a user
    /// @param operator The operator who removed the user
    /// @param user The user that was removed
    event UserRemovedByOperator(address indexed operator, address indexed user);

    /// @notice Emitted when a repayment is executed
    /// @param user The user for whom the repayment was executed
    /// @param token The token used for repayment
    /// @param amount The amount that was repaid
    /// @param remainingThisWeek The remaining amount available this week for this token
    /// @param executor The address that executed the repayment
    event RepaymentExecuted(
        address indexed user, 
        address indexed token,
        uint256 amount, 
        uint256 remainingThisWeek,
        address indexed executor
    );

    /// @notice Emitted when a token is authorized
    /// @param token The token address that was authorized
    event TokenAuthorized(address indexed token);

    /// @notice Emitted when a token is unauthorized
    /// @param token The token address that was unauthorized
    event TokenUnauthorized(address indexed token);

    /// @notice Custom errors for better gas efficiency
    error AmountMustBeGreaterThanZero();
    error UserNotAuthorized();
    error UserNotAuthorizedForToken();
    error WeeklyLimitExceeded();
    error OnlyUserCanRevokeOwn();
    error InvalidUserAddress();
    error InvalidTokenAddress();
    error CannotRepayForSelf();
    error ContractPaused();
    error TokenNotAuthorized();
    error TokenAlreadyAuthorized();
    error TokenNotFound();

    /**
     * @notice Constructor that sets up roles, RMM integration and initial authorized tokens
     * @param admin Address that will have admin privileges
     * @param emergency Address that will have emergency privileges
     * @param operator Address that will have operator privileges
     * @param _rmm Address of the RMM contract
     * @param wxdaiToken Address of the WXDAI token
     * @param usdcToken Address of the USDC token
     */
    constructor(
        address admin, 
        address emergency, 
        address operator,
        address _rmm,
        address wxdaiToken,
        address usdcToken
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(EMERGENCY_ROLE, emergency);
        _grantRole(OPERATOR_ROLE, operator);
        
        rmm = IRMM(_rmm);
        
        // Initialize with WXDAI and USDC as authorized tokens
        _authorizeToken(wxdaiToken);
        _authorizeToken(usdcToken);
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
     * @notice Validates that a user has configured Rent2Repay for any token
     * @param user The user address to validate
     */
    modifier userIsAuthorized(address user) {
        if (!isAuthorized(user)) revert UserNotAuthorized();
        _;
    }

    /**
     * @notice Validates that a user has configured Rent2Repay for a specific token
     * @param user The user address to validate
     * @param token The token address to validate
     */
    modifier userIsAuthorizedForToken(address user, address token) {
        if (!isAuthorizedForToken(user, token)) revert UserNotAuthorizedForToken();
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
     * @notice Validates that a token address is not the zero address
     * @param token The token address to validate
     */
    modifier validTokenAddress(address token) {
        if (token == address(0)) revert InvalidTokenAddress();
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
     * @notice Validates that a token is authorized
     * @param token The token address to validate
     */
    modifier onlyAuthorizedToken(address token) {
        if (!authorizedTokens[token]) revert TokenNotAuthorized();
        _;
    }

    /**
     * @notice Configures the Rent2Repay mechanism for the caller for a specific token
     * @dev Sets up weekly spending limits for automated repayments for a specific token
     * @param token The token address to configure
     * @param weeklyMaxAmount Maximum amount authorized per week for this token (must be > 0)
     */
    function configureRent2Repay(address token, uint256 weeklyMaxAmount) 
        external 
        whenNotPaused
        validTokenAddress(token)
        onlyAuthorizedToken(token)
        validAmount(weeklyMaxAmount) 
    {
        weeklyMaxAmounts[msg.sender][token] = weeklyMaxAmount;
        currentWeekSpent[msg.sender][token] = 0;
        
        // Initialize lastRepayTimestamp if it's the first token configuration
        if (lastRepayTimestamps[msg.sender] == 0) {
            lastRepayTimestamps[msg.sender] = block.timestamp;
        }
        
        emit Rent2RepayConfigured(msg.sender, token, weeklyMaxAmount);
    }

    /**
     * @notice Configures the Rent2Repay mechanism for multiple tokens at once
     * @param tokens Array of token addresses to configure
     * @param amounts Array of maximum amounts per week for each token
     */
    function configureRent2RepayMultiple(
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external whenNotPaused {
        require(tokens.length == amounts.length, "Arrays length mismatch");
        require(tokens.length > 0, "Empty arrays");

        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == address(0)) revert InvalidTokenAddress();
            if (!authorizedTokens[tokens[i]]) revert TokenNotAuthorized();
            if (amounts[i] == 0) revert AmountMustBeGreaterThanZero();

            weeklyMaxAmounts[msg.sender][tokens[i]] = amounts[i];
            currentWeekSpent[msg.sender][tokens[i]] = 0;
            
            emit Rent2RepayConfigured(msg.sender, tokens[i], amounts[i]);
        }

        // Initialize lastRepayTimestamp if it's the first configuration
        if (lastRepayTimestamps[msg.sender] == 0) {
            lastRepayTimestamps[msg.sender] = block.timestamp;
        }
    }

    /**
     * @notice Revokes the Rent2Repay authorization for a specific token
     * @param token The token address to revoke authorization for
     */
    function revokeRent2RepayForToken(address token) 
        external 
        validTokenAddress(token)
        userIsAuthorizedForToken(msg.sender, token) 
    {
        weeklyMaxAmounts[msg.sender][token] = 0;
        currentWeekSpent[msg.sender][token] = 0;
        
        emit Rent2RepayRevoked(msg.sender, token);
    }

    /**
     * @notice Revokes the Rent2Repay authorization for all tokens
     */
    function revokeRent2RepayAll() external userIsAuthorized(msg.sender) {
        _removeUserAllTokens(msg.sender);
        emit Rent2RepayRevokedAll(msg.sender);
    }

    /**
     * @notice Allows operators to remove a user from the system (all tokens)
     * @dev Only operators can force-remove users
     * @param user The user to remove
     */
    function removeUser(address user) 
        external 
        onlyRole(OPERATOR_ROLE) 
        userIsAuthorized(user) 
    {
        _removeUserAllTokens(user);
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
     * @notice Checks if a user has authorized the Rent2Repay mechanism for any token
     * @param user Address of the user to check
     * @return true if authorized for at least one token, false otherwise
     */
    function isAuthorized(address user) public view returns (bool) {
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (weeklyMaxAmounts[user][tokenList[i]] > 0) {
                return true;
            }
        }
        return false;
    }

    /**
     * @notice Checks if a user has authorized the Rent2Repay mechanism for a specific token
     * @param user Address of the user to check
     * @param token Address of the token to check
     * @return true if authorized for this token, false otherwise
     */
    function isAuthorizedForToken(address user, address token) public view returns (bool) {
        return weeklyMaxAmounts[user][token] > 0;
    }

    /**
     * @notice Calculates the available amount for repayment this week for a specific token
     * @dev If more than a week has passed since last repayment, resets the weekly counter
     * @param user Address of the user
     * @param token Address of the token
     * @return Available amount for repayment this week for this token
     */
    function getAvailableAmountThisWeek(address user, address token) public view returns (uint256) {
        uint256 maxAmount = weeklyMaxAmounts[user][token];
        
        if (maxAmount == 0) {
            return 0; // User not authorized for this token
        }

        return _isNewWeek(lastRepayTimestamps[user]) 
            ? maxAmount 
            : maxAmount - currentWeekSpent[user][token];
    }

    /**
     * @notice Executes automatic repayment for a user with a specific token
     * @dev This function can be called by anyone to execute automatic repayments
     * @param user Address of the user for whom to execute the repayment
     * @param token Address of the token to use for repayment
     * @param amount Amount to be repaid
     * @return true if the repayment is authorized and limits updated
     */
    function rent2repay(address user, address token, uint256 amount) 
        external 
        whenNotPaused
        validAddress(user)
        validTokenAddress(token)
        onlyAuthorizedToken(token)
        notSelf(user)
        validAmount(amount) 
        userIsAuthorizedForToken(user, token) 
        returns (bool) 
    {
        // Reset weekly counter if a new week has started
        if (_isNewWeek(lastRepayTimestamps[user])) {
            _resetWeeklyCounters(user);
        }

        // Check if the amount is within the limit for this token
        uint256 newSpentAmount = currentWeekSpent[user][token] + amount;
        if (newSpentAmount > weeklyMaxAmounts[user][token]) revert WeeklyLimitExceeded();

        // Additional security: prevent overflow attacks
        require(newSpentAmount >= currentWeekSpent[user][token], "Overflow protection");

        // Transfer and approve tokens for RMM
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        IERC20(token).approve(address(rmm), amount);

        // Call RMM repay function
        uint256 actualAmountRepaid = rmm.repay(
            token,
            amount,
            DEFAULT_INTEREST_RATE_MODE,
            user
        );

        // Update the values only after successful repayment
        currentWeekSpent[user][token] = newSpentAmount;
        lastRepayTimestamps[user] = block.timestamp;

        // Emit event with remaining amount
        emit RepaymentExecuted(
            user, 
            token,
            actualAmountRepaid, 
            weeklyMaxAmounts[user][token] - newSpentAmount,
            msg.sender
        );
        
        return true;
    }

    /**
     * @notice Retrieves a user's configuration for a specific token
     * @param user Address of the user
     * @param token Address of the token
     * @return weeklyMaxAmount The maximum amount per week for this token
     * @return currentSpent Amount spent in the current week for this token
     * @return lastRepayTimestamp Timestamp of the last repayment (shared across tokens)
     */
    function getUserConfigForToken(address user, address token) 
        external 
        view 
        returns (
            uint256 weeklyMaxAmount, 
            uint256 currentSpent, 
            uint256 lastRepayTimestamp
        ) 
    {
        return (
            weeklyMaxAmounts[user][token], 
            currentWeekSpent[user][token],
            lastRepayTimestamps[user]
        );
    }

    /**
     * @notice Retrieves all authorized tokens and their configurations for a user
     * @param user Address of the user
     * @return tokens Array of authorized token addresses
     * @return maxAmounts Array of weekly max amounts for each token
     * @return spentAmounts Array of current week spent amounts for each token
     */
    function getUserConfigs(address user) 
        external 
        view 
        returns (
            address[] memory tokens, 
            uint256[] memory maxAmounts, 
            uint256[] memory spentAmounts
        )
    {
        uint256 authorizedCount = 0;
        
        // Count authorized tokens for this user
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (weeklyMaxAmounts[user][tokenList[i]] > 0) {
                authorizedCount++;
            }
        }
        
        // Create arrays with the right size
        tokens = new address[](authorizedCount);
        maxAmounts = new uint256[](authorizedCount);
        spentAmounts = new uint256[](authorizedCount);
        
        // Fill arrays
        uint256 index = 0;
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (weeklyMaxAmounts[user][tokenList[i]] > 0) {
                tokens[index] = tokenList[i];
                maxAmounts[index] = weeklyMaxAmounts[user][tokenList[i]];
                spentAmounts[index] = currentWeekSpent[user][tokenList[i]];
                index++;
            }
        }
    }

    /**
     * @notice Gets the list of all authorized tokens
     * @return Array of authorized token addresses
     */
    function getAuthorizedTokens() external view returns (address[] memory) {
        return tokenList;
    }

    /**
     * @notice Allows admins to authorize a new token
     * @param token The token address to authorize
     */
    function authorizeToken(address token) 
        external 
        onlyRole(ADMIN_ROLE) 
        validTokenAddress(token)
    {
        if (authorizedTokens[token]) revert TokenAlreadyAuthorized();
        _authorizeToken(token);
    }

    /**
     * @notice Allows admins to unauthorize a token
     * @param token The token address to unauthorize
     */
    function unauthorizeToken(address token) 
        external 
        onlyRole(ADMIN_ROLE) 
        validTokenAddress(token)
    {
        if (!authorizedTokens[token]) revert TokenNotAuthorized();
        
        authorizedTokens[token] = false;
        
        // Remove from tokenList
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (tokenList[i] == token) {
                tokenList[i] = tokenList[tokenList.length - 1];
                tokenList.pop();
                break;
            }
        }
        
        emit TokenUnauthorized(token);
    }

    /**
     * @notice Internal function to authorize a token
     * @param token The token address to authorize
     */
    function _authorizeToken(address token) internal {
        authorizedTokens[token] = true;
        tokenList.push(token);
        emit TokenAuthorized(token);
    }

    /**
     * @notice Internal function to remove a user from the system for all tokens
     * @param user The user to remove
     */
    function _removeUserAllTokens(address user) internal {
        for (uint256 i = 0; i < tokenList.length; i++) {
            weeklyMaxAmounts[user][tokenList[i]] = 0;
            currentWeekSpent[user][tokenList[i]] = 0;
        }
        lastRepayTimestamps[user] = 0;
    }

    /**
     * @notice Internal function to reset weekly counters for all tokens
     * @param user The user to reset counters for
     */
    function _resetWeeklyCounters(address user) internal {
        for (uint256 i = 0; i < tokenList.length; i++) {
            currentWeekSpent[user][tokenList[i]] = 0;
        }
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
        validTokenAddress(token)
        validAddress(to)
    {
        IERC20(token).transfer(to, amount);
    }
} 