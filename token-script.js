#!/usr/bin/env node
// Script de manipulation des tokens en ligne de commande
// Usage: node token-script.js <action> <montant> <token> <adresse>
// Actions: 1=mint, 2=burn, 3=mint+approve

const ethers = require("ethers");
const fs = require('fs');
const path = require('path');

// Charger la config
function loadConfig() {
    const configPath = path.join(__dirname, 'config.js');
    const configContent = fs.readFileSync(configPath, 'utf8');

    // Extraire les adresses des contrats
    const rentMatch = configContent.match(/RENT2REPAY: "([^"]+)"/);
    const wxdaiMatch = configContent.match(/WXDAI: "([^"]+)"/);
    const usdcMatch = configContent.match(/USDC: "([^"]+)"/);
    const debtWxdaiMatch = configContent.match(/DEBT_WXDAI: "([^"]+)"/);
    const debtUsdcMatch = configContent.match(/DEBT_USDC: "([^"]+)"/);

    return {
        RENT2REPAY: rentMatch ? rentMatch[1] : '',
        WXDAI: wxdaiMatch ? wxdaiMatch[1] : '',
        USDC: usdcMatch ? usdcMatch[1] : '',
        DEBT_WXDAI: debtWxdaiMatch ? debtWxdaiMatch[1] : '',
        DEBT_USDC: debtUsdcMatch ? debtUsdcMatch[1] : ''
    };
}

// Mapping des tickers vers les adresses
function getTokenAddress(ticker, config) {
    const mapping = {
        'WXDAI': config.WXDAI,
        'USDC': config.USDC,
        'debtWXDAI': config.DEBT_WXDAI,
        'debtUSDC': config.DEBT_USDC
    };
    return mapping[ticker];
}

// ABI minimal pour les tokens
const TOKEN_ABI = [
    "function mint(address to, uint256 amount)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address owner) view returns (uint256)",
    "function symbol() view returns (string)"
];

async function main() {
    // Parser les arguments
    const args = process.argv.slice(2);

    if (args.length !== 4) {
        console.log("❌ Usage: node token-script.js <action> <montant> <token> <adresse>");
        console.log("   Actions: 1=mint, 2=burn, 3=mint+approve");
        console.log("   Tokens: WXDAI, USDC, debtWXDAI, debtUSDC");
        console.log("   Exemple: node token-script.js 1 50 WXDAI 0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
        process.exit(1);
    }

    const [action, montantStr, ticker, userAddress] = args;
    const actionNum = parseInt(action);
    const montant = parseInt(montantStr);

    // Validation
    if (![1, 2, 3].includes(actionNum)) {
        console.log("❌ Action invalide. Utilisez: 1=mint, 2=burn, 3=mint+approve");
        process.exit(1);
    }

    if (isNaN(montant) || montant <= 0) {
        console.log("❌ Montant invalide");
        process.exit(1);
    }

    if (!ethers.isAddress(userAddress)) {
        console.log("❌ Adresse utilisateur invalide");
        process.exit(1);
    }

    // Charger la config
    const config = loadConfig();
    const tokenAddress = getTokenAddress(ticker, config);

    if (!tokenAddress || tokenAddress === '') {
        console.log(`❌ Token ${ticker} non trouvé dans config.js`);
        console.log("Tokens disponibles: WXDAI, USDC, debtWXDAI, debtUSDC");
        process.exit(1);
    }

    console.log("🚀 SCRIPT TOKEN");
    console.log("=".repeat(30));
    console.log(`Action: ${actionNum} (${actionNum === 1 ? 'mint' : actionNum === 2 ? 'burn' : 'mint+approve'})`);
    console.log(`Montant: ${montant} ${ticker}`);
    console.log(`Token: ${ticker} (${tokenAddress})`);
    console.log(`Utilisateur: ${userAddress}`);

    try {
        // Se connecter au réseau local avec un provider simple
        const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

        // Utiliser l'account 0 (deployer) directement
        const deployerKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        const deployer = new ethers.Wallet( , provider);

        // Créer le contrat token
        const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, deployer);

        // Vérifier que c'est bien le bon token
        const symbol = await tokenContract.symbol();
        console.log(`✅ Token connecté: ${symbol}`);

        // Convertir le montant en wei (18 décimales)
        const montantWei = ethers.parseUnits(montant.toString(), 18);

        // Exécuter l'action
        switch (actionNum) {
            case 1: // Mint
                console.log(`\n🪙 Mint de ${montant} ${ticker}...`);
                const mintTx = await tokenContract.mint(userAddress, montantWei);
                console.log(`📤 Transaction envoyée: ${mintTx.hash}`);
                await mintTx.wait();
                console.log(`✅ Mint réussi !`);
                break;

            case 2: // Burn (simulé par transfer vers 0x0)
                console.log(`\n🔥 Burn de ${montant} ${ticker}...`);
                const userKey = userAddress === "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
                    ? "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"  // User1
                    : deployerKey; // Deployer par défaut
                const userWallet = new ethers.Wallet(userKey, provider);
                const tokenAsUser = new ethers.Contract(tokenAddress, TOKEN_ABI, userWallet);
                const burnTx = await tokenAsUser.transfer("0x0000000000000000000000000000000000000000", montantWei);
                console.log(`📤 Transaction envoyée: ${burnTx.hash}`);
                await burnTx.wait();
                console.log(`✅ Burn réussi ! (simulé par transfer vers 0x0)`);
                break;

            case 3: // Mint + Approve
                console.log(`\n🪙 Mint de ${montant} ${ticker}...`);
                const mintTx2 = await tokenContract.mint(userAddress, montantWei);
                console.log(`📤 Mint envoyé: ${mintTx2.hash}`);
                await mintTx2.wait();
                console.log(`✅ Mint réussi !`);

                console.log(`\n✅ Approbation de ${montant} ${ticker} pour Rent2Repay...`);
                const userKey2 = userAddress === "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
                    ? "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"  // User1
                    : deployerKey; // Deployer par défaut
                const userWallet2 = new ethers.Wallet(userKey2, provider);
                const tokenAsUser2 = new ethers.Contract(tokenAddress, TOKEN_ABI, userWallet2);
                const approveTx = await tokenAsUser2.approve(config.RENT2REPAY, montantWei);
                console.log(`📤 Approbation envoyée: ${approveTx.hash}`);
                await approveTx.wait();
                console.log(`✅ Approbation réussie !`);
                break;
        }

        // Afficher la balance finale
        const balance = await tokenContract.balanceOf(userAddress);
        const balanceFormatted = ethers.formatUnits(balance, 18);
        console.log(`\n💰 Balance finale: ${balanceFormatted} ${ticker}`);

        console.log("\n🎉 Opération terminée avec succès !");

    } catch (error) {
        console.error(`❌ Erreur: ${error.message}`);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    }); 