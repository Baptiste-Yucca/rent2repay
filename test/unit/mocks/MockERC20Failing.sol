// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20Failing
 * @notice Mock ERC20 token that fails on approve() for testing
 * @dev This token always returns false on approve() to test error conditions
 */
contract MockERC20Failing is ERC20 {
    uint8 private _decimals;
    
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _decimals = decimals_;
        _mint(msg.sender, initialSupply);
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @notice Override approve to always return false (for testing failure cases)
     * @return Always returns false
     */
    function approve(address /* spender */, uint256 /* amount */) public pure override returns (bool) {
        // Always return false to simulate approval failure
        return false;
    }
    
    /**
     * @notice Mint tokens to an address (for testing)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
