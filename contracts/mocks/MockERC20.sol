// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @notice A mock ERC20 token for testing purposes
 * @dev This contract extends OpenZeppelin's ERC20 implementation with additional minting 
 * functionality. Used primarily for testing the Rent2Repay system
 */
contract MockERC20 is ERC20 {
    /**
     * @notice Constructs the MockERC20 token
     * @dev Mints 1,000,000 tokens to the deployer upon deployment
     * @param name The name of the token
     * @param symbol The symbol of the token
     */
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }

    /**
     * @notice Mints tokens to a specified address
     * @dev This function is public and can be called by anyone for testing purposes
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
} 