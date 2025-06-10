#!/usr/bin/env node
// Script simple sans Hardhat - juste ethers.js
const ethers = require('ethers');
const fs = require('fs');
const path = require('path');

// Test simple
async function test() {
    try {
        console.log("🧪 Test simple...");

        const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        const deployer = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);

        const tokenContract = new ethers.Contract(
            "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
            ["function symbol() view returns (string)", "function mint(address to, uint256 amount)"],
            deployer
        );

        const symbol = await tokenContract.symbol();
        console.log("✅ Symbol:", symbol);

        // Test mint
        console.log("🪙 Test mint...");
        const tx = await tokenContract.mint("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", ethers.parseUnits("100", 18));
        console.log("📤 Tx:", tx.hash);
        await tx.wait();
        console.log("✅ Mint réussi !");

    } catch (error) {
        console.error("❌ Erreur:", error.message);
    }
}

test(); 