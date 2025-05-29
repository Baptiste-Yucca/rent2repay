const { ethers } = require("hardhat");

/**
 * Utilitaires pour interagir avec les tokens de dette
 */

/**
 * Obtient le solde d'un token de dette pour une adresse donnée
 * @param {string} tokenAddress - L'adresse du contrat du token de dette
 * @param {string} userAddress - L'adresse de l'utilisateur
 * @returns {Promise<string>} Le solde en format lisible
 */
async function getDebtTokenBalance(tokenAddress, userAddress) {
    const debtToken = await ethers.getContractAt("MockDebtToken", tokenAddress);
    const balance = await debtToken.balanceOf(userAddress);
    const decimals = await debtToken.decimals();
    const symbol = await debtToken.symbol();

    const formattedBalance = ethers.formatUnits(balance, decimals);
    console.log(`Solde de ${symbol} pour ${userAddress}: ${formattedBalance}`);

    return formattedBalance;
}

/**
 * Obtient les informations détaillées d'un token de dette
 * @param {string} tokenAddress - L'adresse du contrat du token de dette
 */
async function getDebtTokenInfo(tokenAddress) {
    const debtToken = await ethers.getContractAt("MockDebtToken", tokenAddress);

    const name = await debtToken.name();
    const symbol = await debtToken.symbol();
    const decimals = await debtToken.decimals();
    const totalSupply = await debtToken.totalSupply();
    const underlyingAsset = await debtToken.getUnderlyingAsset();

    console.log("=== Informations du Token de Dette ===");
    console.log(`Nom: ${name}`);
    console.log(`Symbole: ${symbol}`);
    console.log(`Décimales: ${decimals}`);
    console.log(`Supply totale: ${ethers.formatUnits(totalSupply, decimals)}`);
    console.log(`Asset sous-jacent: ${underlyingAsset}`);

    return {
        name,
        symbol,
        decimals,
        totalSupply: ethers.formatUnits(totalSupply, decimals),
        underlyingAsset
    };
}

/**
 * Mint des tokens de dette pour un utilisateur (simulation d'emprunt)
 * @param {string} tokenAddress - L'adresse du contrat du token de dette
 * @param {string} userAddress - L'adresse de l'utilisateur
 * @param {string} amount - Le montant à minter (en format lisible)
 */
async function mintDebtTokens(tokenAddress, userAddress, amount) {
    const debtToken = await ethers.getContractAt("MockDebtToken", tokenAddress);
    const decimals = await debtToken.decimals();
    const amountWei = ethers.parseUnits(amount, decimals);

    const tx = await debtToken.mint(userAddress, amountWei);
    await tx.wait();

    console.log(`Minté ${amount} tokens de dette pour ${userAddress}`);
    console.log(`Transaction hash: ${tx.hash}`);
}

/**
 * Burn des tokens de dette d'un utilisateur (simulation de remboursement)
 * @param {string} tokenAddress - L'adresse du contrat du token de dette
 * @param {string} userAddress - L'adresse de l'utilisateur
 * @param {string} amount - Le montant à burn (en format lisible)
 */
async function burnDebtTokens(tokenAddress, userAddress, amount) {
    const debtToken = await ethers.getContractAt("MockDebtToken", tokenAddress);
    const decimals = await debtToken.decimals();
    const amountWei = ethers.parseUnits(amount, decimals);

    const tx = await debtToken.burn(userAddress, amountWei);
    await tx.wait();

    console.log(`Brûlé ${amount} tokens de dette de ${userAddress}`);
    console.log(`Transaction hash: ${tx.hash}`);
}

module.exports = {
    getDebtTokenBalance,
    getDebtTokenInfo,
    mintDebtTokens,
    burnDebtTokens
}; 