// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Rent2Repay} from "../src/Rent2Repay.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TestForkScript is Script {
    function run() external {
        // Fork Gnosis
        vm.createFork("gnosis");
        
        console.log("Forking Gnosis at block:", block.number);
        console.log("Chain ID:", block.chainid);
        
        // Vérifier les adresses des tokens
        address wxdai = 0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d;
        address usdc = 0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83;
        
        console.log("WXDAI balance of this contract:", IERC20(wxdai).balanceOf(address(this)));
        console.log("USDC balance of this contract:", IERC20(usdc).balanceOf(address(this)));
        
        // Tester la création d'un contrat
        Rent2Repay rent2Repay = new Rent2Repay();
        console.log("Rent2Repay deployed at:", address(rent2Repay));
    }
}
