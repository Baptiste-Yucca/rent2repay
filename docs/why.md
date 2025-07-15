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
**Rationale**: The protocol needs ability to fix bugs, add features, and adapt to changing requirements without losing user configurations or requiring re-deployment. Critical for a financial protocol handling user funds.

### Why Multi-Token Support?
**Decision**: Supporting multiple tokens (WXDAI, USDC, supply tokens)
**Rationale**: Users may have different stablecoins or want to use yield-bearing tokens. Flexibility increases adoption and provides better UX.

### Why TokenConfig Struct?
**Decision**: Mapping tokens to config with `token`, `debtToken`, `supplyToken`, `active`
**Rationale**: Each token can have both a base version (USDC) and a yield-bearing version (aUSDC). The struct allows tracking relationships and enabling/disabling tokens cleanly.

---

## State Variables

### `_WEEK_IN_SECONDS = 7 * 24 * 60 * 60`
**Why**: Constant for weekly periods in user configurations. Hardcoded because weekly cycles are a core business rule that shouldn't change arbitrarily.

### `allowedMaxAmounts[user][token]`
**Why**: Per-user, per-token spending limits. Prevents unlimited token access - users explicitly authorize maximum amounts they're comfortable with.

### `lastRepayTimestamps[user]`
**Why**: Shared timestamp across all tokens for a user. Simplifies the logic and prevents timing manipulation by users across different tokens.

### `periodicity[user][token]`
**Why**: Allows custom repayment frequencies per token (weekly, bi-weekly, monthly). Different tokens may need different repayment schedules.

### `daoFeesBPS` & `senderTipsBPS`
**Why**: Basis points (10000 = 100%) for precise fee calculation. BPS prevents rounding errors and allows sub-percentage precision.

### `daoFeeReductionToken`
**Why**: Governance token holders get fee discounts. Creates utility for the protocol's governance token and rewards long-term stakeholders.

### `_authorizedTokensList`
**Why**: Array to iterate over authorized tokens since mapping keys can't be enumerated. Necessary for user configuration queries.

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

### `configureRent2Repay()` accepts arrays
**Why**: Gas efficiency - users can configure multiple tokens in one transaction instead of multiple separate transactions.

### `batchRent2Repay()` for multiple users
**Why**: Gas efficiency for operators. Processing multiple users in one transaction reduces gas costs significantly.

### `_validateUserAndToken()` helper
**Why**: DRY principle - validation logic is reused in both single and batch repayment functions. Reduces code duplication and gas costs.

### `_calculateFees()` returns multiple values
**Why**: Fee calculation is complex (base fees + reductions). Returning structured data makes the logic clear and reusable.

### `getUserConfigs()` returns dynamic arrays
**Why**: Frontend needs to display all user configurations. Dynamic arrays handle varying numbers of configured tokens per user.

---

## Events & Errors

### Custom Errors instead of `require()` strings
**Why**: Gas efficiency. Custom errors use less gas than string messages and provide better error handling in frontend.

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

### Fee calculation before transfers
**Why**: Calculate all fees upfront before any external calls. Prevents state manipulation during execution.

### Difference adjustment logic
**Why**: RMM.repay() might return less than requested (due to available debt). The difference must be properly handled to maintain user trust.

---

## Fee System

### Why Basis Points (BPS)?
**Decision**: Using 10000 = 100% system
**Rationale**: Allows precise sub-percentage fees (e.g., 0.25% = 25 BPS). Standard in DeFi and prevents rounding errors.

### Why DAO Fee Reduction?
**Decision**: Token holders get fee discounts
**Rationale**: Creates utility for governance tokens and rewards protocol stakeholders. Common DeFi pattern for protocol tokens.

### Why Separate DAO and Sender Tips?
**Decision**: Split fees between protocol treasury and transaction executor
**Rationale**: Incentivizes people to execute repayments (sender tips) while funding protocol development (DAO fees).

### Why Fee Adjustment on Difference?
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

### Why Token Approval Pattern?
**Decision**: Contract approves RMM for exact amounts before each operation
**Rationale**: Minimizes approval attack surface. Fresh approvals for each operation prevent unlimited access.

---

## Data Structure Decisions

### Why TokenPair Struct?
**Decision**: Group related token addresses
**Rationale**: Ensures consistency and makes token relationships explicit. Prevents mismatched token configurations.

### Why Shared Timestamps?
**Decision**: One timestamp per user across all tokens
**Rationale**: Prevents users from gaming the system by using different tokens to bypass timing restrictions.

### Why Active Boolean in TokenConfig?
**Decision**: Soft delete instead of removing mappings
**Rationale**: Solidity can't delete mapping entries. Boolean flag allows deactivation while preserving historical data.

---

## Future-Proofing

### Why Version Function?
**Decision**: Track contract version
**Rationale**: Essential for upgrade management and debugging. Allows frontend to verify contract version.

### Why Emergency Recovery?
**Decision**: Admin can recover accidentally sent tokens
**Rationale**: Users might accidentally send tokens to the contract. Recovery function prevents permanent loss.

### Why Modular Fee System?
**Decision**: Separate functions for each fee parameter
**Rationale**: Allows granular control and easier governance. Each parameter can be adjusted independently.

---

## Gas Optimization

### Why Batch Operations?
**Decision**: Process multiple users in single transaction
**Rationale**: Significantly reduces gas costs for operators. Essential for protocol sustainability.

### Why Storage Packing?
**Decision**: Efficient struct layouts and minimal storage reads
**Rationale**: Reduces gas costs for users. Critical for adoption of micro-transaction use cases.

### Why View Function Optimization?
**Decision**: Efficient loops in getUserConfigs()
**Rationale**: Minimizes gas for frontend queries while providing necessary data.

---

*This document should be updated whenever significant architectural changes are made to the contract.* 