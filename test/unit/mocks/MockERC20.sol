// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @notice Mock ERC20 token for testing with Foundry
 * @dev Optimized for testing with mint, burn, and balance manipulation
 */
contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_, uint256 initialSupply) ERC20(name, symbol) {
        _decimals = decimals_;
        _mint(msg.sender, initialSupply);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Mint tokens to an address (for testing)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens from an address (for testing)
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }

    /**
     * @notice Set balance of an address (for testing)
     * @param account Address to set balance for
     * @param amount New balance amount
     */
    function setBalance(address account, uint256 amount) external {
        uint256 currentBalance = balanceOf(account);
        if (amount > currentBalance) {
            _mint(account, amount - currentBalance);
        } else if (amount < currentBalance) {
            _burn(account, currentBalance - amount);
        }
    }

    /**
     * @notice Approve and transfer in one call (for testing)
     * @param from Address to transfer from
     * @param to Address to transfer to
     * @param amount Amount to transfer
     */
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        // Auto-approve for testing convenience
        if (allowance(from, msg.sender) < amount) {
            _approve(from, msg.sender, type(uint256).max);
        }
        return super.transferFrom(from, to, amount);
    }
}
