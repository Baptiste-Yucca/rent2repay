// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
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
contract Rent2Repay is Initializable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
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

    struct TokenConfig {
        address token;
        address debtToken;
        address supplyToken;
        bool active;
    }

    /// @notice RMM contract interface
    IRMM public rmm;
    
    /// @notice Default interest rate mode (2 = Variable rate)
    uint256 public constant DEFAULT_INTEREST_RATE_MODE = 2;

    /// @notice Maps user addresses to token addresses to their weekly maximum amount
    mapping(address => mapping(address => uint256)) public allowedMaxAmounts;
    
    /// @notice Maps user addresses to their last repayment timestamp (shared across all tokens)
    mapping(address => uint256) public lastRepayTimestamps;

    /// @notice Maps user addresses to token addresses to their periodicity
    mapping(address => mapping(address => uint256)) public periodicity;

    // Note: authorizedTokens mapping removed - now using tokenConfig[token].active
    
    /// @notice Maps token addresses to their debt token addresses
    mapping(address => TokenConfig) public tokenConfig;

    /// @notice Array to keep track of authorized tokens
    address[] private _authorizedTokensList;

    /// @notice DAO fees in basis points (BPS) - 10000 = 100%
    uint256 public daoFeesBPS;
    
    /// @notice Sender tips in basis points (BPS) - 10000 = 100%
    uint256 public senderTipsBPS;

    /// @notice Token address for DAO fee reduction - if user holds this token above minimum 
    /// amount, DAO fees are reduced
    address public daoFeeReductionToken;
    
    /// @notice Minimum amount of daoFeeReductionToken required to get DAO fee reduction
    uint256 public daoFeeReductionMinimumAmount;

    /// @notice DAO fee reduction percentage in basis points (BPS) - 10000 = 100% 
    uint256 public daoFeeReductionBPS;

    /// @notice DAO treasury address that receives DAO fees
    address public daoTreasuryAddress;

    /// @notice Emitted when a user configures the Rent2Repay mechanism for a specific token
    /// @param user The user address that configured the system
    /// @param token The token address configured
    /// @param weeklyMaxAmount The weekly maximum amount set by the user for this token
    /// @param periodicity The periodicity of the repayment
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
    event TokenTripleAuthorized(
        address indexed token, 
        address indexed debtToken, 
        address indexed supplyToken
    );

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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract with roles, RMM integration and initial authorized tokens
     * @param admin Address that will have admin privileges
     * @param emergency Address that will have emergency privileges
     * @param operator Address that will have operator privileges
     * @param _rmm Address of the RMM contract
     * @param wxdaiToken Address of the WXDAI token
     * @param wxdaiDebtToken Address of the WXDAI debt token
     * @param usdcToken Address of the USDC token
     * @param usdcDebtToken Address of the USDC debt token
     */
    function initialize(
        address admin, 
        address emergency, 
        address operator,
        address _rmm,
        address wxdaiToken,
        address wxdaiDebtToken,
        address wxdaiArmmToken,
        address usdcToken,
        address usdcDebtToken,
        address usdcArmmToken
    ) external initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(EMERGENCY_ROLE, emergency);
        _grantRole(OPERATOR_ROLE, operator);
        
        rmm = IRMM(_rmm);
        
        // Initialize default fee values
        daoFeesBPS = 50; // 0.5% default
        senderTipsBPS = 25; // 0.25% default
        daoFeeReductionBPS = 5000; // 50% default
        
        // Initialize with WXDAI and USDC as authorized token pairs
        _authorizeTokenPair(wxdaiToken, wxdaiDebtToken, wxdaiArmmToken);
        _authorizeTokenPair(usdcToken, usdcDebtToken, usdcArmmToken);
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
     * @notice Validates that a token is authorized
     * @param token The token address to validate
     */
    modifier onlyAuthorizedToken(address token) {
        if (!tokenConfig[token].active) revert TokenNotAuthorized();
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
        uint256  period,
        uint256  _timestamp
    ) external whenNotPaused nonReentrant {
        require(tokens.length > 0 && tokens.length == amounts.length, "Invalid array lengths");
            for (uint256 i = 0; i < tokens.length; i++) {
                require(tokens[i] != address(0) && tokenConfig[tokens[i]].active && amounts[i] > 0,
                    "Invalid token or amount");
                allowedMaxAmounts[msg.sender][tokens[i]] = amounts[i];
                periodicity[msg.sender][tokens[i]] = period == 0 ? _WEEK_IN_SECONDS : period;
            }
        // Initialize lastRepayTimestamp if it's the first configuration
        lastRepayTimestamps[msg.sender] = _timestamp;
        emit Rent2RepayConfigured(msg.sender, tokens, amounts, period);
    }

    /**
     * @notice Revokes the Rent2Repay authorization for all tokens
     */
    function revokeRent2RepayAll() external userIsAuthorized(msg.sender) {
        _removeUserAllTokens(msg.sender);
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
        for (uint256 i = 0; i < _authorizedTokensList.length; i++) {
            if (tokenConfig[_authorizedTokensList[i]].active && 
                allowedMaxAmounts[user][_authorizedTokensList[i]] > 0) {
                return true;
            }
        }
        return false;
    }
    

    // Helper function to perform security checks and configuration validation
    function _validateUserAndToken(address user, address token) internal view {
        require(allowedMaxAmounts[user][token] > 0, "User not configured for token");
        require(periodicity[user][token] > 0, "Periodicity not set");
        require(_isNewPeriod(user, token), "Wait next period");
    }

    function rent2repay(address user, address token) 
        external 
        whenNotPaused
        validAddress(user)
        validTokenAddress(token)
        onlyAuthorizedToken(token)
        nonReentrant
        returns (bool) 
    {
        _validateUserAndToken(user, token);

        bool isSupplyToken = tokenConfig[token].supplyToken == token;
   
        uint256 amount = allowedMaxAmounts[user][token];
        uint256 balance = IERC20(token).balanceOf(user);
        uint256 toTransfer = balance < amount ? balance : amount;

        (
            uint256 daoFees,
            uint256 senderTips,
            uint256 amountForRepayment
        ) = _calculateFees(toTransfer, user);
    

        require(
            IERC20(token).transferFrom(user, address(this), toTransfer),
            "transferFrom to R2R failed"
        );

        if(isSupplyToken) {
            require(IERC20(token).approve(address(rmm), toTransfer), "Approve failed");
            uint256 withdrawnAmount = rmm.withdraw(tokenConfig[token].token, amountForRepayment, address(this));
            require(withdrawnAmount == amountForRepayment, "Withdrawn amount mismatch");
            // HOWTO secure ? 
            // withdrawnAmunt < ampour for repay
        }

        // force repayement with stablecoin
        require(IERC20(tokenConfig[token].token).approve(address(rmm), amountForRepayment), "Approve failed");
        
        uint256 actualAmountRepaid = rmm.repay(
            tokenConfig[token].token,
            amountForRepayment,
            DEFAULT_INTEREST_RATE_MODE,
            user
        );


        uint256 difference = amountForRepayment - actualAmountRepaid;
        if(difference > 0) {
            require(
                IERC20(tokenConfig[token].token).transfer(user, difference),
                "transfer to user failed"
            );
        }

        // Ajust fees if there is difference
        uint256 adjustedDaoFees = daoFees;
        uint256 adjustedSenderTips = senderTips;
        
        if(difference > 0 && tokenConfig[token].token == token) {
            adjustedDaoFees = daoFees > difference ? daoFees - difference : 0;
            adjustedSenderTips = senderTips;
            uint256 remainingDifference = difference > daoFees ? difference - daoFees : 0;
            if(remainingDifference > 0) {
                adjustedSenderTips = senderTips > remainingDifference ? senderTips - remainingDifference : 0;
            }
        }

        // Transfer fees to respective addresses
        _transferFees(token, adjustedDaoFees, adjustedSenderTips);

        // Update timestamp and emit event
        _updateTimestampAndEmitEvent(user, token, actualAmountRepaid);

        return true;
    }

    function batchRent2Repay(address[] calldata users, address token) 
        external 
        whenNotPaused
        validTokenAddress(token)
        onlyAuthorizedToken(token)
        nonReentrant
    {
        
        uint256 totalDaoFees = 0;
        uint256 totalSenderTips = 0;
        
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            require(user != address(0), "Invalid user address");
            
            _validateUserAndToken(user, token);
            bool isSupplyToken = tokenConfig[token].supplyToken == token;

            uint256 amount = allowedMaxAmounts[user][token];
            uint256 balance = IERC20(token).balanceOf(user);
            uint256 toTransfer = balance < amount ? balance : amount;

            (
                uint256 daoFees,
                uint256 senderTips,
                uint256 amountForRepayment
            ) = _calculateFees(toTransfer, user);

            require(
                IERC20(token).transferFrom(user, address(this), toTransfer),
                "transferFrom failed"
            );     

            totalDaoFees += daoFees;
            totalSenderTips += senderTips;

            if(isSupplyToken) {
                require(IERC20(token).approve(address(rmm), toTransfer), "Approve failed");
                uint256 withdrawnAmount = rmm.withdraw(tokenConfig[token].token, amountForRepayment, address(this));
                // see what happens on Gnossi chain
                require(withdrawnAmount == amountForRepayment, "Withdrawn amount mismatch");
            }

            // force repayement with stablecoin
            require(
                IERC20(tokenConfig[token].token).approve(address(rmm), amountForRepayment),
                "Approve failed"
            );

            uint256 actualAmountRepaid = rmm.repay(
                tokenConfig[token].token,
                amountForRepayment,
                DEFAULT_INTEREST_RATE_MODE,
                user
            );

            uint256 difference = amountForRepayment - actualAmountRepaid;
            if(difference > 0) {
                require(
                    IERC20(tokenConfig[token].token).transfer(user, difference),
                    "transfer to user failed"
                );
                if(tokenConfig[token].token == token) {
                    uint256 adjustedDaoFees = daoFees > difference ? daoFees - difference : 0;
                    uint256 adjustedSenderTips = senderTips;
                    uint256 remainingDifference = difference > daoFees ? difference - daoFees : 0;
                    if(remainingDifference > 0) {
                        adjustedSenderTips = senderTips > remainingDifference ? senderTips - remainingDifference : 0;
                    }
                    totalDaoFees = totalDaoFees - daoFees + adjustedDaoFees;
                    totalSenderTips = totalSenderTips - senderTips + adjustedSenderTips;
                }
            }

            _updateTimestampAndEmitEvent(user, token, actualAmountRepaid);
        }
        
        if (totalDaoFees > 0 || totalSenderTips > 0) {
            _transferFees(token, totalDaoFees, totalSenderTips);
            
            emit FeesCollected(
                address(0),
                token,
                totalDaoFees,
                totalSenderTips,
                msg.sender
            );
        }
    }

    function whoami() external view returns (bool isAdmin, bool isOperator, bool isEmergency) {
        address sender = msg.sender;
        return (
          hasRole(DEFAULT_ADMIN_ROLE, sender),
          hasRole(OPERATOR_ROLE, sender),
          hasRole(EMERGENCY_ROLE, sender)
        );
    }

    /**
     * @notice Retrieves a user's configuration for a specific token
     * @param user Address of the user
     * @param token Address of the token
     * @return MaxAmount The maximum amount per week for this token
     * @return lastRepayTimestamp Timestamp of the last repayment (shared across tokens)
     */
    function getUserConfigForToken(address user, address token) 
        external 
        view 
        returns (
            uint256,
            uint256,
            uint256
        ) 
    {
        return (
            allowedMaxAmounts[user][token],
            periodicity[user][token],
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
        for (uint256 i = 0; i < _authorizedTokensList.length; i++) {
            if (tokenConfig[_authorizedTokensList[i]].active && 
                allowedMaxAmounts[user][_authorizedTokensList[i]] > 0) {
                authorizedCount++;
            }
        }
        
        // Create arrays with the right size
        tokens = new address[](authorizedCount);
        maxAmounts = new uint256[](authorizedCount);
        
        // Fill arrays
        uint256 index = 0;
        for (uint256 i = 0; i < _authorizedTokensList.length; i++) {
            if (tokenConfig[_authorizedTokensList[i]].active && 
                allowedMaxAmounts[user][_authorizedTokensList[i]] > 0) {
                tokens[index] = _authorizedTokensList[i];
                maxAmounts[index] = allowedMaxAmounts[user][_authorizedTokensList[i]];
                index++;
            }
        }
    }

    /**
     * @notice Allows admins to authorize a new token pair
     * @param token The token address to authorize
     * @param debtToken The debt token address associated with the token
     * @param supplyToken The supply token address associated with the token
     */
    function authorizeTokenTriple(address token, address debtToken, address supplyToken) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        _authorizeTokenPair(token, debtToken, supplyToken);
    }

    /**
     * @notice Internal function to authorize a token pair
     * @param token The token address to authorize
     * @param debtToken The debt token address associated with the token
     * @param supplyToken The supply token address associated with the token
     */
    function _authorizeTokenPair(address token, address debtToken, address supplyToken) internal {
        TokenConfig memory config = TokenConfig({
            token: token,
            debtToken: debtToken,
            supplyToken: supplyToken,
            active: true
        });
        
        tokenConfig[token] = config;
        tokenConfig[supplyToken] = config;
        _authorizedTokensList.push(token);
        emit TokenTripleAuthorized(token, debtToken, supplyToken);
    }

    /**
     * @notice Allows admins to unauthorize a token
     * @param token The token address to unauthorize
     */
    function unauthorizeToken(address token) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        tokenConfig[token].active = false;
        tokenConfig[tokenConfig[token].supplyToken].active = false;

        // Remove from authorizedTokensList
        for (uint256 i = 0; i < _authorizedTokensList.length; i++) {
            if (_authorizedTokensList[i] == token) {
                _authorizedTokensList.pop();
                break;
            }
        }
        emit TokenUnauthorized(token);
    }

    /**
     * @notice Internal function to remove a user from the system for all tokens
     * @param user The user to remove
     */
    function _removeUserAllTokens(address user) internal {
        // NOTE Solidity: key removing is impossible
        for (uint256 i = 0; i < _authorizedTokensList.length; i++) {
            allowedMaxAmounts[user][tokenConfig[_authorizedTokensList[i]].supplyToken] = 0;
            allowedMaxAmounts[user][_authorizedTokensList[i]] = 0;
            periodicity[user][tokenConfig[_authorizedTokensList[i]].supplyToken] = 0;
            periodicity[user][_authorizedTokensList[i]] = 0;
        }
        lastRepayTimestamps[user] = 0;
        emit Rent2RepayRevokedAll(msg.sender);
    }


    /*
     * @notice Internal function to check if a new week has started
     * @param lastTimestamp The last recorded timestamp
     * @return true if more than a week has passed since lastTimestamp
     */
    function _isNewPeriod(address _user, address _token) internal view returns (bool) {
        return block.timestamp >= lastRepayTimestamps[_user] + periodicity[_user][_token];
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

        if (daoFeeReductionToken != address(0) && daoFeeReductionMinimumAmount > 0) {
            uint256 userBalance = IERC20(daoFeeReductionToken).balanceOf(user);
            if (userBalance >= daoFeeReductionMinimumAmount) {
                // Reduce DAO fees by the configured percentage (BPS)
                uint256 reductionAmount = (daoFees * daoFeeReductionBPS) / 10000;
                daoFees = daoFees - reductionAmount;
            }
        }
        
        uint256 totalFees = daoFees + senderTips;   
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
        onlyRole(ADMIN_ROLE) 
    {
        IERC20(token).transfer(to, amount);
    }

    /**
     * @notice Allows admin to update DAO fees
     * @param newFeesBPS New DAO fees in basis points (BPS) - 10000 = 100%
     */
    function updateDaoFees(uint256 newFeesBPS) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (newFeesBPS + senderTipsBPS > 10000) revert InvalidFeesBPS();
        
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
        if (daoFeesBPS + newTipsBPS > 10000) revert InvalidTipsBPS();
        
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
            require(IERC20(token).transfer(daoTreasuryAddress, daoFees), "Transfer to DAO failed");
        }
        
        if (senderTips > 0) {
            require(IERC20(token).transfer(msg.sender, senderTips), "Transfer to sender failed");
        }
    }

    // Helper function to update timestamps and emit events
    function _updateTimestampAndEmitEvent(
        address user,
        address token,
        uint256 actualAmountRepaid
    ) internal {
        lastRepayTimestamps[user] = block.timestamp;
        emit RepaymentExecuted(
            user, 
            token,
            actualAmountRepaid, 
            allowedMaxAmounts[user][token],
            msg.sender
        );
    }

    /**
     * @notice Gets the debt token address for a given token
     * @param token The token address
     * @return The debt token address associated with the token
     */
    function getDebtToken(address token) external view returns (address) {
        return tokenConfig[token].debtToken;
    }

    /**
     * @notice Gets the token configuration for a given token
     * @param token The token address
     * @return tokenAddress The token address
     * @return debtToken The debt token address
     * @return supplyToken The supply token address
     * @return active Whether the token is active
     */
    function getTokenConfig(address token) external view returns (
        address tokenAddress,
        address debtToken,
        address supplyToken,
        bool active
    ) {
        TokenConfig memory cfg = tokenConfig[token];
        return (cfg.token, cfg.debtToken, cfg.supplyToken, cfg.active);
    }

    /**
     * @notice Returns the version of the contract
     * @return Version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
} 