// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockDebtToken
 * @notice A mock debt token for testing purposes (simulates armmv3WXDAI and armmv3USDC)
 * @dev This contract extends OpenZeppelin's ERC20 implementation to simulate debt tokens
 * Used to test interactions with debt tokens on local network
 */
contract MockDebtToken is ERC20 {
    address public underlyingAsset;
    
    /**
     * @notice Constructs the MockDebtToken
     * @dev Mints initial supply to the deployer
     * @param name The name of the debt token (e.g., "Aave Variable Debt WXDAI")
     * @param symbol The symbol of the debt token (e.g., "armmv3WXDAI")
     * @param _underlyingAsset The address of the underlying asset
     */
    constructor(
        string memory name, 
        string memory symbol,
        address _underlyingAsset
    ) ERC20(name, symbol) {
        underlyingAsset = _underlyingAsset;
        // Mint some initial debt tokens for testing
        _mint(msg.sender, 100000 * 10 ** decimals());
    }

    /**
     * @notice Mints debt tokens to a specified address
     * @dev Simulates debt accrual or borrowing
     * @param to The address to mint debt tokens to
     * @param amount The amount of debt tokens to mint
     */
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    /**
     * @notice Burns debt tokens from a specified address
     * @dev Simulates debt repayment
     * @param from The address to burn debt tokens from
     * @param amount The amount of debt tokens to burn
     */
    function burn(address from, uint256 amount) public {
        _burn(from, amount);
    }

    /**
     * @notice Returns the underlying asset address
     * @return The address of the underlying asset
     */
    function getUnderlyingAsset() external view returns (address) {
        return underlyingAsset;
    }
} 