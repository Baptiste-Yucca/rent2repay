// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockRMM {
    mapping(address => uint256) public debts;

    function repay(address borrower, uint256 amount) external {
        IERC20(msg.sender).transferFrom(msg.sender, address(this), amount);
        debts[borrower] -= amount;
    }

    function setDebt(address borrower, uint256 amount) external {
        debts[borrower] = amount;
    }
} 