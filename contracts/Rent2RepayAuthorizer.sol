// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Rent2RepayAuthorizer {
    // Mapping pour indiquer si l'utilisateur a autorisé le mécanisme
    mapping(address => bool) public isAuthorized;

    // Événements
    event Rent2RepayAuthorized(address indexed user);
    event Rent2RepayRevoked(address indexed user);

    /**
     * @notice Autorise le mécanisme Rent2Repay pour msg.sender
     */
    function authorizeRent2Repay() external {
        require(!isAuthorized[msg.sender], "Already authorized");
        isAuthorized[msg.sender] = true;
        emit Rent2RepayAuthorized(msg.sender);
    }

    /**
     * @notice Révoque l'autorisation du mécanisme Rent2Repay pour msg.sender
     */
    function revokeRent2Repay() external {
        require(isAuthorized[msg.sender], "Not authorized");
        isAuthorized[msg.sender] = false;
        emit Rent2RepayRevoked(msg.sender);
    }
} 