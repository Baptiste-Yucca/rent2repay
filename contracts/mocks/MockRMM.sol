// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockRMM {
    event Repaid(address token, uint256 amount, uint256 mode, address user);

    function repay(
        address token,
        uint256 amount,
        uint256 mode,
        address user
    ) external returns (uint256) {
        emit Repaid(token, amount, mode, user);
        return amount; // simule le succès du remboursement complet
    }
}