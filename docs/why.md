# Why? - Rent2Repay Technical Design Rationale

This document explains the **why** behind every important architectural decision in the Rent2Repay smart contract system. Essential for developer handoff and maintenance.

## Table of Contents
- [Core Architecture Decisions](#core-architecture-decisions)
- [State Variables](#state-variables)
- [Contract Inheritance](#contract-inheritance)
- [Functions Design](#functions-design)
- [Events & Errors](#events--errors)
- [Security Features](#security-features)
- [Fee System](#fee-system)

---

## Core Architecture Decisions

### Why Upgradeable Contract Pattern?
**Decision**: Using OpenZeppelin's upgradeable contracts with proxy pattern
**Rationale**: The protocol needs ability to fix bugs, add features, and adapt to changing requirements.

### Why Multi-Token Support?
**Decision**: Supporting multiple tokens (WXDAI, USDC, and possible future others supply tokens)
**Rationale**: Users may have different stablecoins or want to use yield-bearing tokens. Flexibility increases adoption and provides better UX.

### Why TokenConfig Struct?
**Decision**: Mapping tokens to config with `token`, `debtToken`, `supplyToken`, `active`
**Rationale**: Each token can have both a base version, a yield-bearing version &  debt version. For an example : USDC, armmUSDC & debtUSDC.

---

## State Variables

### `allowedMaxAmounts[user][token]`
**Why**: Per-user, per-token spending limits. Prevents unlimited token access - users explicitly authorize maximum amounts they're comfortable with.
Note: that the gathered maount by the Rent2repay and not the repayed amount. units = wei.

### `lastRepayTimestamps[user]`
**Why**: Shared timestamp across all tokens for a user. Simplifies the logic and prevents timing manipulation by users across different tokens. format: epoch time.

### `periodicity[user][token]`
**Why**: Allows custom repayment frequencies per token (weekly, bi-weekly, monthly and even more). Different tokens may need different repayment schedules. units = seconds.

### `daoFeesBPS` & `senderTipsBPS`
**Why**: Basis points (10000 = 100%) for precise fee calculation. BPS prevents rounding errors and allows sub-percentage precision.

### `daoFeeReductionToken`
**Why**: Governance token, powervoting token or any other ERC-20 token.

### `_authorizedTokensList`
**Why**: Array to iterate over authorized tokens since mapping keys can't be enumerated. Necessary for user configuration queries.
chianed list could be gooad alternative due to there is no more 3 or 4 tokens (USDC, WXDAI, REUSD, and ... ?)

---

## Contract Inheritance

### `AccessControlUpgradeable`
**Why**: Role-based permissions (ADMIN, OPERATOR, EMERGENCY). Different roles need different capabilities - admins configure fees, operators can remove users, emergency can pause.

### `PausableUpgradeable`
**Why**: Circuit breaker for emergencies. Financial protocols need ability to halt operations if vulnerabilities are discovered.

### `ReentrancyGuardUpgradeable`
**Why**: Prevents reentrancy attacks on functions that transfer tokens. Critical security measure for functions handling external calls.

---

## Functions Design

### `initialize()` instead of `constructor()`
**Why**: Upgradeable contracts can't use constructors. Initialize pattern ensures proper setup with proxy contracts.

### `configureRent2Repay()` & `revokeRent2Repay()`accepts arrays
**Why**: Gas efficiency - users can configure multiple tokens in one transaction instead of multiple separate transactions. Note there is just configure or revoke.

### `Rent2Repay()` for one user, `batchRent2Repay()` for multiple users
**Why**: 2nd one is gas efficiency for 'Repayer/Bot'. Processing multiple users in one transaction reduces gas costs significantly.

### `getUserConfigs()` returns dynamic arrays
**Why**: Frontend and Repayer/Bot needs to display all user configurations. Dynamic arrays handle varying numbers of configured tokens per user.

---

## Events & Errors
### `Rent2RepayConfigured` with arrays
**Why**: Frontend needs to know all tokens configured in one transaction. Arrays match the function parameters.

### `FeesCollected` in batch operations
**Why**: Transparency and accounting. DAO and users need to track fee collection, especially in batch operations where fees are aggregated.

### `RepaymentExecuted` with `remainingThisWeek`
**Why**: Frontend can show users their remaining allowance without additional contract calls.

---

## Security Features
### `nonReentrant` on critical functions
**Why**: Transfer functions are vulnerable to reentrancy. Protection prevents malicious contracts from exploiting token transfers.

### `whenNotPaused` on user-facing functions
**Why**: Emergency stop capability. If vulnerabilities are found, the contract can be paused while fixes are deployed.

### Difference adjustment logic
**Why**: RMM.repay() might return less than requested (due to available debt). The difference must be properly handled to maintain user trust. What about RMM.withdraw() ?

---

## Fee System

### Why Basis Points (BPS)?
**Decision**: Using 10000 = 100% system
**Rationale**: Allows precise sub-percentage fees (e.g., 0.25% = 25 BPS). Standard in DeFi and prevents rounding errors.

### Why DAO Fee Reduction?
**Decision**: Token holders get fee discounts
**Rationale**: Creates utility for governance tokens and rewards protocol stakeholders. Common DeFi pattern for protocol tokens.

### Why Fee Adjustment on Difference? in case RMM.repay() needs less stablecoins.
**Decision**: If actual repayment < intended, adjust fees proportionally
**Rationale**: Users shouldn't pay full fees if full repayment wasn't possible. Maintains proportional fee structure.

---

## Integration Patterns

### Why IRMM Interface?
**Decision**: Abstract interface for RMM integration
**Rationale**: Allows testing with mocks and potential integration with other lending protocols. Interface segregation principle.

### Why Supply Token Support?
**Decision**: Support both base tokens (USDC) and yield-bearing tokens (aUSDC)
**Rationale**: Users might want to use yield-bearing assets for repayments. Maximizes capital efficiency.

---

## Data Structure Decisions

### Why TokenPair Struct?
**Decision**: Group related token addresses
**Rationale**: Ensures consistency and makes token relationships explicit. Prevents mismatched token configurations.

### Why Shared Timestamps?
**Decision**: One timestamp per user across all tokens
**Rationale**: RealT rents are distributed with only one kind token.

### Why Active Boolean in TokenConfig?
**Decision**: Soft delete instead of removing mappings
**Rationale**: Solidity can't delete mapping entries. Boolean flag allows deactivation while preserving historical data.

---

## Future-Proofing


### Why Emergency Recovery?
**Decision**: Admin can recover accidentally sent tokens
**Rationale**: Users might accidentally send tokens to the contract. Recovery function prevents permanent loss.

### Why Modular Fee System?
**Decision**: Separate functions for each fee parameter
**Rationale**: Allows granular control and easier governance. Each parameter can be adjusted independently.

---

*This document should be updated whenever significant architectural changes are made to the contract.* 