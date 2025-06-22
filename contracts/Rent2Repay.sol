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
    uint256 private constant _DAY_IN_SECONDS = 24 * 60 * 60;
    /// @notice Constant for one week in seconds
    uint256 private constant _WEEK_IN_SECONDS = 7 * 24 * 60 * 60;

    /// @notice Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice Structure to represent a token pair (token + debt token)
    struct TokenPair {
        address token;
        address debtToken;
    }

    /// @notice RMM contract interface
    IRMM public immutable rmm;
    
    /// @notice Default interest rate mode (2 = Variable rate)
    uint256 public constant DEFAULT_INTEREST_RATE_MODE = 2;

    /// @notice Maps user addresses to token addresses to their weekly maximum amount
    mapping(address => mapping(address => uint256)) public allowedMaxAmounts;
    
    /// @notice Maps user addresses to their last repayment timestamp (shared across all tokens)
    mapping(address => uint256) public lastRepayTimestamps;
    

    /// @notice Maps user addresses to token addresses to their periodicity
    mapping(address => uint256) public periodicity;

    /// @notice Maps token addresses to their authorization status
    mapping(address => bool) public authorizedTokens;
    
    /// @notice Array of all authorized token pairs (token + debt token)
    TokenPair[] public tokenList;

    /// @notice Maps token addresses to their debt token addresses for quick lookup
    mapping(address => address) public tokenToDebtToken;

    /// @notice Maps debt token addresses to their token addresses for quick lookup
    mapping(address => address) public debtTokenToToken;

    /// @notice DAO fees in basis points (BPS) - 10000 = 100%
    uint256 public daoFeesBPS = 50; // 0.5% default
    
    /// @notice Sender tips in basis points (BPS) - 10000 = 100%
    uint256 public senderTipsBPS = 25; // 0.25% default

    /// @notice Token address for DAO fee reduction - if user holds this token above minimum 
    /// amount, DAO fees are reduced
    address public daoFeeReductionToken;
    
    /// @notice Minimum amount of daoFeeReductionToken required to get DAO fee reduction
    uint256 public daoFeeReductionMinimumAmount;

    /// @notice DAO fee reduction percentage in basis points (BPS) - 10000 = 100% 
    /// (exonération totale)
    uint256 public daoFeeReductionBPS = 5000; // 50% default

    /// @notice DAO treasury address that receives DAO fees
    address public daoTreasuryAddress;

    /// @notice Emitted when a user configures the Rent2Repay mechanism for a specific token
    /// @param user The user address that configured the system
    /// @param token The token address configured
    /// @param weeklyMaxAmount The weekly maximum amount set by the user for this token
    /// @param periodicity todo
    event Rent2RepayConfigured(
        address indexed user, 
        address[] token, 
        uint256[] weeklyMaxAmount,
        uint256 periodicity
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

    /// @notice Emitted when a token pair is authorized
    /// @param token The token address that was authorized
    /// @param debtToken The debt token address associated with the token
    event TokenPairAuthorized(address indexed token, address indexed debtToken);

    /// @notice Emitted when DAO fees are updated
    /// @param oldFees The previous DAO fees in BPS
    /// @param newFees The new DAO fees in BPS
    /// @param admin The admin who updated the fees
    event DaoFeesUpdated(uint256 oldFees, uint256 newFees, address indexed admin);

    /// @notice Emitted when sender tips are updated
    /// @param oldTips The previous sender tips in BPS
    /// @param newTips The new sender tips in BPS
    /// @param admin The admin who updated the tips
    event SenderTipsUpdated(uint256 oldTips, uint256 newTips, address indexed admin);

    /// @notice Emitted when DAO fee reduction token is updated
    /// @param oldToken The previous DAO fee reduction token address
    /// @param newToken The new DAO fee reduction token address
    /// @param admin The admin who updated the token
    event DaoFeeReductionTokenUpdated(address oldToken, address newToken, address indexed admin);

    /// @notice Emitted when DAO fee reduction minimum amount is updated
    /// @param oldAmount The previous minimum amount
    /// @param newAmount The new minimum amount
    /// @param admin The admin who updated the amount
    event DaoFeeReductionMinimumAmountUpdated(
        uint256 oldAmount, 
        uint256 newAmount, 
        address indexed admin
    );

    /// @notice Emitted when DAO fee reduction percentage is updated
    /// @param oldPercentage The previous reduction percentage in BPS
    /// @param newPercentage The new reduction percentage in BPS
    /// @param admin The admin who updated the percentage
    event DaoFeeReductionPercentageUpdated(
        uint256 oldPercentage, 
        uint256 newPercentage, 
        address indexed admin
    );

    /// @notice Emitted when DAO treasury address is updated
    /// @param oldAddress The previous DAO treasury address
    /// @param newAddress The new DAO treasury address
    /// @param admin The admin who updated the address
    event DaoTreasuryAddressUpdated(
        address oldAddress, 
        address newAddress, 
        address indexed admin
    );

    /// @notice Emitted when fees are collected during repayment
    /// @param user The user for whom the repayment was executed
    /// @param token The token used for repayment
    /// @param daoFees The DAO fees collected
    /// @param senderTips The sender tips collected
    /// @param executor The address that executed the repayment
    event FeesCollected(
        address indexed user,
        address indexed token,
        uint256 daoFees,
        uint256 senderTips,
        address indexed executor
    );

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
    error TokenStillAuthorized();
    error NoDebtTokenAssociated();
    error InvalidFeesBPS();
    error InvalidTipsBPS();
    error InvalidDaoFeeReductionToken();
    error InvalidDaoFeeReductionAmount();

    /**
     * @notice Constructor that sets up roles, RMM integration and initial authorized tokens
     * @param admin Address that will have admin privileges
     * @param emergency Address that will have emergency privileges
     * @param operator Address that will have operator privileges
     * @param _rmm Address of the RMM contract
     * @param wxdaiToken Address of the WXDAI token
     * @param wxdaiDebtToken Address of the WXDAI debt token
     * @param usdcToken Address of the USDC token
     * @param usdcDebtToken Address of the USDC debt token
     */
    constructor(
        address admin, 
        address emergency, 
        address operator,
        address _rmm,
        address wxdaiToken,
        address wxdaiDebtToken,
        address usdcToken,
        address usdcDebtToken
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(EMERGENCY_ROLE, emergency);
        _grantRole(OPERATOR_ROLE, operator);
        
        rmm = IRMM(_rmm);
        
        // Initialize with WXDAI and USDC as authorized token pairs
        _authorizeTokenPair(wxdaiToken, wxdaiDebtToken);
        _authorizeTokenPair(usdcToken, usdcDebtToken);
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
     * @notice Configures the Rent2Repay mechanism for one or multiple tokens
     * @param tokens Array of token addresses to configure (can contain just one token)
     * @param amounts Array of maximum amounts per week for each token
     */
    function configureRent2Repay(
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256  period
    ) external whenNotPaused {
        require(tokens.length == amounts.length, "Arrays length mismatch");
        require(tokens.length > 0, "Empty arrays");

            for (uint256 i = 0; i < tokens.length; i++) {
                if (tokens[i] == address(0)) revert InvalidTokenAddress();
                if (!authorizedTokens[tokens[i]]) revert TokenNotAuthorized();
                if (amounts[i] == 0) revert AmountMustBeGreaterThanZero();

                allowedMaxAmounts[msg.sender][tokens[i]] = amounts[i];
            }

        // Initialize lastRepayTimestamp if it's the first configuration
        if (lastRepayTimestamps[msg.sender] == 0) {
            lastRepayTimestamps[msg.sender] = block.timestamp;
        }

        periodicity[msg.sender] = period == 0 ? _WEEK_IN_SECONDS : period;

        emit Rent2RepayConfigured(msg.sender, tokens, amounts, periodicity[msg.sender]);

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
        allowedMaxAmounts[msg.sender][token] = 0;
        
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
     * @notice Unpauses the contract - only ADMIN (DAO) role can do this
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Checks if a user has authorized the Rent2Repay mechanism for any token
     * @param user Address of the user to check
     * @return true if authorized for at least one token, false otherwise
     */
    function isAuthorized(address user) public view returns (bool) {
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (allowedMaxAmounts[user][tokenList[i].token] > 0) {
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
        return allowedMaxAmounts[user][token] > 0;
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
        userIsAuthorizedForToken(user, token) 
        returns (bool) 
    {
        // security
        if (allowedMaxAmounts[user][token] == 0) revert("User not configured for token");
        if (periodicity[user] == 0) revert("Periodicity not set");
        if (amount == 0) revert("Amount must be greater than zero");

        if(_isNewPeriod(user) == false) revert("wait next period");

        // Get the debt token for this token
        address debtToken = tokenToDebtToken[token];
        if (debtToken == address(0)) revert NoDebtTokenAssociated();

        // Check 
        uint256 remainingDebt = IERC20(debtToken).balanceOf(user);
        if (remainingDebt == 0) revert("No Debt");

        uint256 toRepay = amount;
        if(remainingDebt < amount) toRepay = remainingDebt;

        // Transfer tokens from user to contract first
        IERC20(token).transferFrom(user, address(this), toRepay);

        // Calculate fees
        uint256 daoFees;
        uint256 senderTips;
        uint256 amountForRepayment;
        (daoFees, senderTips, amountForRepayment) = _calculateFees(toRepay, user);
        
        // Transfer fees to respective addresses
        _transferFees(token, daoFees, senderTips);
        
        // Call RMM repay function with the amount minus fees
        uint256 actualAmountRepaid = rmm.repay(
            token,
            amountForRepayment,
            DEFAULT_INTEREST_RATE_MODE,
            user
        );

        // Update the values only after successful repayment
        lastRepayTimestamps[user] = block.timestamp;

        // Emit event with remaining amount
        emit RepaymentExecuted(
            user, 
            token,
            actualAmountRepaid, 
            allowedMaxAmounts[user][token],
            msg.sender
        );
        
        // Emit fees collected event
        emit FeesCollected(
            user,
            token,
            daoFees,
            senderTips,
            msg.sender
        );
        
        return true;
    }

    /**
     * @notice Retrieves a user's configuration for a specific token
     * @param user Address of the user
     * @param token Address of the token
     * @return weeklyMaxAmount The maximum amount per week for this token
     * @return lastRepayTimestamp Timestamp of the last repayment (shared across tokens)
     */
    function getUserConfigForToken(address user, address token) 
        external 
        view 
        returns (
            uint256 weeklyMaxAmount,
            uint256 lastRepayTimestamp
        ) 
    {
        return (
            allowedMaxAmounts[user][token],
            lastRepayTimestamps[user]
        );
    }

    /**
     * @notice Retrieves all authorized tokens and their configurations for a user
     * @param user Address of the user
     * @return tokens Array of authorized token addresses
     * @return maxAmounts Array of weekly max amounts for each token
     */
    function getUserConfigs(address user) 
        external 
        view 
        returns (
            address[] memory tokens, 
            uint256[] memory maxAmounts
        )
    {
        uint256 authorizedCount = 0;
        
        // Count authorized tokens for this user
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (allowedMaxAmounts[user][tokenList[i].token] > 0) {
                authorizedCount++;
            }
        }
        
        // Create arrays with the right size
        tokens = new address[](authorizedCount);
        maxAmounts = new uint256[](authorizedCount);
        
        // Fill arrays
        uint256 index = 0;
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (allowedMaxAmounts[user][tokenList[i].token] > 0) {
                tokens[index] = tokenList[i].token;
                maxAmounts[index] = allowedMaxAmounts[user][tokenList[i].token];
                index++;
            }
        }
    }

    /**
     * @notice Gets the list of all authorized tokens
     * @return Array of authorized token addresses
     */
    function getAuthorizedTokens() external view returns (address[] memory) {
        address[] memory tokenAddresses = new address[](tokenList.length);
        for (uint256 i = 0; i < tokenList.length; i++) {
            tokenAddresses[i] = tokenList[i].token;
        }
        return tokenAddresses;
    }

    /**
     * @notice Gets the list of all authorized token pairs
     * @return Array of TokenPair structures containing token and debt token addresses
     */
    function getAuthorizedTokenPairs() external view returns (TokenPair[] memory) {
        return tokenList;
    }

    /**
     * @notice Gets the debt token address for a given token
     * @param token The token address
     * @return The debt token address associated with the token
     */
    function getDebtToken(address token) external view returns (address) {
        return tokenToDebtToken[token];
    }

    /**
     * @notice Gets the token address for a given debt token
     * @param debtToken The debt token address
     * @return The token address associated with the debt token
     */
    function getTokenFromDebtToken(address debtToken) external view returns (address) {
        return debtTokenToToken[debtToken];
    }

    /**
     * @notice Allows admins to authorize a new token pair
     * @param token The token address to authorize
     * @param debtToken The debt token address associated with the token
     */
    function authorizeTokenPair(address token, address debtToken) 
        external 
        onlyRole(ADMIN_ROLE) 
        validTokenAddress(token)
        validTokenAddress(debtToken)
    {
        if (authorizedTokens[token]) revert TokenAlreadyAuthorized();
        if (tokenToDebtToken[token] != address(0)) revert TokenAlreadyAuthorized();
        if (debtTokenToToken[debtToken] != address(0)) revert TokenAlreadyAuthorized();
        
        _authorizeTokenPair(token, debtToken);
    }


    /**
     * @notice Internal function to authorize a token pair
     * @param token The token address to authorize
     * @param debtToken The debt token address associated with the token
     */
    function _authorizeTokenPair(address token, address debtToken) internal {
        authorizedTokens[token] = true;
        tokenList.push(TokenPair({token: token, debtToken: debtToken}));
        tokenToDebtToken[token] = debtToken;
        debtTokenToToken[debtToken] = token;
        emit TokenPairAuthorized(token, debtToken);
    }

    /**
     * @notice Internal function to remove a user from the system for all tokens
     * @param user The user to remove
     */
    function _removeUserAllTokens(address user) internal {
        // NOTE Solidity: key removing is impossible
        for (uint256 i = 0; i < tokenList.length; i++) {
            allowedMaxAmounts[user][tokenList[i].token] = 0;
        }
        lastRepayTimestamps[user] = 0;
        periodicity[user] = 0;
    }


    /*
     * @notice Internal function to check if a new week has started
     * @param lastTimestamp The last recorded timestamp
     * @return true if more than a week has passed since lastTimestamp
     */
    function _isNewPeriod(address _user) internal view returns (bool) {
        return block.timestamp >= lastRepayTimestamps[_user] + periodicity[_user];
    }

    /**
     * @notice Internal function to calculate fees for a given amount
     * @param amount The amount to calculate fees for
     * @param user The user address to check for DAO fee reduction
     * @return daoFees The DAO fees amount
     * @return senderTips The sender tips amount
     * @return amountForRepayment The amount remaining for repayment
     */
    function _calculateFees(uint256 amount, address user) internal view returns (
        uint256 daoFees,
        uint256 senderTips,
        uint256 amountForRepayment
    ) {
        // Calculate base fees
        daoFees = (amount * daoFeesBPS) / 10000;
        senderTips = (amount * senderTipsBPS) / 10000;
        
        // Check if user qualifies for DAO fee reduction
        // cas si amount > totalfees divison euclidiennes??
        //
        if (daoFeeReductionToken != address(0) && daoFeeReductionMinimumAmount > 0) {
            uint256 userBalance = IERC20(daoFeeReductionToken).balanceOf(user);
            if (userBalance >= daoFeeReductionMinimumAmount) {
                // Reduce DAO fees by the configured percentage (BPS)
                uint256 reductionAmount = (daoFees * daoFeeReductionBPS) / 10000;
                daoFees = daoFees - reductionAmount;
            }
        }
        
        uint256 totalFees = daoFees + senderTips;   
        // SECU to move on main fct ? if fees > 100 revert
        if(totalFees > amount) revert("Exceed amount");
        amountForRepayment = amount - totalFees;
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

    /**
     * @notice Allows admins to clean up user configurations for an unauthorized token
     * @dev Only works on tokens that are no longer authorized. 
     * Useful for cleanup after token removal.
     * @param token The unauthorized token address to clean up
     * @param users Array of user addresses to clean up
     */
    function cleanupUnauthorizedTokenConfigs(
        address token,
        address[] calldata users
    ) 
        external 
        onlyRole(ADMIN_ROLE) 
        validTokenAddress(token)
    {
        // Only allow cleanup of unauthorized tokens
        if (authorizedTokens[token]) revert TokenStillAuthorized();

        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] != address(0) && allowedMaxAmounts[users[i]][token] > 0) {
                allowedMaxAmounts[users[i]][token] = 0;
                emit Rent2RepayRevoked(users[i], token);
            }
        }
    }

    /**
     * @notice Allows admin to update DAO fees
     * @param newFeesBPS New DAO fees in basis points (BPS) - 10000 = 100%
     */
    function updateDaoFees(uint256 newFeesBPS) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        // Secu Max 100%
        if (newFeesBPS > 10000) revert InvalidFeesBPS();
        
        uint256 oldFees = daoFeesBPS;
        daoFeesBPS = newFeesBPS;
        
        emit DaoFeesUpdated(oldFees, newFeesBPS, msg.sender);
    }

    /**
     * @notice Allows admin to update sender tips
     * @param newTipsBPS New sender tips in basis points (BPS) - 10000 = 100%
     */
    function updateSenderTips(uint256 newTipsBPS) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        // Secu Max 100%
        if (newTipsBPS > 10000) revert InvalidTipsBPS();
        
        uint256 oldTips = senderTipsBPS;
        senderTipsBPS = newTipsBPS;
        
        emit SenderTipsUpdated(oldTips, newTipsBPS, msg.sender);
    }

    /**
     * @notice Get current fee configuration
     * @return daoFees Current DAO fees in BPS
     * @return senderTips Current sender tips in BPS
     */
    function getFeeConfiguration() 
        external 
        view 
        returns (uint256 daoFees, uint256 senderTips) 
    {
        return (daoFeesBPS, senderTipsBPS);
    }

    /**
     * @notice Get DAO fee reduction configuration
     * @return token The DAO fee reduction token address
     * @return minimumAmount The minimum amount required for fee reduction
     * @return reductionPercentage The reduction percentage in BPS
     * @return treasuryAddress The DAO treasury address
     */
    function getDaoFeeReductionConfiguration() 
        external 
        view 
        returns (
            address token, 
            uint256 minimumAmount, 
            uint256 reductionPercentage,
            address treasuryAddress
        ) 
    {
        return (
            daoFeeReductionToken, 
            daoFeeReductionMinimumAmount, 
            daoFeeReductionBPS, 
            daoTreasuryAddress
        );
    }

    /**
     * @notice Allows admin to update DAO fee reduction token
     * @param newToken The new DAO fee reduction token address
     */
    function updateDaoFeeReductionToken(address newToken) 
        external 
        onlyRole(ADMIN_ROLE) 
        validTokenAddress(newToken)
    {
        address oldToken = daoFeeReductionToken;
        daoFeeReductionToken = newToken;
        emit DaoFeeReductionTokenUpdated(oldToken, newToken, msg.sender);
    }

    /**
     * @notice Allows admin to update DAO fee reduction minimum amount
     * @param newAmount The new minimum amount
     */
    function updateDaoFeeReductionMinimumAmount(uint256 newAmount) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        uint256 oldAmount = daoFeeReductionMinimumAmount;
        daoFeeReductionMinimumAmount = newAmount;
        emit DaoFeeReductionMinimumAmountUpdated(oldAmount, newAmount, msg.sender);
    }

    /**
     * @notice Allows admin to update DAO fee reduction percentage
     * @param newPercentage The new reduction percentage in BPS
     */
    function updateDaoFeeReductionPercentage(uint256 newPercentage) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        // Secu Max 100%
        if (newPercentage > 10000) revert InvalidDaoFeeReductionAmount();
        
        uint256 oldPercentage = daoFeeReductionBPS;
        daoFeeReductionBPS = newPercentage;
        emit DaoFeeReductionPercentageUpdated(oldPercentage, newPercentage, msg.sender);
    }

    /**
     * @notice Allows admin to update DAO treasury address
     * @param newAddress The new DAO treasury address
     */
    function updateDaoTreasuryAddress(address newAddress) 
        external 
        onlyRole(ADMIN_ROLE) 
        validAddress(newAddress)
    {
        address oldAddress = daoTreasuryAddress;
        daoTreasuryAddress = newAddress;
        emit DaoTreasuryAddressUpdated(oldAddress, newAddress, msg.sender);
    }

    /**
     * @notice Internal function to transfer fees to respective addresses
     * @param token The token address
     * @param daoFees The DAO fees amount
     * @param senderTips The sender tips amount
     */
    function _transferFees(address token, uint256 daoFees, uint256 senderTips) internal {
        if (daoFees > 0 && daoTreasuryAddress != address(0)) {
            IERC20(token).transfer(daoTreasuryAddress, daoFees);
        }
        
        if (senderTips > 0) {
            IERC20(token).transfer(msg.sender, senderTips);
        }
    }
} 