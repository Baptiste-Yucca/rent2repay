// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
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
contract Rent2Repay is 
    Initializable, 
    AccessControlUpgradeable, 
    PausableUpgradeable, 
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable 
{
   
    /// @notice Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    struct TokenConfig {
        address token;
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

    /// @dev Note: authorizedTokens mapping removed - now using tokenConfig[token].active
    
    /// @notice Maps token addresses to their debt token addresses
    mapping(address => TokenConfig) public tokenConfig;

    /// @notice Array to keep track of authorized tokens
    address[] public authorizedTokensList;

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

    /// @notice Emitted when a user revokes all their Rent2Repay authorizations
    /// @param user The user address that revoked all authorizations
    event RevokedR2R (address indexed user);

    /// @notice Emitted when a user configure all their Rent2Repay authorizations
    /// @param user The user address that revoked all authorizations
    event ConfiguredR2R (address indexed user);


    /// @notice Custom errors for better gas efficiency
    error UserNotAuthorized();
    error InvalidTokenAddress();
    error TokenNotAuthorized();
    error InvalidFeesBPS();
    error InvalidTipsBPS();


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
     * @param wxdaiArmmToken Address of the WXDAI supply token
     * @param usdcToken Address of the USDC token
     * @param usdcArmmToken Address of the USDC supply token
     */
    function initialize(
        address admin, 
        address emergency, 
        address operator,
        address _rmm,
        address wxdaiToken,
        address wxdaiArmmToken,
        address usdcToken,
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
        
        /// @dev Initialize default fee values
        daoFeesBPS = 50; /// @dev 0.5% default
        senderTipsBPS = 25; /// @dev 0.25% default
        daoFeeReductionBPS = 5000; /// @dev 50% default
        
        /// @dev Initialize with WXDAI and USDC as authorized token pairs
        _authorizeTokenPair(wxdaiToken, wxdaiArmmToken);
        _authorizeTokenPair(usdcToken, usdcArmmToken);
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
    ) external whenNotPaused {
        uint256 len = tokens.length;
        require(len > 0 && len == amounts.length, "Invalid array lengths");
            
        /// @dev Force to clean up data
        uint256 maxLength = authorizedTokensList.length;
        for (uint256 i = 0; i < maxLength;) {
            allowedMaxAmounts[msg.sender][authorizedTokensList[i]] = 0;
            periodicity[msg.sender][authorizedTokensList[i]] = 0;
            unchecked { ++i; }
        }
        
        /// @dev Valorize values
        for (uint256 i = 0; i < len;) {
            require(tokens[i] != address(0) && tokenConfig[tokens[i]].active && amounts[i] > 0,
                "Invalid token or amount");
            allowedMaxAmounts[msg.sender][tokens[i]] = amounts[i];
            periodicity[msg.sender][tokens[i]] = period == 0 ? 1 weeks : period;
            unchecked { ++i; }
        }
        
        /// @dev Initialize/activate user with timestamp (0 = inactive, !=0 = active)
        if (lastRepayTimestamps[msg.sender] == 0) {
            lastRepayTimestamps[msg.sender] = _timestamp > 0 ? _timestamp : 1;
        }
        emit ConfiguredR2R(msg.sender);
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
        emit RevokedR2R(user);
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
     * @notice Checks if a user has authorized the Rent2Repay mechanism
     * @param user Address of the user to check
     * @return true if authorized, false otherwise
     */
    function isAuthorized(address user) public view returns (bool) {
        return lastRepayTimestamps[user] != 0;
    }
    

    /**
     * @notice Helper function to perform security checks and configuration validation
     * @dev Validates user authorization and token configuration
     * @param user The user address to validate
     * @param token The token address to validate
     */
    function _validateUserAndToken(address user, address token) internal view {
        require(lastRepayTimestamps[user] != 0, "User not authorized");
        require(allowedMaxAmounts[user][token] > 0, "User not configured for token");
        require(periodicity[user][token] > 0, "Periodicity not set");
        require(_isNewPeriod(user, token), "Wait next period");
    }

    /**
     * @notice Internal function to process a single user repayment
     * @dev Contains the common logic for both rent2repay and batchRent2Repay
     * @param user The user address to process repayment for
     * @param token The token address to process
     * @return adjustedDaoFees The DAO fees after adjustment for any difference
     * @return senderTips The sender tips amount
     * @return actualAmountRepaid The actual amount repaid to RMM
     */
    function _processUserRepayment(address user, address token) 
        internal 
        returns (uint256 adjustedDaoFees, uint256 senderTips, uint256 actualAmountRepaid) 
    {
        _validateUserAndToken(user, token);
        
        /// @dev Step 1: Calculate and transfer tokens
        uint256 daoFees;
        uint256 amountForRepayment;
        (daoFees, senderTips, amountForRepayment) = _handleTokenTransferAndFees(user, token);
        
        /// @dev Step 2: Perform RMM repayment and adjust fees
        (actualAmountRepaid, adjustedDaoFees) = _handleRmmRepayment(
            user, token, daoFees, amountForRepayment
        );
        
        lastRepayTimestamps[user] = block.timestamp;
        /// @dev No emit, transfer ERC20, track them from TheGraph
    }

    /**
     * @notice Internal function to handle token transfer and fee calculation
     * @dev Reduces stack depth by separating token transfer logic
     * @param user The user address
     * @param token The token address
     * @return daoFees The calculated DAO fees
     * @return senderTips The calculated sender tips
     * @return amountForRepayment The amount to be used for repayment
     */
    function _handleTokenTransferAndFees(address user, address token) 
        internal 
        returns (uint256 daoFees, uint256 senderTips, uint256 amountForRepayment) 
    {
        uint256 amount = allowedMaxAmounts[user][token];
        uint256 balance = IERC20(token).balanceOf(user);
        uint256 toTransfer = balance < amount ? balance : amount;

        (daoFees, senderTips, amountForRepayment) = _calculateFees(toTransfer, user);

        require(
            IERC20(token).transferFrom(user, address(this), toTransfer),
            "transferFrom to R2R failed"
        );
    }

    /**
     * @notice Internal function to handle RMM repayment
     * @dev Reduces stack depth by separating RMM interaction logic
     * @param user The user address
     * @param token The token address
     * @param daoFees The DAO fees amount
     * @param amountForRepayment The amount to be used for repayment
     * @return actualAmountRepaid The actual amount repaid to RMM
     * @return adjustedDaoFees The DAO fees after adjustment for any difference
     */
    function _handleRmmRepayment(
        address user, 
        address token, 
        uint256 daoFees,
        uint256 amountForRepayment
    ) 
        internal 
        returns (uint256 actualAmountRepaid, uint256 adjustedDaoFees) 
    {

        if(tokenConfig[token].supplyToken == token) {
            /// @dev Note: if fail, revert all
            require(
                rmm.withdraw(
                    tokenConfig[token].token, 
                    amountForRepayment, 
                    address(this)
                ) == amountForRepayment, 
                "Withdrawn amount mismatch"
            );
        }
        
        actualAmountRepaid = rmm.repay(
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

        /// @dev Adjust fees if there is difference
        adjustedDaoFees = daoFees;
        if(difference > 0) {
            adjustedDaoFees = daoFees > difference ? daoFees - difference : 0; 
        }
    }

    function rent2repay(address user, address token) 
        external 
        whenNotPaused
        validTokenAddress(token)
        onlyAuthorizedToken(token)
        nonReentrant
    {
        (
            uint256 adjustedDaoFees,
            uint256 senderTips,
            
        ) = _processUserRepayment(user, token);

        /// @dev Transfer fees to respective addresses
        _transferFees(token, adjustedDaoFees, senderTips);
    }

    function batchRent2Repay(address[] calldata users, address token) 
        external 
        whenNotPaused
        validTokenAddress(token)
        onlyAuthorizedToken(token)
        nonReentrant
    {
        uint256 totalDaoFees =0;
        uint256 totalSenderTips =0;
        uint256 adjustedDaoFees =0;
        uint256 senderTips =0;
        address user ;
     
        
        for (uint256 i = 0; i < users.length;) {
            user = users[i];
            require(user != address(0), "Invalid user address");
            
            (
                adjustedDaoFees,
                senderTips,
                
            ) = _processUserRepayment(user, token);

            totalDaoFees += adjustedDaoFees;
            totalSenderTips += senderTips;

            unchecked { ++i; }
        }
        
        if (totalDaoFees > 0 || totalSenderTips > 0) {
            _transferFees(token, totalDaoFees, totalSenderTips);
        }
    }

    function whoami() external view returns (bool isAdmin, bool isOperator, bool isEmergency) {
        return (
          hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
          hasRole(OPERATOR_ROLE, msg.sender),
          hasRole(EMERGENCY_ROLE, msg.sender)
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
        /// @dev If user is not authorized, return empty arrays
        if (lastRepayTimestamps[user] == 0) {
            return (new address[](0), new uint256[](0));
        }

        uint256 maxLength = authorizedTokensList.length;
        tokens = new address[](maxLength);
        maxAmounts = new uint256[](maxLength);

        uint256 index;
        for (uint256 i = 0; i < maxLength; ) {
            if (
                tokenConfig[authorizedTokensList[i]].active &&
                allowedMaxAmounts[user][authorizedTokensList[i]] > 0
            ) {
                tokens[index] = authorizedTokensList[i];
                maxAmounts[index] = allowedMaxAmounts[user][authorizedTokensList[i]];
                unchecked { ++index; }
            }
            unchecked { ++i; }
        }

        assembly {
            mstore(tokens, index)
            mstore(maxAmounts, index)
        }
    }

    /**
     * @notice Allows admins to authorize a new token pair
     * @param token The token address to authorize
     * @param supplyToken The supply token address associated with the token
     */
    function authorizeTokenPair(address token, address supplyToken) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        _authorizeTokenPair(token, supplyToken);
    }

    /**
     * @notice Internal function to authorize a token pair
     * @param token The token address to authorize
     * @param supplyToken The supply token address associated with the token
     */
    function _authorizeTokenPair(address token, address supplyToken) internal {
        TokenConfig memory config = TokenConfig({
            token: token,
            supplyToken: supplyToken,
            active: true
        });
        
        tokenConfig[token] = config;
        tokenConfig[supplyToken] = config;
        authorizedTokensList.push(token);
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

        /// @dev Remove from authorizedTokensList
        for (uint256 i = 0; i < authorizedTokensList.length;) {
            if (authorizedTokensList[i] == token) {
                authorizedTokensList.pop();
                break;
            }
            unchecked { ++i; }
        }
    }

    /**
     * @notice Allows admins to give approval for tokens to external contracts
     * @dev This function must be called before using rent2repay functions to approve tokens to RMM
     * @param token The token address to approve
     * @param spender The address that will be approved to spend the tokens (e.g., RMM contract)
     * @param amount The amount to approve (use type(uint256).max for unlimited approval)
     */
    function giveApproval(
        address token,
        address spender,
        uint256 amount
    ) 
        external 
        onlyRole(ADMIN_ROLE)
    {
        require(spender != address(0), "Invalid spender address");
        require(amount > 0, "Amount must be greater than 0");
        
        require(
            IERC20(token).approve(spender, amount),
            "Approval failed"
        );
    }

    /**
     * @notice Internal function to remove a user from the system for all tokens
     * @dev Optimized: Only disable user globally via timestamp (massive gas savings)
     * @param user The user to remove
     */
    function _removeUserAllTokens(address user) internal {
        lastRepayTimestamps[user] = 0;
        emit RevokedR2R(user);
    }

    /**
     * @notice Internal function to check if a new week has started
     * @param _user The user address
     * @param _token The token address
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
        /// @dev Calculate base fees
        daoFees = (amount * daoFeesBPS) / 10000;
        senderTips = (amount * senderTipsBPS) / 10000;

        if (daoFeeReductionToken != address(0) && daoFeeReductionMinimumAmount > 0) {
            uint256 userBalance = IERC20(daoFeeReductionToken).balanceOf(user);
            if (userBalance >= daoFeeReductionMinimumAmount) {
                /// @dev Reduce DAO fees by the configured percentage (BPS)
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
        daoFeesBPS = newFeesBPS;
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
        senderTipsBPS = newTipsBPS;
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
        daoFeeReductionToken = newToken;
    }

    /**
     * @notice Allows admin to update DAO fee reduction minimum amount
     * @param newMinimumAmount The new minimum amount required for fee reduction
     */
    function updateDaoFeeReductionMinimumAmount(uint256 newMinimumAmount) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        daoFeeReductionMinimumAmount = newMinimumAmount;
    }

    /**
     * @notice Allows admin to update DAO fee reduction percentage
     * @param newPercentage The new reduction percentage in BPS
     */
    function updateDaoFeeReductionPercentage(uint256 newPercentage) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        daoFeeReductionBPS = newPercentage;
    }

    /**
     * @notice Allows admin to update DAO treasury address
     * @param newAddress The new DAO treasury address
     */
    function updateDaoTreasuryAddress(address newAddress) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        daoTreasuryAddress = newAddress;
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


    /**
     * @notice Gets the token configuration for a given token
     * @param token The token address
     * @return tokenAddress The token address
     * @return supplyToken The supply token address
     * @return active Whether the token is active
     */
    function getTokenConfig(address token) external view returns (
        address tokenAddress,
        address supplyToken,
        bool active
    ) {
        TokenConfig memory cfg = tokenConfig[token];
        return (cfg.token, cfg.supplyToken, cfg.active);
    }

    /**
     * @notice Returns an array of active token addresses
     * @dev Gas-optimized function that filters out inactive tokens using assembly for resizing
     * @return activeTokens Array of currently active token addresses
     */
    function getActiveTokens() external view returns (address[] memory activeTokens) {
        uint256 len = authorizedTokensList.length;
        /// @dev Allocate array with maximum size directly
        activeTokens = new address[](len);

        uint256 count;
        for (uint256 i; i < len; ) {
            address t = authorizedTokensList[i];
            if (tokenConfig[t].active) {
                activeTokens[count] = t;
                unchecked { ++count; }
            }
            unchecked { ++i; }
        }

        // Shrink array by writing count as new length using assembly
        assembly { 
            mstore(activeTokens, count) 
        }
    }

    /**
     * @notice Authorizes contract upgrades - only ADMIN_ROLE can upgrade
     * @dev Required by UUPSUpgradeable. This ensures only admins can upgrade the contract
     * @param newImplementation Address of the new implementation contract
     */
    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyRole(ADMIN_ROLE) 
    {}

    /**
     * @notice Returns the version of the contract
     * @return Version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
} 