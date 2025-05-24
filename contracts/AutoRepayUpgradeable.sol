// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IRMM {
    function repay(address borrower, uint256 amount) external;
}

contract AutoRepayUpgradeable is 
    Initializable, 
    UUPSUpgradeable, 
    AccessControlUpgradeable, 
    PausableUpgradeable,
    ReentrancyGuardUpgradeable 
{
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");

    struct AutoRepayConfig {
        uint256 weeklyLimit;
        uint256 lastReset;
        uint256 amountSpentThisWeek;
        address token;
        bool isActive;
    }

    mapping(address => AutoRepayConfig) public autoRepaySettings;
    
    uint256 public botFeeBps;
    uint256 public daoFeeBps;
    address public daoFeeRecipient;
    address public constant RMM_ADDRESS = 0xC759AA7f9dd9720A1502c104DaE4F9852bb17C14;

    event AutoRepayAuthorized(address indexed user, uint256 weeklyLimit, address token);
    event AutoRepayRevoked(address indexed user);
    event AutoRepaid(address indexed user, address indexed executor, uint256 amount);
    event FeesUpdated(uint256 botFeeBps, uint256 daoFeeBps);
    event DaoFeeRecipientUpdated(address newRecipient);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin_,
        uint256 _botFeeBps,
        uint256 _daoFeeBps,
        address _daoFeeRecipient
    ) public initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(UPGRADER_ROLE, admin_);
        _grantRole(PAUSER_ROLE, admin_);
        _grantRole(FEE_MANAGER_ROLE, admin_);

        botFeeBps = _botFeeBps;
        daoFeeBps = _daoFeeBps;
        daoFeeRecipient = _daoFeeRecipient;
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function authorizeAutoRepay(uint256 weeklyLimit, address token) external whenNotPaused {
        require(weeklyLimit > 0, "Limit must be > 0");
        require(token != address(0), "Invalid token");

        autoRepaySettings[msg.sender] = AutoRepayConfig({
            weeklyLimit: weeklyLimit,
            lastReset: block.timestamp,
            amountSpentThisWeek: 0,
            token: token,
            isActive: true
        });

        emit AutoRepayAuthorized(msg.sender, weeklyLimit, token);
    }

    function revokeAutoRepay() external {
        require(autoRepaySettings[msg.sender].isActive, "Not authorized");
        
        autoRepaySettings[msg.sender].isActive = false;
        emit AutoRepayRevoked(msg.sender);
    }

    function executeAutoRepay(address user, uint256 amount) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        AutoRepayConfig storage config = autoRepaySettings[user];
        require(config.isActive, "User not enrolled");

        // Reset weekly limit if needed
        if (block.timestamp >= config.lastReset + 7 days) {
            config.lastReset = block.timestamp;
            config.amountSpentThisWeek = 0;
        }

        require(config.amountSpentThisWeek + amount <= config.weeklyLimit, "Exceeds weekly limit");

        // Calculate fees
        uint256 botFee = (amount * botFeeBps) / 10000;
        uint256 daoFee = (amount * daoFeeBps) / 10000;
        uint256 netAmount = amount - botFee - daoFee;

        // Transfer tokens from user
        IERC20Upgradeable(config.token).transferFrom(user, address(this), amount);

        // Transfer fees
        IERC20Upgradeable(config.token).transfer(msg.sender, botFee);
        IERC20Upgradeable(config.token).transfer(daoFeeRecipient, daoFee);

        // Approve and repay
        IERC20Upgradeable(config.token).approve(RMM_ADDRESS, netAmount);
        IRMM(RMM_ADDRESS).repay(user, netAmount);

        config.amountSpentThisWeek += amount;
        emit AutoRepaid(user, msg.sender, amount);
    }

    function updateFees(uint256 _botFeeBps, uint256 _daoFeeBps) 
        external 
        onlyRole(FEE_MANAGER_ROLE) 
    {
        require(_botFeeBps + _daoFeeBps <= 1000, "Fees too high");
        botFeeBps = _botFeeBps;
        daoFeeBps = _daoFeeBps;
        emit FeesUpdated(_botFeeBps, _daoFeeBps);
    }

    function updateDaoFeeRecipient(address _newRecipient) 
        external 
        onlyRole(FEE_MANAGER_ROLE) 
    {
        require(_newRecipient != address(0), "Invalid address");
        daoFeeRecipient = _newRecipient;
        emit DaoFeeRecipientUpdated(_newRecipient);
    }
} 