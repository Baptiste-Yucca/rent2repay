# Solidity API

## Rent2RepayAuthorizer

A contract that manages authorization for the Rent2Repay mechanism

_This contract allows users to configure weekly spending limits for automated loan repayments
Users can set a maximum amount that can be spent per week and the contract tracks usage_

### UserConfig

Structure to store all user information

```solidity
struct UserConfig {
  uint256 weeklyMaxAmount;
  uint256 lastRepayTimestamp;
  uint256 currentWeekSpent;
}
```

### userConfigs

```solidity
mapping(address => struct Rent2RepayAuthorizer.UserConfig) userConfigs
```

Maps user addresses to their configuration

### Rent2RepayConfigured

```solidity
event Rent2RepayConfigured(address user, uint256 weeklyMaxAmount)
```

Emitted when a user configures the Rent2Repay mechanism

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | The user address that configured the system |
| weeklyMaxAmount | uint256 | The weekly maximum amount set by the user |

### Rent2RepayRevoked

```solidity
event Rent2RepayRevoked(address user)
```

Emitted when a user revokes their Rent2Repay authorization

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | The user address that revoked authorization |

### RepaymentExecuted

```solidity
event RepaymentExecuted(address user, uint256 amount, uint256 remainingThisWeek)
```

Emitted when a repayment is executed

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | The user for whom the repayment was executed |
| amount | uint256 | The amount that was repaid |
| remainingThisWeek | uint256 | The remaining amount available this week |

### AmountMustBeGreaterThanZero

```solidity
error AmountMustBeGreaterThanZero()
```

Custom errors for better gas efficiency

### UserNotAuthorized

```solidity
error UserNotAuthorized()
```

### WeeklyLimitExceeded

```solidity
error WeeklyLimitExceeded()
```

### validAmount

```solidity
modifier validAmount(uint256 amount)
```

Validates that an amount is greater than zero

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount to validate |

### onlyAuthorized

```solidity
modifier onlyAuthorized(address user)
```

Validates that a user is authorized

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | The user address to validate |

### configureRent2Repay

```solidity
function configureRent2Repay(uint256 weeklyMaxAmount) external
```

Configures the Rent2Repay mechanism for the caller

_Sets up weekly spending limits for automated repayments_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| weeklyMaxAmount | uint256 | Maximum amount authorized per week (must be > 0) |

### revokeRent2Repay

```solidity
function revokeRent2Repay() external
```

Revokes the Rent2Repay authorization for the caller

_Completely removes the user's configuration and authorization_

### isAuthorized

```solidity
function isAuthorized(address user) public view returns (bool)
```

Checks if a user has authorized the Rent2Repay mechanism

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | Address of the user to check |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | true if authorized (weeklyMaxAmount > 0), false otherwise |

### getAvailableAmountThisWeek

```solidity
function getAvailableAmountThisWeek(address user) public view returns (uint256)
```

Calculates the available amount for repayment this week

_If more than a week has passed since last repayment, resets the weekly counter_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | Address of the user |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Available amount for repayment this week |

### validateAndUpdateRepayment

```solidity
function validateAndUpdateRepayment(address user, uint256 amount) external returns (bool)
```

Validates and updates repayment limits before a repayment

_This function should be called before executing any repayment to ensure limits are respected_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | Address of the user for whom to execute the repayment |
| amount | uint256 | Amount to be repaid |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | true if the repayment is authorized and limits updated |

### getUserConfig

```solidity
function getUserConfig(address user) external view returns (uint256, uint256, uint256)
```

Retrieves a user's configuration

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | Address of the user |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | weeklyMaxAmount The maximum amount per week |
| [1] | uint256 | lastRepayTimestamp Timestamp of the last repayment |
| [2] | uint256 | currentWeekSpent Amount spent in the current week |

### _isNewWeek

```solidity
function _isNewWeek(uint256 lastTimestamp) internal view returns (bool)
```

Internal function to check if a new week has started

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| lastTimestamp | uint256 | The last recorded timestamp |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | true if more than a week has passed since lastTimestamp |

